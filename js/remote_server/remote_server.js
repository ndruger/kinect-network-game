/*global require, process */
/*global Enemy */
var http = require('http');
var sys = require('sys');
var fs = require('fs');
var mycs = require('../lib/my/my_client_and_server');
var mys = require('../lib/my/my_server');
var cs = require('../client_and_server/client_and_server');
var ASSERT = mycs.ASSERT;
var DP = mycs.DP;

var DEBUG = false;
var ID_SIZE = 10;
var field, player, proxy;
var jointBaseY = 0;

function Field(){
	this._idMap = {};
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
Field.prototype.initEnemies = function(){
	for (var i = 0; i < 10; i++) {
		var x = Math.random() * 50 - 25;
		var y = cs.ENEMY_SIZE / 2 - 1;
		var z = -40 + (Math.random() * 30 - 15);
		new Enemy({x: x, y: y, z: z}, true);
	}
};
Field.prototype.sendMap = function(conn){
	for (var id in this._idMap) {
		this._idMap[id].sendMap(conn);
	}
};

function Piece(point, type){
	this.id = type + mycs.createId(ID_SIZE);
	this.pos = point;
	this.type = type;
	field.addPiece(this, this.id);
}
Piece.prototype.destroy = function(){
	field.removePiece(this.id);
	proxy.broadcast(this.makeSendData('destroy', {
		type: this.type,
		id: this.id
	}));
};
Piece.prototype.updatePosition = function(pos) {
	this.pos = pos;
	proxy.broadcast(this.makeSendData('update_position', {
		type: this.type,
		id: this.id,
		pos: this.pos
	}));
};
Piece.prototype.sendMap = function(conn){
	proxy.send(conn, this.makeSendData('send_map', {
		type: this.type,
		id: this.id,
		pos: this.pos
	}));
};
Piece.prototype.makeSendData = function(action_type, arg_o){
	return {
		type: action_type,
		arg: arg_o
	};
};

function MovableObject(point, type, speed, handle_dir){
	mycs.superClass(MovableObject).constructor.apply(this, [point, type]);
	this.handleDir = handle_dir;
	this.speed = speed;
	var self = this;
	this.moveTimer = setInterval(function(){
		var new_pos = {};
		new_pos.x = self.pos.x + self.handleDir.x * self.speed;
		new_pos.y = self.pos.y + self.handleDir.y * self.speed;
		new_pos.z = self.pos.z + self.handleDir.z * self.speed;
		var old_pos = mycs.deepCopy(self.pos);
		self.updatePosition(new_pos);
		if(!self.moving(old_pos)) {
			clearInterval(self.moveTimer);
			self.moveTimer = -1;
		}
	}, MovableObject.TIMER_INTERVAL); 
}
MovableObject.TIMER_INTERVAL = 100;
mycs.inherit(MovableObject, Piece);
MovableObject.prototype.destroy = function(){
	if (this.moveTimer !== -1) {
		clearInterval(this.moveTimer);
	}
	mycs.superClass(MovableObject).destroy.apply(this, []);
};
MovableObject.prototype.moving = function(old_pos){
	return true;
};

function Bullet(point, speed, handle_dir, owner_type){
	mycs.superClass(Bullet).constructor.apply(this, [point, 'bullet', speed, handle_dir]);
	this.ownerType = owner_type;

	var s = this.makeSendData('create', {
		type: this.type,
		id: this.id,
		pos: this.pos,
		ownerType: this.ownerType
	});
	proxy.broadcast(s);
}
mycs.inherit(Bullet, MovableObject);
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
Bullet.calcDir = function(start, end, vibration){	// todo: fix to use angle as direction
	ASSERT(0 <= vibration && vibration <= 1);
	var normalized = cs.normalize({
		x: end.x - start.x,
		y: end.y - start.y,
		z: end.z - start.z
	});
	if (vibration !== 0) {
		normalized.x += Math.floor(Math.random() * (vibration * 100)) / 100 - vibration / 2;
		normalized.y += Math.floor(Math.random() * (vibration * 100)) / 100 - vibration / 2;
		normalized.z += Math.floor(Math.random() * (vibration * 100)) / 100 - vibration / 2;
	}
	return normalized;
};
Bullet.POWER = 10;
Bullet.prototype.moving = function(old_pos){
	mycs.superClass(Bullet).moving.apply(this, []);
	var r = Bullet.type[this.ownerType].r;
	if (this.pos.x + r * 2 < -cs.FIELD_X_WIDTH / 2 || this.pos.x - r * 2 > cs.FIELD_X_WIDTH / 2 ||
		this.pos.y + r * 2 < 0 || this.pos.y - r * 2 > cs.FIELD_Y_WIDTH ||
		this.pos.z + r * 2 < -cs.FIELD_Z_WIDTH / 2 || this.pos.z - r * 2 > cs.FIELD_Z_WIDTH / 2) {
		this.destroy();
		return false;
	}
	if (this.ownerType === 'enemy') {
		if (player.checkShieldCollision(this.pos, Bullet.type[this.ownerType].r)) {
			this.destroy();
			return false;
		}
		if (player.checkDamageCollision(this.pos, Bullet.type[this.ownerType].r)) {
			player.setDamege(Bullet.POWER);
			this.destroy();
			return false;
		}
	} else {
		ASSERT(this.ownerType === 'player');
		var enemies = field.getPiecesByType('enemy');
		var len = enemies.length;
		for (var i = 0; i < len; i++) {
			var enemy = enemies[i];
			if (enemy.checkCollision(this.pos, Bullet.type[this.ownerType].r)) {
				enemy.setDamege(Bullet.POWER);
				this.destroy();
				return false;
			}
		}
	}
	return true;
};
Bullet.prototype.sendMap = function(conn){
	proxy.send(conn, this.makeSendData('send_map', {
		type: this.type,
		id: this.id,
		pos: this.pos,
		ownerType: this.ownerType
	}));
};

function Enemy(point, is_debug_enemy, oclient){
	mycs.superClass(Enemy).constructor.apply(this, [point, 'enemy']);
	var self = this;
	var s;
	if (typeof oclient != 'undefined') {
		proxy.send(oclient, {
			type: 'bind_enemy',
			arg: {id: this.id}
		});
		oclient.enemyId = this.id;
	}
	proxy.broadcast(this.makeSendData('create', {
		type: this.type,
		id: this.id,
		pos: this.pos
	}));
	if (is_debug_enemy) {
		this.throwTimer = setInterval(function(){
			if (Math.floor(Math.random() * 10) !== 1) {
				return;
			}
			self.createBullet();
		}, 2000);
	//	}, 100);
	} else {
		this.throwTimer = -1;
	}
}
mycs.inherit(Enemy, Piece);
Enemy.prototype.createBullet = function(){
	var player_pos = player.getRandomJointPosition();
	if (!player_pos) {
		return;
	}
	var VIBRATION = 0.04;
	var dir = Bullet.calcDir(this.pos, player_pos, VIBRATION);
	new Bullet(this.pos, 2, dir, 'enemy');
};
Enemy.X_ANGLE_BASE = 270.0;
Enemy.prototype.destroy = function(){
	if (this.throwTimer !== -1) {
		clearInterval(this.throwTimer);
	}
	mycs.superClass(Enemy).destroy.apply(this, []);
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
};

function Joint(type, player){
	this.type = type;
	this.pos = null;
	this.id = this.type + mycs.createId(ID_SIZE);
}
Joint.H_SIZE = 0.3;
Joint.LEFT_SIELD_H_SIZE = 1.5;
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
	ASSERT(false);	// release index, destroy node
};
Joint.prototype.setPosition = function(pos){
	this.pos = pos;
	proxy.broadcast({
		type: 'joint_pos',
		arg: {
			type: this.type,
			pos: this.pos
		}
	});
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
	return this.pos;
};

function EdgePoints(type){
	this.type = type;
	this.poss = [];
	this.id = this.type + mycs.createId(ID_SIZE);
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
	ASSERT(false);	// release index, destroy node
};
EdgePoints.calcPosition = function(from_pos, to_pos, index){
	return {
		x: from_pos.x + (to_pos.x - from_pos.x) / (EdgePoints.NUM + 1) * (index + 1),
		y: from_pos.y + (to_pos.y - from_pos.y) / (EdgePoints.NUM + 1) * (index + 1),
		z: from_pos.z + (to_pos.z - from_pos.z) / (EdgePoints.NUM + 1) * (index + 1)
	};
};
EdgePoints.prototype.setPosition = function(from_pos, to_pos){
	for (var i = 0; i < EdgePoints.NUM; i++) {
		var pos = EdgePoints.calcPosition(from_pos, to_pos, i);
		this.poss[i] = pos;
		proxy.broadcast({
			type: 'edge_point_pos',
			arg: {
				type: this.type,
				pos: this.poss[i],
				index: i
			}
		});
	}
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

// todo: refactoring
function GestureManager(player){
	this.player = player;
	this.positionSnapshots = [];
	this.twistArm = {left: false, right: false};
	var self = this;
	this.timer = setInterval(function(){
		self.storeSnapShot();
		self.DetectAction();
	}, GestureManager.INTERVAL);
}
GestureManager.INTERVAL = 100;
GestureManager.SNAPSHOT_NUM_MAX = 30;
GestureManager.prototype.destroy = function(){
	if (this.timer !== -1) {
		clearInterval(this.timer);
	}
};
GestureManager.prototype.storeSnapShot = function(){
	var len = Joint.types.length;
	var snapshot = {};
	for (var i = 0; i < len; i++) {
		var id = Joint.types[i];
		var joint = this.player.joints[id];
		if (joint.pos) {
			snapshot[joint.type] = mycs.deepCopy(joint.pos);
		}
	}
	this.positionSnapshots.push(snapshot);
	if (this.positionSnapshots.length > GestureManager.SNAPSHOT_NUM_MAX) {
		this.positionSnapshots.shift();
	}
	ASSERT(this.positionSnapshots.length <= GestureManager.SNAPSHOT_NUM_MAX);
};
GestureManager.prototype.DetectAction = function(){
	var self = this;
	function checkStraightArm(shoulder, hand, old_hand, elbow, dir){
		var angle = cs.calcAngle(shoulder, hand, elbow);
		if (angle >= 150) {
			if (self.twistArm[dir] === true) {
				var speed = cs.calcDistance(hand, old_hand);
				self.twistArm[dir] = false;
				var bulletDir = Bullet.calcDir(shoulder, hand, 0);
				new Bullet(hand, speed * 4, bulletDir, 'player');
			}
		} else if (angle <= 90) {
			self.twistArm[dir] = true;
		}
	}
	
	if (self.positionSnapshots.length === 0) {
		return;
	}
	var snapshot = self.positionSnapshots[self.positionSnapshots.length - 1];
	var old_snapshot3 = self.positionSnapshots[self.positionSnapshots.length - 3];
	if (!snapshot || !old_snapshot3) {
		return;
	}
	if (snapshot['RIGHT_SHOULDER'] && snapshot['RIGHT_HAND'] && snapshot['RIGHT_ELBOW'] && old_snapshot3['RIGHT_HAND']) {
		checkStraightArm(snapshot['RIGHT_SHOULDER'], snapshot['RIGHT_HAND'], old_snapshot3['RIGHT_HAND'], snapshot['RIGHT_ELBOW'], 'right');
	}
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
	this._gestureManager = new GestureManager(this);
}
Player.prototype.destroy = function(){
	ASSERT(false);	// todo: remove scene.js nodes
	this._gestureManager.destroy();
};
Player.LIFE_MAX = 200;
Player.prototype.setJointPosition = function(update){
	this.joints[update.from.name].setPosition(update.from);
	this.joints[update.to.name].setPosition(update.to);
	this.edge_points[update.from.name + '-' + update.to.name].setPosition(update.from, update.to);
};
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
Player.prototype.setDamege = function(damege){
	this.life -= damege;
	this.life = (this.life < 0) ? 0: this.life;
	proxy.broadcast({
		type: 'update_life',
		arg: {
			life: this.life
		}
	});
};

var oldFootY = {
	LEFT_FOOT: 0,
	RIGHT_FOOT: 0
};

var handleMessage = function(data){
	switch (data.type) {
	case 'kinect_joint_postion':
		data.arg.from.x *= cs.SCALE; data.arg.from.y *= cs.SCALE;	data.arg.from.z *= cs.SCALE;
		data.arg.to.x *= cs.SCALE; data.arg.to.y *= cs.SCALE;	data.arg.to.z *= cs.SCALE;
		
		if (data.arg.to.name === 'LEFT_FOOT' || data.arg.to.name === 'RIGHT_FOOT') {
			oldFootY[data.arg.to.name] = data.arg.to.y;
		}
		jointBaseY = -Math.min(oldFootY['LEFT_FOOT'] - Joint.H_SIZE, oldFootY['RIGHT_FOOT'] - Joint.H_SIZE);
	
		data.arg.from.y += jointBaseY;
		data.arg.to.y += jointBaseY;
		player.setJointPosition(data.arg);
		break;
	case 'bullet':
		var enemy = field.getPiece(data.arg.id);
		if (enemy) {
			enemy.createBullet();
		}
		break;
	}
};

proxy = new mys.SocketIoProxy(cs.REMOTE_PORT, function(client){
		DP('connected');
		field.sendMap(client);
		client.enemyId = -1;
		var x = Math.random() * 40 - 20;
		var y = cs.ENEMY_SIZE / 2 - 1;
		var z = -40;
		new Enemy({x: x, y: y, z: z}, false, client);
	}, handleMessage, function(client){
		DP('disconnected');
		if (client.enemyId != -1) {
			var enemy = field.getPiece(client.enemyId);
			if (enemy) {
				enemy.destroy();
			}
		}
	}
);

field = new Field();
if (DEBUG) {
	field.initEnemies();
}
player = new Player();
