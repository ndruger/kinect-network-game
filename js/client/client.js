/*global DP, io, cs, SceneJS, ASSERT, DPD, LOG, BlenderExport, myModules, KeyEvent */
/*global Enemy, render */
(function(){
var DEBUG = true;
var cs = myModules.cs;
var mycs = myModules.mycs;
var myc = myModules.myc;
var deviceProxy, remoteProxy, field, myPlayerId = -1, counter, myEnemyId, renderingTimer = -1;

var FPS = 60;

var SCALE = 0.008;
var EYE_Z = 70;	// todo: check SCALE
var LOOK_AT_EYE = { x: 0.0, y: 10, z: EYE_Z };

var devicePort = cs.DEVICE_PORT;
var query = myc.parseQuery();
if (query.port) {
	devicePort = query.port;
}

// todo: create objects
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
		nodes: [{
			type: 'rotate',
			id: this.id + '-rotate-y',
			angle: 0.0,
			y: 1.0,
			nodes: [{
				type: 'rotate',
				id: this.id + '-rotate-x',
				angle: 0.0, 
				x: 1.0,
				nodes: [{
					type: 'rotate',
					id: this.id + '-rotate-z',
					angle: 0.0,
					z: 1.0,
					nodes: [{
						type: 'scale',
						id: this.id + '-scale',
						nodes: [ node ]
					}]
				}]
			}]
		}]
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
		r: 0.3
	},
	player: {
		color: { r: 1.0, g: 1.0, b: 1.0 },
		r: 0.5
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
	if (enemies.length === 0) {
		displayMessage('You win.');
	}
};

function ClientJoint(type, player){
	mycs.superClass(ClientJoint).constructor.apply(this, [type, player]);
	function createEdge(id) {
		return {
			type: "translate",
			id: id,
			nodes: [{
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
			}]
		};
	}
	function createShield(id) {
		return {
			type: "translate",
			id: id,
			nodes: [{
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
			}]
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
	nodes.push(factory(this.id + '-translate'));
	createAndMountNodes(nodes, this.id);
};
ClientJoint.prototype.render = function(pos){
	if (this.pos) {
		setNodeXYZ(this.id + '-translate', this.pos);
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
};
ClientPlayer.prototype.updateLife = function(life){
	document.getElementById('life_bar_life').style.width = life * (100 / cs.Player.LIFE_MAX) + '%';
	if (life === 0 && !DEBUG) {
		displayMessage('You lose. Press F5 to retry.');
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
		var newPos = cs.calcRoatatePosition({x:0, y:this.angleY, z:0}, 30);
		var eye = SceneJS.withNode('player_eye');
		eye.set('eye', {x: headPos.x + newPos[0], y: 15, z: headPos.z + newPos[2]});
		eye.set('look', headPos);
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
		joint.render();
	}
	for (var i = 0, len = this.edgePoints.length; i < len; i++) {
		var points = this.edgePoints[i];
		points.render();
	}
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

var handleRemoteMessage = function(data){
	counter.increment(Counter.REMOTE_PACKET);
	if (data.type !== 'kinect_joint_postion' && data.arg.type === 'player') {
		DP(data.type);
	}
	var bullet, enemy, player;
	switch (data.type) {
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
			var player = field.getPiece(myPlayerId);
			if (player) {
				player.setJointPosition(data.arg.positions);	// server don't send client kinect data to it self for reducing latency.
			}
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

	var life_bar = document.getElementById('life_bar');
	life_bar.style.width = (canvas_bound_rect.width - 20) + 'px';
	life_bar.style.left = canvas_bound_rect.left + window.scrollX + 10 + 'px';
	life_bar.style.top = canvas_bound_rect.top + window.scrollY + 10 + 'px';

	var info = document.getElementById('info');
	info.style.left = canvas_bound_rect.left + window.scrollX + 10 + 'px';
	info.style.top = canvas_bound_rect.top + window.scrollY + 30 + 'px';
	
	field = new ClientField(canvas.width / canvas.height);
	remoteProxy = new myc.WebSocketProxy(
		cs.REMOTE_PORT,
		function(){
			LOG('remote proxy open');
			deviceProxy = new myc.WebSocketProxy(
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
		},
		handleRemoteMessage,
		function(){
			LOG('remote proxy close');
		}
	);

	renderingTimer = new RenderingTimer();
	renderingTimer.start();
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
		remoteProxy.send({
			type: 'move_request',
			arg: {
				dir: 'up'
			}
		});
		e.preventDefault();
		break;
	case KeyEvent.DOM_VK_DOWN:
		remoteProxy.send({
			type: 'move_request',
			arg: {
				dir: 'down'
			}
		});
		e.preventDefault();
		break;
	case KeyEvent.DOM_VK_RIGHT:
		remoteProxy.send({
			type: 'turn',
			arg: {
				diff: -10
			}
		});
		e.preventDefault();
		break;
	case KeyEvent.DOM_VK_LEFT:
		remoteProxy.send({
			type: 'turn',
			arg: {
				diff: +10
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
	renderingTimer.start();
}, false);
window.addEventListener('blur', function(){
	renderingTimer.stop();
}, false);

})();

