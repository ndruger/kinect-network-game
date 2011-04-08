/*global DP, io, cs, SceneJS, ASSERT, DPD, LOG, BlenderExport, myModules, KeyEvent */
/*global Enemy */
(function(){
var cs = myModules.cs;
var mycs = myModules.csmy;
var myc = myModules.cmy;

var DEBUG = true;
var isViewerMode = true;

var kinect_proxy, remote_proxy, field, player, fpsCounter, packetCounter, myEnemyId;

var FPS = 60;
var jointBaseY = 0;

var SCALE = 0.008;
var EYE_Z = -70;	// todo: check SCALE
var LOOK_AT_EYE = { x: 0.0, y: 10, z: EYE_Z };
var ID_SIZE = 10;

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

function Field(aspect){
	this._idMap = {};

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
				/*
				{
		            type: "cube",	// base cube
					xSize: 0.1,
					ySize : 0.1,
					zSize : 0.1
				},
				*/
				{
					type: "node",
					id: "mount-node"
				}]
			}]
		}]
	});
}
Field.prototype.getPiece = function(id){
	return this._idMap[id];
};
Field.prototype.addPiece = function(piece, id){
	ASSERT(!this._idMap[id]);
	this._idMap[id] = piece;
};
Field.prototype.removePiece = function(id){
	ASSERT(this._idMap[id]);
	delete this._idMap[id];
};
Field.prototype.getPiecesByType = function(type){
	var pieces = [];
	for (var id in this._idMap) {
		var piece = this._idMap[id];
		if (piece.type === type) {
			pieces.push(piece);
		}
	}
	return pieces;
};

function Piece(point, type, oid){
	if (typeof oid != 'undefined') {
		this.id = oid;
	} else {
		this.id = type + mycs.createId(ID_SIZE);
	}
	this.pos = point;
	this.type = type;
	field.addPiece(this, this.id);
}
Piece.prototype.destroy = function(){
	field.removePiece(this.id);
	SceneJS.Message.sendMessage({
		command: "update",
		target: 'mount-node',
		remove: {
			node: this.id
		}
	});
};
Piece.prototype._createNode = function(node){
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
Piece.prototype.updateScale = function(x, y, z) {
	var scale = SceneJS.withNode(this.id + '-scale');
	scale.set('x', x);	
	scale.set('y', y);	
	scale.set('z', z);
};
Piece.prototype.updatePosition = function(pos) {
	this.pos = pos;
	setNodeXYZ(this.id + '-translate', this.pos);
};

function Bullet(point, id, owner_type){
	mycs.superClass(Bullet).constructor.apply(this, [point, 'bullet', id]);
	this.ownerType = owner_type;
	this._createNode();
}
mycs.inherit(Bullet, Piece);
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
mycs.inherit(Enemy, Piece);
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
Enemy.prototype.checkCollision = function(pos, r){
	if (cs.isOverlapped(this.pos, cs.ENEMY_SIZE, pos, r)) {
		return true;
	}
	return false;
};
Enemy.prototype.setDamege = function(damege){
	this.destroy();
	var enemies = field.getPiecesByType('enemy');
	if (enemies.length === 0) {
		displayMessage('You win.');
	}
};

function Joint(type, player){
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
					xSize: Joint.H_SIZE,
					ySize: Joint.H_SIZE,
					zSize: Joint.H_SIZE
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
	                    x: Joint.SIELD_H_SIZE,
	                    y: Joint.SIELD_H_SIZE,
	                    z: 0.1,
	                    nodes: [{
	                    	type: "cube"
	                    }]
		            }]
			    }]
			}]
		};
	}

	this.type = type;
	this.pos = null;
	this.id = this.type + mycs.createId(ID_SIZE);

	if (this.type === 'LEFT_HAND') {
		this.harfSize =  Joint.SIELD_H_SIZE;
		this._createNode(createShield);
	} else {
		this.harfSize =  Joint.H_SIZE;
		this._createNode(createEdge);
	}
	
}
Joint.H_SIZE = 0.3;
Joint.SIELD_H_SIZE = 1.5;
Joint.types = [
	'HEAD',
	'NECK',
	'LEFT_SHOULDER',
	'RIGHT_SHOULDER', 
	'LEFT_ELBOW',
	'RIGHT_ELBOW',
	'LEFT_HAND',
	'RIGHT_HAND',	
	'TORSO',
	'LEFT_HIP',
	'RIGHT_HIP',	
	'LEFT_KNEE',
	'RIGHT_KNEE',
	'LEFT_FOOT',
	'RIGHT_FOOT'
];
Joint.prototype.destroy = function(){
	ASSERT(false);	// destroy node
};
Joint.prototype._createNode = function(factory){
	var nodes = [];

	nodes.push(factory(this.id + '-translate'));

	createAndMountNodes(nodes, this.id);
};
Joint.prototype.setPosition = function(pos){
	this.pos = pos;
	setNodeXYZ(this.id + '-translate', this.pos);
};
Joint.prototype.checkCollision = function(pos, r){
	if (!this.pos) {
		return false;
	}
	if (cs.isOverlapped(this.pos, this.harfSize, pos, r)) {
		return true;
	}
	return false;
};
Joint.prototype.getPosition = function(){
	var node = SceneJS.withNode(this.id + '-translate');
	return {x: node.get('x'), y: node.get('y'), z: node.get('z')};
};

function EdgePoints(type){
	this.type = type;
	this.poss = [];
	this.id = this.type + mycs.createId(ID_SIZE);
	this._createNode();
}
EdgePoints.types = [
	'HEAD-NECK',
	'NECK-LEFT_SHOULDER',
	'LEFT_SHOULDER-LEFT_ELBOW',
	'LEFT_ELBOW-LEFT_HAND',
	'NECK-RIGHT_SHOULDER',
	'RIGHT_SHOULDER-RIGHT_ELBOW',
	'RIGHT_ELBOW-RIGHT_HAND',
	'LEFT_SHOULDER-TORSO',
	'RIGHT_SHOULDER-TORSO',
	'TORSO-LEFT_HIP',
	'LEFT_HIP-LEFT_KNEE',
	'LEFT_KNEE-LEFT_FOOT',
	'TORSO-RIGHT_HIP',
	'RIGHT_HIP-RIGHT_KNEE',
	'RIGHT_KNEE-RIGHT_FOOT',
	'LEFT_HIP-RIGHT_HIP'
];
EdgePoints.H_SIZE = 0.05;
EdgePoints.NUM = 2;
EdgePoints.prototype.destroy = function(){
	ASSERT(false);	// destroy node
};
EdgePoints.prototype._createNode = function(){
	var nodes = [];
	for (var i = 0; i < EdgePoints.NUM; i++) {
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
					xSize: EdgePoints.H_SIZE,
					ySize : EdgePoints.H_SIZE,
					zSize : EdgePoints.H_SIZE
				}]
			}]
		});
	}
	createAndMountNodes(nodes, this.id);
};
EdgePoints.prototype.setPosition = function(index, pos){
	this.poss[index] = pos;
	setNodeXYZ(this.id + '-' + index + '-translate', pos);
};
EdgePoints.prototype.checkCollision = function(pos, r){
	for (var i = 0; i < EdgePoints.NUM; i++) {
		if (this.poss[i]) {
			if (cs.isOverlapped(this.poss[i], EdgePoints.H_SIZE, pos, r)) {
				return true;
			}
		}
	}
	return false;
};

function Player(){
	this.id = 'player';
	this.life = Player.LIFE_MAX;

	this.joints = {};
	var len = Joint.types.length;
	for (var i = 0; i < len; i++) {
		var type = Joint.types[i];
		this.joints[type] = new Joint(type, this);
	}
	this.edge_points = {};
	len = EdgePoints.types.length;
	for (i = 0; i < len; i++) {
		type = EdgePoints.types[i];
		this.edge_points[type] = new EdgePoints(type);
	}
}
Player.prototype.destroy = function(){
	ASSERT(false);	// todo: remove scene.js nodes
};
Player.LIFE_MAX = 200;
Player.prototype.getRandomJointPosition = function(){
	return this.joints[Joint.types[Math.floor(Math.random() * Joint.types.length)]].pos;
};

Player.prototype.checkShieldCollision = function(pos, r){
	return this.joints['LEFT_HAND'].checkCollision(pos, r);
};

Player.prototype.checkDamageCollision = function(pos, r){
	for (var k in this.joints) {
		if (k === 'LEFT_HAND') {	// todo: 'shield' attribute must be attribute of each joint.
			continue;
		}
		var joint = this.joints[k];
		if (joint.checkCollision(pos, r)) {
			return true;
		}
	}
	for (k in this.edge_points) {
		var edge_point = this.edge_points[k];
		if (edge_point.checkCollision(pos, r)) {
			return true;
		}
	}
	return false;
};
Player.prototype.updateLife = function(life){
	document.getElementById('life_bar_life').style.width = life * (100 / Player.LIFE_MAX) + '%';
	if (life === 0 && !DEBUG) {
		displayMessage('You lose. Press F5 to retry.');
	}
};

var oldFootY = {
	LEFT_FOOT: 0,
	RIGHT_FOOT: 0
};

var handleRemoteMessage = function(data){
	packetCounter.count(function(pps){
		document.getElementById('packet_per_second').innerHTML = pps + ' Packets / Second';
	});
	var bullet, enemy;
	switch (data.type) {
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
	case 'joint_pos':
		player.joints[data.arg.type].setPosition(data.arg.pos);
		break;
	case 'edge_point_pos':
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
	packetCounter = new mycs.XPSCounter();
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
	
	field = new Field(canvas.width / canvas.height);
	player = new Player();
	kinect_proxy = new myc.SocketIoProxy(
		cs.DEVICE_PORT,
		function(){
			LOG('device proxy open');
		},
		function(message){
			remote_proxy.send(message);
		},
		function(){
			LOG('device proxy close');
		},
		'127.0.0.1'
	);
	remote_proxy = new myc.SocketIoProxy(
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
		SceneJS.withNode('player_eye').set('eye', LOOK_AT_EYE);
		e.preventDefault();
		break;
	case KeyEvent.DOM_VK_SPACE:
		if (field.getPiece(myEnemyId)) {
			remote_proxy.send({
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

