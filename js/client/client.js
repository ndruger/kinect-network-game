/*global DP, io, cs, SceneJS, ASSERT, DPD, LOG, BlenderExport, myModules, KeyEvent */
/*global Enemy, render */
(function(){
var DEBUG = true;
var cs = myModules.cs;
var mycs = myModules.mycs;
var myc = myModules.myc;
var deviceProxy, remoteProxy, field, myPlayerId = -1, counter, myEnemyId, renderingTimer = -1, nobind_conrollers;
var lifeBars;

var FPS = 30;
var SCALE = 0.008;
var EYE_Z = 70;	// todo: check SCALE
var LOOK_AT_EYE = { x: 0.0, y: 10, z: EYE_Z };

var useVR920 = false;

var devicePort = cs.DEVICE_PORT;
var query = myc.parseQuery();
if (query.port) {
	devicePort = query.port;
}

// todo: create objects
function chainSimpleRotate(id, nodes, type){
	var wrapper = [{
		type: 'rotate',
		id: id + '-rotate-' + type,
		angle: 0.0,
		y: 1.0,
		nodes: nodes
	}];
	wrapper[0][type] = 1.0;
	return wrapper;
}
function chainSimpleRotateX(id, nodes){
	return chainSimpleRotate(id, nodes, 'x');
}
function chainSimpleRotateY(id, nodes){
	return chainSimpleRotate(id, nodes, 'y');
}
function chainSimpleRotateZ(id, nodes){
	return chainSimpleRotate(id, nodes, 'z');
}

function setNodeXYZ(id, pos){
	var node = SceneJS.withNode(id);
	node.set('x', pos.x);
	node.set('y', pos.y);
	node.set('z', pos.z);
}
function createAndMountNodes(node, id){
	SceneJS.Message.sendMessage({
		command: 'create',
		nodes: [{
			type: 'node',
			id: id,
			nodes: node
		}]
	});
	SceneJS.Message.sendMessage({
		command: 'update',
		target: 'mount-node',
		add: {
			node: id
		}
	});
}
function removeNode(id){
	SceneJS.Message.sendMessage({
		command: "update",
		target: 'mount-node',
		remove: {
			node: id
		}
	});
}

function displayMessage(message){
	var ele = document.getElementById('message');
	if (!ele) {
		var canvas = document.getElementById('main_canvas');
		var bound_rect = canvas.getBoundingClientRect();
	
		ele = document.createElement('div');
		ele.id = 'message';
		ele.style.top =  bound_rect.top + window.scrollY + bound_rect.height / 3 + 'px';
		ele.style.left =  bound_rect.left + window.scrollX + bound_rect.width / 3 + 'px';
		ele.style.height =  bound_rect.height / 3 + 'px';
		ele.style.width =  bound_rect.width / 3 + 'px';
		document.documentElement.appendChild(ele);
	}
	ele.innerHTML = message;
}

function NobindControllers(){
}
NobindControllers.prototype.update = function(in_id_list){
	var df = document.createDocumentFragment();
	var len = in_id_list.length;
	var self = this;
	for (var i = 0; i < len; i++) {
		var ele = document.createElement('button');
		ele.innerHTML = in_id_list[i];
		ele.addEventListener('click', function(){
			self.requestBinding(this.textContent);
			ele.parentNode.innerHTML = '';	// todo: too fast
		}, false);
		df.appendChild(ele);
	}

	var list_element = document.getElementById('controller_list'); 
	list_element.innerHTML = '';
	list_element.appendChild(df);
};
NobindControllers.prototype.requestBinding = function(in_id){
	remoteProxy.send({type: 'binding_request', arg:{id: in_id}});
};

function ClientField(aspect){
	mycs.superClass(ClientField).constructor.apply(this, []);
	SceneJS.createNode({
		type: "scene",
		id: "the-scene",
		canvasId: "main_canvas",
		loggingElementId: "theLoggingDiv",
		nodes: [{
			type: "lookAt",
			eye : LOOK_AT_EYE, 
			look : { x:0, y:0, z:0 },
			up : { y: 1.0 },
			id: "player_eye",
			nodes: [{
				type: "camera",
				optics: {
					type: "perspective",
					fovy : 25.0,
					aspect : aspect,
					near : 0.10,
					far : 300.0
				},
				nodes: [{
					type: "light",
					mode: "dir",
					color: { r: 0.9, g: 0.9, b: 0.9 },
					diffuse: true,
					specular: true,
					dir: { x: 0.0, y: 10.0, z: 0.0 },
					pos: { x: 0.0, y: 0.0, z: 0.0}
				},
				{
					type: "light",
					mode: "dir",
					color: { r: 0.3, g: 0.3, b: 0.3 },
					diffuse: true,
					specular: true,
					dir: { x: 0.0, y: 0.0, z: EYE_Z - 1 },
					pos: { x: 0.0, y: 10.0, z: EYE_Z }
				},
				{
					type: "light",
					mode: "dir",
					color: { r: 0.3, g: 0.3, b: 0.3 },
					diffuse: true,
					specular: true,
					dir: { x: 0.0, y: 0.0, z: -EYE_Z - 1 },
					pos: { x: 0.0, y: 10.0, z: -EYE_Z }
				},
				{
				    type: "material",
				    id: "floor",
				    baseColor: { r: 0.2, g: 0.2, b: 0.2 },
				    shine: 6.0,
				    nodes: [{
			            type: "texture",
			            layers: [{
		                    uri: "img/wall.png",
		                    minFilter: "linearMipMapLinear",
		                    wrapS: "repeat",
		                    wrapT: "repeat",
		                    scale : { x: 100.0, y: 100.0, z: 10.0 }
			            }],
			            nodes: [{
							type: "translate",
							y: -1,
							nodes: [{
			                    type: "scale",
			                    x: cs.FIELD_X_WIDTH / 2,
			                    y: 1.0,
			                    z : cs.FIELD_Z_WIDTH / 2,
			                    nodes: [{
			                    	type: "cube"
			                    }]
							}]
			            }]
				    }]
				},
				{
					id: 'base',
		            type: "cube",
					xSize: 0.1,
					ySize : 0.1,
					zSize : 0.1
				},
				{
					type: 'translate',
					id: 'debug_cube-translate',
				    nodes: [{
			            id: "debug_cube",
						type: 'cube',
						xSize: 0.1,
						ySize : 0.1,
						zSize : 0.1
					}]
				},
				{
					type: "node",
					id: "mount-node"
				}]
			}]
		}]
	});
}
mycs.inherit(ClientField, cs.Field);

function LifeBars(){
}
LifeBars.prototype.add = function(playerId){
	var frame = document.createElement('div');
	frame.className = 'life_bar';
	frame.id = 'life_bar_' + playerId;
	
	var life = document.createElement('div');
	life.className = 'life_bar_life';
	life.id = 'life_bar_life_' + playerId;
	frame.appendChild(life);

	if (playerId === myPlayerId) {
		document.getElementById('my_life_bar_wrapper').appendChild(frame);
	} else {
		document.getElementById('life_bars').appendChild(frame);
	}
};
LifeBars.prototype.remove = function(playerId){
	var ele = document.getElementById('life_bar_' + playerId);
	ele.parentNode.removeChild(ele);
};
LifeBars.prototype.update = function(playerId, percent){
	document.getElementById('life_bar_life_' + playerId).style.width = percent + '%';
};

function Unit(point, type, oid){
	if (typeof oid != 'undefined') {
		this.id = oid;
	} else {
		this.id = type + mycs.createId(cs.ID_SIZE);
	}
	this.pos = point;
	this.type = type;
	this.idDirty = false;
	field.addPiece(this, this.id);
}
Unit.prototype.destroy = function(){
	field.removePiece(this.id);
	removeNode(this.id);
};
Unit.prototype._createNode = function(node){
	var nodes = [];

	nodes.push({
		type: 'translate',
		id: this.id + '-translate',
		x: this.pos.x,
		y: this.pos.y,
		z: this.pos.z,
		nodes: chainSimpleRotateY(this.id, 
			chainSimpleRotateX(this.id,
				chainSimpleRotateZ(this.id, [{
					type: 'scale',
					id: this.id + '-scale',
					nodes: [node]
				}])
			)
		)
	});
	
	createAndMountNodes(nodes, this.id);
};
Unit.prototype.updateScale = function(x, y, z) {
	var scale = SceneJS.withNode(this.id + '-scale');
	scale.set('x', x);	
	scale.set('y', y);	
	scale.set('z', z);
};
Unit.prototype.updatePosition = function(pos) {
	this.pos = pos;
	this.idDirty = true;
};
Unit.prototype.render = function(pos){
	if (this.pos && this.idDirty) {
		setNodeXYZ(this.id + '-translate', this.pos);
		this.idDirty = false;
	}
};

function Bullet(point, id, owner_type){
	mycs.superClass(Bullet).constructor.apply(this, [point, 'bullet', id]);
	this.ownerType = owner_type;
	this._createNode();
}
mycs.inherit(Bullet, Unit);
Bullet.type = {
	enemy: {
		color: { r: 0.0, g: 0.0, b: 1.0 },
		r: cs.ENEMY_BULLET_R
	},
	player: {
		color: { r: 1.0, g: 1.0, b: 1.0 },
		r: cs.PLAYER_BULLET_R
	}
};
Bullet.prototype._createNode = function(){
	mycs.superClass(Bullet)._createNode.apply(this, [{
		type: "material",
		baseColor: Bullet.type[this.ownerType].color,
		shine:          4.0,
		opacity:        1.0,
        nodes: [{
        	type: "sphere"
        }]
	}]);
	var r = Bullet.type[this.ownerType].r;
	this.updateScale(r, r, r);
};

function Enemy(point, id){
	mycs.superClass(Enemy).constructor.apply(this, [point, 'enemy', id]);
	var self = this;
	this._createNode();
}
mycs.inherit(Enemy, Unit);
Enemy.X_ANGLE_BASE = 270.0;
Enemy.prototype.destroy = function(){
	if (this.throwTimer !== -1) {
		clearInterval(this.throwTimer);
	}
	mycs.superClass(Enemy).destroy.apply(this, []);
};
Enemy.prototype._createNode = function(){
	var blenderData;
	if (this.id == myEnemyId) {
		blenderData = BlenderExport.myEnemy;
	} else {
		blenderData = BlenderExport.enemy;
	}
	mycs.superClass(Enemy)._createNode.apply(this, [{
		type: "material",
		baseColor: { r: 1.0, g: 1.0, b: 1.0 },
		nodes: [{
			type: "texture",
			layers: [{
				uri: blenderData.textureUri,
				blendMode: "multiply"
			}],
			nodes: [{
				type: "geometry",
				primitive: "triangles",			
				positions: blenderData.vertices,
				uv: blenderData.texCoords,
				indices: blenderData.indices
			}]
		}]
	}]);
	SceneJS.withNode(this.id + '-rotate-x').set('angle', Enemy.X_ANGLE_BASE); 
	this.updateScale(cs.ENEMY_SIZE, cs.ENEMY_SIZE, cs.ENEMY_SIZE);
};
Enemy.prototype.setDamege = function(damege){
	this.destroy();
	var enemies = field.getPiecesByType('enemy');
};

function ClientJoint(type, player){
	mycs.superClass(ClientJoint).constructor.apply(this, [type, player]);
			
	function createEdge(id) {
		return {
			type: "translate",
			id: id + '-translate',
			nodes: chainSimpleRotateY(id, [{
				type: "material",
				baseColor: { r: 1.0, g: 0.0, b: 0.0 },
				shine: 1.0,
				opacity: 1.0,
				nodes: [{
					type : "cube",
					xSize: cs.Joint.H_SIZE,
					ySize: cs.Joint.H_SIZE,
					zSize: cs.Joint.H_SIZE
				}]
			}])
		};
	}
	function createShield(id) {
		return {
			type: "translate",
			id: id + '-translate',
			nodes: chainSimpleRotateY(id, [{
			    type: "material",
			    baseColor: { r: 0.2, g: 0.2, b: 0.2 },
			    shine: 6.0,
				opacity: 0.9,
			    nodes: [{
		            type: "texture",
		            layers: [{
	                    uri: "img/shield.png",
	                    minFilter: "linearMipMapLinear",
	                    wrapS: "repeat",
	                    wrapT: "repeat",
	                    scale : { x: 1.0, y: 1.0, z: 1.0 }
		            }],
					nodes: [{
	                    type: "scale",
	                    x: cs.Joint.SIELD_H_SIZE,
	                    y: cs.Joint.SIELD_H_SIZE,
	                    z: 0.1,
	                    nodes: [{
	                    	type: "cube"
	                    }]
		            }]
			    }]
			}])
		};
	}

	if (this.type === 'LEFT_HAND') {
		this._createNode(createShield);
	} else {
		this._createNode(createEdge);
	}
	
}
mycs.inherit(ClientJoint, cs.Joint);
ClientJoint.prototype.destroy = function(){
	removeNode(this.id);
};
ClientJoint.prototype._createNode = function(factory){
	var nodes = [];
	nodes.push(factory(this.id));
	createAndMountNodes(nodes, this.id);
};
ClientJoint.prototype.render = function(angleY){
	if (this.pos) {
		setNodeXYZ(this.id + '-translate', this.pos);
		SceneJS.withNode(this.id + '-rotate-y').set('angle', angleY);
	}
};

function ClientEdgePoints(type){
	mycs.superClass(ClientEdgePoints).constructor.apply(this, [type]);
	this._createNode();
}
mycs.inherit(ClientEdgePoints, cs.EdgePoints);
ClientEdgePoints.prototype.destroy = function(){
	removeNode(this.id);
};
ClientEdgePoints.prototype._createNode = function(){
	var nodes = [];
	for (var i = 0; i < cs.EdgePoints.NUM; i++) {
		nodes.push({
			type: "translate",
			id: this.id + '-' + i + '-translate',
			nodes: [{
				type: "material",
				baseColor:	  { r: 1.0, g: 0.0, b: 0.0 },
				shine:          4.0,
				opacity:        1.0,
				nodes: [{
					type : "cube",
					xSize: cs.EdgePoints.H_SIZE,
					ySize : cs.EdgePoints.H_SIZE,
					zSize : cs.EdgePoints.H_SIZE
				}]
			}]
		});
	}
	createAndMountNodes(nodes, this.id);
};
ClientEdgePoints.prototype.render = function(){
	for (var i = 0; i < cs.EdgePoints.NUM; i++) {
		if (this.poss[i]) {
			setNodeXYZ(this.id + '-' + i + '-translate', this.poss[i]);
		}
	}
};

function ClientPlayer(id, opt_basePos, opt_angleY){
	this.type = 'player';
	this.id = id;
	this.noPos = true;
	this.HMDAngle = null;
	var factory = {
		createJoint: function(type, player){
			return new ClientJoint(type, player);
		},
		createEdgePoints: function(type){
			return new ClientEdgePoints(type);
			
		}
	};
	mycs.superClass(ClientPlayer).constructor.apply(this, [factory, opt_basePos, opt_angleY]);
	field.addPiece(this, this.id);
	lifeBars.add(this.id);
}
mycs.inherit(ClientPlayer, cs.Player);
ClientPlayer.prototype.destroy = function(){
	for (var k in this.joints) {
		var joint = this.joints[k];
		if (!joint) {
			continue;
		}
		joint.destroy();
	}
	for (k in this.edgePoints) {
		var edgePoint = this.edgePoints[k];
		if (!edgePoint) {
			continue;
		}
		edgePoint.destroy();
	}
	field.removePiece(this.id);
	lifeBars.remove(this.id);
};
ClientPlayer.prototype.updateLife = function(life){
	lifeBars.update(this.id, life * (100 / cs.Player.LIFE_MAX));
	if (this.id === myPlayerId && life === 0) {
		displayMessage('You lose.<br><br>Press F5 to retry.');
	}
};
ClientPlayer.prototype.setJointPosition = function(positions){
	mycs.superClass(ClientPlayer).setJointPosition.apply(this, [positions]);
	if (this.noPos) {
		this.updateEye();
		this.noPos = false;
	}
};
ClientPlayer.prototype.updateEye = function(){
	if (this.isMyPlayer() && this.joints['HEAD'].pos) {
		var headPos = this.joints['HEAD'].pos;
		var eye = SceneJS.withNode('player_eye');
		if (useVR920) {
			if (!this.HMDAngle) {
				return;
			}
			var angleY = this.HMDAngle.yaw * (180.0 / 32768) + 180;
			var angleX = this.HMDAngle.pitch * (90.0 / 16384);
			var angleZ = this.HMDAngle.roll * (180.0 / 32768);
			
			var diff = cs.calcRoatatePosition({x: angleX, y: angleY + this.angleY, z: angleZ}, 10);	// todo: fix bug
			
			var p = (Math.sqrt(Math.pow(cs.Joint.H_SIZE, 2) * 2) + 0.1) / 10;
			eye.set('eye', {x: headPos.x + diff[0] * p, y: headPos.y + diff[1] * p, z: headPos.z + diff[2] * p});
			eye.set('look', {x: headPos.x + diff[0], y: headPos.y + diff[1], z: headPos.z + diff[2]});
		} else {
			var newPos = cs.calcRoatatePosition({x:0, y:this.angleY, z:0}, 30);
			eye.set('eye', {x: headPos.x + newPos[0], y: 15, z: headPos.z + newPos[2]});
			eye.set('look', {x: headPos.x, y: 10, z: headPos.z});
		}
	}
};
ClientPlayer.prototype.turn = function(diff){
	mycs.superClass(ClientPlayer).turn.apply(this, [diff]);
	this.updateEye();
};
ClientPlayer.prototype.setBasePosition = function(pos){
	mycs.superClass(ClientPlayer).setBasePosition.apply(this, [pos]);
	this.updateEye();
};
ClientPlayer.prototype.isMyPlayer = function(){
	return (this.id === myPlayerId);
};
ClientPlayer.prototype.render = function(){
	for (var k in this.joints) {
		var joint = this.joints[k];
		if (!joint) {
			continue;
		}
		joint.render(this.angleY);
	}
	for (var i = 0, len = this.edgePoints.length; i < len; i++) {
		var points = this.edgePoints[i];
		points.render();
	}
	if (useVR920) {
		this.updateEye();
	}
};
ClientPlayer.prototype.setHMDAngle = function(angle){
	this.HMDAngle = angle;
};

function Counter(){
	this.fpsCounter = new mycs.XPSCounter();
	this.remotePacketCounter = new mycs.XPSCounter();
	this.devicePacketCounter = new mycs.XPSCounter();
}
Counter.FPS = 0;
Counter.REMOTE_PACKET = 1;
Counter.DEVIDE_PACKET = 2;
Counter.prototype.render = function(){
	this.fpsCounter.update();
	this.remotePacketCounter.update();
	this.devicePacketCounter.update();
	document.getElementById('packet_per_second_from_remote').innerHTML = this.remotePacketCounter.prevCount + ' Packet Frames / Second from remote';
	document.getElementById('packet_per_second_from_device').innerHTML = this.devicePacketCounter.prevCount + ' Packet Frames / Second from device';
	document.getElementById('fps').innerHTML = this.fpsCounter.prevCount + ' / ' + FPS + ' fps (Exclude Event\'s update)';
};
Counter.prototype.increment = function(type){
	switch (type) {
	case Counter.FPS:
		this.fpsCounter.increment();
		break;
	case Counter.REMOTE_PACKET:
		this.remotePacketCounter.increment();
		break;
	case Counter.DEVIDE_PACKET:
		this.devicePacketCounter.increment();
		break;
	}
};

function RenderingTimer(){
	this.timer = -1;
}
RenderingTimer.prototype.start = function(){
	if (this.timer === -1) {
		this.timer = setInterval(function(){ render(); }, 1000 / FPS);
	}
};
RenderingTimer.prototype.stop = function(){
	if (this.timer !== -1) {
		clearInterval(this.timer);
		this.timer = -1;
	}
};

function switchHMDMode(){
	useVR920 = !useVR920;
	var ele = document.getElementById('swith_VR920_mode');
	if (useVR920) {
		ele.innerHTML = 'VR920 off';
	} else {
		var player = field.getPiece(myPlayerId);
		if (player) {
			player.updateEye();
		}
		ele.innerHTML = 'VR920 on';
	}
}

var handleRemoteMessage = function(data){
	counter.increment(Counter.REMOTE_PACKET);
	if (data.type !== 'kinect_joint_postion' && data.arg && data.arg.type === 'player') {
		LOG(data.type);
	}
	var bullet, enemy, player;
	switch (data.type) {
	case 'switch_hmd_mode':
		switchHMDMode();
		break;
	case 'controller_list':
		LOG('handleMainBrowserMessage: list: ' + data.arg.list);
		nobind_conrollers.update(data.arg.list);
		break;
	case 'set_player_id':
		myPlayerId = data.arg.id;
		break;
	case 'kinect_joint_postion':
		player = field.getPiece(data.arg.id);
		if (!player) {
			return;
		}
		player.setJointPosition(data.arg.positions);
		break;
	case 'set_base_position':
		player = field.getPiece(data.arg.id);
		if (!player) {
			return;
		}
		player.setBasePosition(data.arg.pos);
		break;
	case 'update_position':
		switch(data.arg.type){
		case 'bullet':
			bullet = field.getPiece(data.arg.id);
			if (bullet) {
				bullet.updatePosition(data.arg.pos);
			}
			break;
		}
		break;
	case 'turn':
		player = field.getPiece(data.arg.id);
		if (!player) {
			return;
		}
		player.turn(data.arg.diff);
		break;
	case 'joint_pos':	// for remote user
		player = field.getPiece(data.arg.id);
		if (!player) {
			return;
		}
		player.joints[data.arg.type].setPosition(data.arg.pos);
		break;
	case 'edge_point_pos':
		player = field.getPiece(data.arg.id);
		if (!player) {
			return;
		}
		player.edge_points[data.arg.type].setPosition(data.arg.index, data.arg.pos);
		break;
	case 'send_map':	// through
	case 'create':
		switch(data.arg.type){
		case 'enemy':
			new Enemy(data.arg.pos, data.arg.id);
			break;
		case 'bullet':
			new Bullet(data.arg.pos, data.arg.id, data.arg.ownerType);
			break;
		case 'player':
			new ClientPlayer(data.arg.id, data.arg.basePos, data.arg.angleY);
			break;
		default:
			ASSERT(false);
			break;
		}
		break;
	case 'destroy':
		var piece = field.getPiece(data.arg.id);
		if (piece) {
			piece.destroy();
		}
		break;
	case 'update_life':
		player = field.getPiece(data.arg.id);
		if (!player) {
			return;
		}
		player.updateLife(data.arg.life);
		break;
	case 'bind_enemy':
		myEnemyId = data.arg.id;
		break;
	default:
		ASSERT(false);
		break;
	}
};

var kinectBasePosX = -1;
var kinectBasePosZ = -1;
function updateKinectBasePosition(positions){
	var sumX = 0, sumZ = 0;
	for (var i = 0, len = positions.length; i < len; i++) {
		sumX += positions[i].x;
		sumZ += positions[i].z;
	}
	kinectBasePosX = sumX / len;
	kinectBasePosZ = sumZ / len;
}

function adjustKinectPositions(positions){
	for (var i = 0, len = positions.length; i < len; i++) {
		positions[i].x -= kinectBasePosX;
		positions[i].z -= kinectBasePosZ;
	}
}

function handleDeviceMessage(data){
	var player;
	
	counter.increment(Counter.DEVIDE_PACKET);
	switch (data.type) {
	case 'kinect_joint_postion':
		if (myPlayerId === -1) {
			remoteProxy.send({	// todo: fix duplication of invoking
				type: 'create_player_request',
				arg: {
					id: myEnemyId
				}
			});
			updateKinectBasePosition(data.arg.positions);
		} else {
			adjustKinectPositions(data.arg.positions);
			remoteProxy.send(data);
			player = field.getPiece(myPlayerId);
			if (player) {
				player.setJointPosition(data.arg.positions);	// server don't send client kinect data to it self for reducing latency.
			}
		}
		break;
	case 'vr920':
		player = field.getPiece(myPlayerId);
		if (player) {
			player.setHMDAngle({yaw: data.arg.yaw, pitch: data.arg.pitch, roll: data.arg.roll});
		}
		break;
	}
}

function render() {
	
	var pieces = field.getAllPieces();
	for (var i = 0, len = pieces.length; i < len; i++) {
		pieces[i].render();
	}
	counter.increment(Counter.FPS);
	counter.render();
	if (DEBUG) {
		/*
		var object_count = 0;
		for (var k in field._idMap) {
			object_count++;
		}
		document.getElementById('output').innerHTML = object_count;
		*/
	}
	SceneJS.withNode("the-scene").render();
}

function handleLoad(e){
	counter = new Counter();
	var canvas = document.getElementById('main_canvas');
	canvas.width = document.body.clientWidth;
	canvas.height = document.body.clientHeight;

	var canvas_bound_rect = canvas.getBoundingClientRect();

	var myLifeBarOuter = document.getElementById('my_life_bar_wrapper');
	myLifeBarOuter.style.width = (canvas_bound_rect.width - 20) + 'px';

	var info = document.getElementById('info');
	info.style.left = canvas_bound_rect.left + window.scrollX + 10 + 'px';
	info.style.top = canvas_bound_rect.top + window.scrollY + 10 + 'px';
	
	field = new ClientField(canvas.width / canvas.height);
	remoteProxy = new myc.SocketIoProxy(
		cs.REMOTE_PORT,
		function(){
			LOG('remote proxy open');
			deviceProxy = new myc.SocketIoProxy(
				devicePort,
				function(){
					LOG('device proxy open');
				},
				handleDeviceMessage,
				function(){
					LOG('device proxy close');
				},
				'127.0.0.1'
			);
			nobind_conrollers = new NobindControllers();
		},
		handleRemoteMessage,
		function(){
			LOG('remote proxy close');
		}
	);
	document.getElementById('swith_VR920_mode').addEventListener('click', switchHMDMode, false);

	renderingTimer = new RenderingTimer();
	renderingTimer.start();
	
	lifeBars = new LifeBars();
}
window.addEventListener('load', handleLoad, false);

function handleKeydown(e){
	var eye_pos;
	switch(e.keyCode){
	case KeyEvent.DOM_VK_P:
		eye_pos = mycs.deepCopy(LOOK_AT_EYE);
		eye_pos.z = -eye_pos.z;
		SceneJS.withNode('player_eye').set('eye', eye_pos);
		e.preventDefault();
		break;
	case KeyEvent.DOM_VK_V:
		remoteProxy.send({
			type: 'bullet',
			arg: {
				id: myEnemyId
			}
		});
		SceneJS.withNode('player_eye').set('eye', LOOK_AT_EYE);
		e.preventDefault();
		break;
	case KeyEvent.DOM_VK_UP:
	case KeyEvent.DOM_VK_DOWN:
		remoteProxy.send({
			type: 'move_request',
			arg: {
				dir: myc.keyCodeToDir[e.keyCode]
			}
		});
		e.preventDefault();
		break;
	case KeyEvent.DOM_VK_RIGHT:
	case KeyEvent.DOM_VK_LEFT:
		remoteProxy.send({
			type: 'turn',
			arg: {
				diff: {'right': -10, 'left': 10}[myc.keyCodeToDir[e.keyCode]]
			}
		});
		e.preventDefault();
		break;
	case KeyEvent.DOM_VK_SPACE:
		if (field.getPiece(myEnemyId)) {
			remoteProxy.send({
				type: 'bullet',
				arg: {
					id: myEnemyId
				}
			});
		}
		e.preventDefault();
	}
}
window.addEventListener('keydown', handleKeydown, false);

window.addEventListener('focus', function(){
//	renderingTimer.start();
}, false);
window.addEventListener('blur', function(){
//	renderingTimer.stop();
}, false);

})();

