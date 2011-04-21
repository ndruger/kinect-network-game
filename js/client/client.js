/*global DP, io, cs, SceneJS, ASSERT, DPD, LOG, BlenderExport, myModules, KeyEvent */
/*global Enemy */
(function(){
var cs = myModules.cs;
var mycs = myModules.mycs;
var myc = myModules.myc;

var DEBUG = true;

var deviceProxy, remoteProxy, field, playerId = -1, fpsCounter, remotePacketCounter, devicePacketCounter, myEnemyId;

var FPS = 60;

var SCALE = 0.008;
var EYE_Z = 70;	// todo: check SCALE
var LOOK_AT_EYE = { x: 0.0, y: 10, z: EYE_Z };

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
	field.addPiece(this, this.id);
}
Unit.prototype.destroy = function(){
	field.removePiece(this.id);
	SceneJS.Message.sendMessage({
		command: "update",
		target: 'mount-node',
		remove: {
			node: this.id
		}
	});
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
	setNodeXYZ(this.id + '-translate', this.pos);
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
	ASSERT(false);	// destroy node
};
ClientJoint.prototype._createNode = function(factory){
	var nodes = [];
	nodes.push(factory(this.id + '-translate'));
	createAndMountNodes(nodes, this.id);
};
ClientJoint.prototype.setPosition = function(pos){
	mycs.superClass(ClientJoint).setPosition.apply(this, [pos]);
	setNodeXYZ(this.id + '-translate', this.pos);
};

function ClientEdgePoints(type){
	mycs.superClass(ClientEdgePoints).constructor.apply(this, [type]);
	this._createNode();
}
mycs.inherit(ClientEdgePoints, cs.EdgePoints);
ClientEdgePoints.prototype.destroy = function(){
	ASSERT(false);	// destroy node
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
ClientEdgePoints.prototype.setPosition = function(fromPos, toPos){
	mycs.superClass(ClientEdgePoints).setPosition.apply(this, [fromPos, toPos]);
	for (var i = 0; i < cs.EdgePoints.NUM; i++) {
		setNodeXYZ(this.id + '-' + i + '-translate', this.poss[i]);
	}
};

function ClientPlayer(id){
	this.type = 'player';
	this.id = id;
	var factory = {
		createJoint: function(type, player){
			return new ClientJoint(type, player);
		},
		createEdgePoints: function(type){
			return new ClientEdgePoints(type);
			
		}
	};
	mycs.superClass(ClientPlayer).constructor.apply(this, [factory]);
	field.addPiece(this, this.id);
}
mycs.inherit(ClientPlayer, cs.Player);
ClientPlayer.prototype.destroy = function(){
	ASSERT(false);	// todo: remove scene.js nodes
	field.removePiece(this.id);
};
ClientPlayer.prototype.updateLife = function(life){
	document.getElementById('life_bar_life').style.width = life * (100 / cs.Player.LIFE_MAX) + '%';
	if (life === 0 && !DEBUG) {
		displayMessage('You lose. Press F5 to retry.');
	}
};
ClientPlayer.prototype.updateBasePosition = function(){
	mycs.superClass(ClientPlayer).updateBasePosition.apply(this, []);
	setNodeXYZ('debug_cube-translate', this.basePos); 
};
ClientPlayer.prototype.updateEye = function(){
	var newPos = cs.calcRoatatePosition({x:0, y:this.angleY, z:0}, 20);
	var eye = SceneJS.withNode('player_eye');
	eye.set('eye', {x: this.basePos.x + newPos[0], y: 10, z: this.basePos.z + newPos[2]});
	eye.set('look', this.joints['HEAD'].pos);
};
ClientPlayer.prototype.turn = function(diff){
	mycs.superClass(ClientPlayer).turn.apply(this, [diff]);
};

var handleRemoteMessage = function(data){
	remotePacketCounter.count(function(pps){
		document.getElementById('packet_per_second_from_remote').innerHTML = pps + ' Packets / Second from remote';
	});
	var bullet, enemy, player;
	switch (data.type) {
	case 'create_your_player':
		player = new ClientPlayer(data.arg.id);
		playerId = player.id;
		break;
	case 'kinect_joint_postion':
		player = field.getPiece(data.arg.id);
		if (!player) {
			return;
		}
		for (var i = 0, len = data.arg.positions.length; i < len; i++) {
			player.setJointPosition(data.arg.positions[i]);
		}
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
		player.updateEye();
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
		default:
			ASSERT(false);
			break;
		}
		break;
	case 'destroy':
		switch(data.arg.type){
		case 'enemy':
			enemy = field.getPiece(data.arg.id);
			if (enemy) {
				enemy.destroy();
			}
			break;
		case 'bullet':
			bullet = field.getPiece(data.arg.id);
			if (bullet) {
				bullet.destroy();
			}
			break;
		default:
			ASSERT(false);
			break;
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

function handleDeviceMessage(data){
	devicePacketCounter.count(function(pps){
		document.getElementById('packet_per_second_from_device').innerHTML = pps + ' Packets / Second from device';
	});
	if (data.type === 'kinect_joint_postion') {
		if (playerId === -1) {
			remoteProxy.send({
				type: 'create_player_request',
				arg: {
					id: myEnemyId
				}
			});
		
		} else {
			remoteProxy.send(data);
		}
	}
}

function render() {
	fpsCounter.count(function(fps){
		document.getElementById('fps').innerHTML = fps + ' / ' + FPS + ' fps (Exclude Event\'s update)';
		if (DEBUG) {
			/*
			var object_count = 0;
			for (var k in field._idMap) {
				object_count++;
			}
			document.getElementById('output').innerHTML = object_count;
			*/
		}
	});
	SceneJS.withNode("the-scene").render();
}

function handleLoad(e){
	fpsCounter = new mycs.XPSCounter();
	remotePacketCounter = new mycs.XPSCounter();
	devicePacketCounter = new mycs.XPSCounter();
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
	deviceProxy = new myc.SocketIoProxy(
		cs.DEVICE_PORT,
		function(){
			LOG('device proxy open');
		},
		handleDeviceMessage,
		function(){
			LOG('device proxy close');
		},
		'127.0.0.1'
	);
	remoteProxy = new myc.SocketIoProxy(
		cs.REMOTE_PORT,
		function(){
			LOG('remote proxy open');
		},
		handleRemoteMessage,
		function(){
			LOG('remote proxy close');
		}
	);

	setInterval(function(){ render(); }, 1000 / FPS);
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
	case KeyEvent.DOM_VK_RIGHT:	// todo: update remote angle y
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

})();

