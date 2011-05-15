/*global require, process, global, JSON */
/*global DP, LOG, ASSERT, DIR, DPD */
/*global Enemy */
var http = require('http');
var sys = require('sys');
var fs = require('fs');
var mycs = require('../lib/my/my_client_and_server');
var mys = require('../lib/my/my_server');
var cs = require('../client_and_server/client_and_server');
var ASSERT = mycs.ASSERT;
mycs.setShorthands(global);

var DEBUG = false;
var field, proxy, bindManager, controllerProxy, clientCount = 0;

function getClientID(client){	// todo fix for websocket and move to my_server.js
	return client.sessionId;
}

var playerInitialValues = [
	{angleY: 0, basePos: {x: 0, y: 0, z: 20}},
	{angleY: 180, basePos: {x: 0, y: 0, z: -20}}
];

// Bind Manager
function BindManager(){
	this.nobindMainBrowsers = {};
	this.nobindControllers = {};	// todo: object is better for remove/add wrapping
	this.boundMainBrowsers = {};	// key is controller id
	this.boundControllers = {};	// key is main browser id
}
BindManager.prototype.addMainBrowser = function(in_conn){
	LOG('BindManager.prototype.addMainBrowser');
	this.nobindMainBrowsers[getClientID(in_conn)] = in_conn;
	this._sendControllerList(this.nobindMainBrowsers[getClientID(in_conn)]);
};
BindManager.prototype.removeMainBrowser = function(in_conn){
	LOG('BindManager.prototype.removeMainBrowser');
	delete this.nobindMainBrowsers[getClientID(in_conn)];
	
	var bound_controller = this.boundControllers[getClientID(in_conn)]; 
	if (bound_controller) {
		this.nobindControllers[getClientID(bound_controller)] =  bound_controller;
		delete this.boundMainBrowsers[getClientID(bound_controller)];
		delete this.boundControllers[getClientID(in_conn)];
	}
	this._broadcastControllerList();
};
BindManager.prototype.addController = function(in_conn){
	LOG('BindManager.prototype.addController');
		this.nobindControllers[getClientID(in_conn)] = in_conn;
	this._broadcastControllerList();
};
BindManager.prototype.removeController = function(in_conn){
	LOG('BindManager.prototype.removeController');
	delete this.nobindControllers[getClientID(in_conn)];
	var bound_main_browser = this.boundMainBrowsers[getClientID(in_conn)]; 
	if (bound_main_browser) {
		this.nobindMainBrowsers[getClientID(bound_main_browser)] =  bound_main_browser;
		delete this.boundControllers[getClientID(bound_main_browser)];
		delete this.boundMainBrowsers[getClientID(in_conn)];
	}
	this._broadcastControllerList();
};
BindManager.prototype._sendControllerList = function(in_conn){
	this._sendControllerListImp(in_conn);
};
BindManager.prototype._broadcastControllerList = function(){
	this._sendControllerListImp();
};
BindManager.prototype._sendControllerListImp = function(oin_conn){
	LOG('BindManager.prototype._sendControllerListImp');
	var id_list = [];
	for (var k in this.nobindControllers) {
		id_list.push(getClientID(this.nobindControllers[k]));
	}
	LOG('BindManager.prototype._sendControllerListImp: list: ' + id_list);
	var mes = {type: 'controller_list', arg:{list: id_list}};
	if (oin_conn) {
		proxy.send(oin_conn, mes);
	} else {
		for (k in this.nobindMainBrowsers) {
			proxy.send(this.nobindMainBrowsers[k], mes);
		}
	}
};
BindManager.prototype.bind = function(in_main_browser_conn, in_controller_id){
	delete this.nobindMainBrowsers[getClientID(in_main_browser_conn)];
	var controller = this.nobindControllers[in_controller_id];
	delete this.nobindControllers[in_controller_id];
	this.boundMainBrowsers[in_controller_id] = in_main_browser_conn;
	this.boundControllers[getClientID(in_main_browser_conn)] = controller;
	this._broadcastControllerList();
};
BindManager.prototype.getBindedMainBrowser = function(in_controller_id){
	var found = this.boundMainBrowsers[in_controller_id];
	if (found) {
		return found;
	} else {
		return null;
	}
};

function ServerField(){
	mycs.superClass(ServerField).constructor.apply(this, []);
}
mycs.inherit(ServerField, cs.Field);
ServerField.prototype.initEnemies = function(){
	for (var i = 0; i < 10; i++) {
		var x = Math.random() * 50 - 25;
		var y = cs.ENEMY_SIZE / 2 - 1;
		var z = -40 + (Math.random() * 30 - 15);
		new Enemy({x: x, y: y, z: z}, true);
	}
};
ServerField.prototype.sendMap = function(conn){
	for (var id in this._pieces) {
		this._pieces[id].sendMap(conn);
	}
};

function Unit(point, type){
	this.id = type + mycs.createId(cs.ID_SIZE);
	this.pos = point;
	this.type = type;
	field.addPiece(this, this.id);
}
Unit.prototype.destroy = function(){
	field.removePiece(this.id);
	proxy.broadcast(this.makeSendData('destroy', {
		type: this.type,
		id: this.id
	}));
};
Unit.prototype.updatePosition = function(pos) {
	this.pos = pos;
	proxy.broadcast(this.makeSendData('update_position', {
		type: this.type,
		id: this.id,
		pos: this.pos
	}));
};
Unit.prototype.sendMap = function(conn){
	proxy.send(conn, this.makeSendData('send_map', {
		type: this.type,
		id: this.id,
		pos: this.pos
	}));
};
Unit.prototype.makeSendData = function(action_type, arg_o){
	return {
		type: action_type,
		arg: arg_o
	};
};

function MovableObject(point, type, speed, handleDir){
	mycs.superClass(MovableObject).constructor.apply(this, [point, type]);
	this.handleDir = handleDir;
	this.speed = speed;
	var self = this;
	this.moveTimer = setInterval(function(){	// todo: very fool. use main loop.
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
mycs.inherit(MovableObject, Unit);
MovableObject.prototype.destroy = function(){
	if (this.moveTimer !== -1) {
		clearInterval(this.moveTimer);
	}
	mycs.superClass(MovableObject).destroy.apply(this, []);
};
MovableObject.prototype.moving = function(old_pos){
	return true;
};

function Bullet(point, speed, handleDir, ownerType, ownerId){
	mycs.superClass(Bullet).constructor.apply(this, [point, 'bullet', speed, handleDir]);
	this.ownerType = ownerType;
	this.ownerId = ownerId;
	this.r = Bullet.type[this.ownerType].r;

	var s = this.makeSendData('create', {
		type: this.type,
		id: this.id,
		pos: this.pos,
		ownerType: this.ownerType,
		ownerId: this.ownerId,
		r: this.r
	});
	proxy.broadcast(s);
}
mycs.inherit(Bullet, MovableObject);
Bullet.type = {
	enemy: {
		r: cs.ENEMY_BULLET_R
	},
	player: {
		r: cs.PLAYER_BULLET_R
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
Bullet.POWER = 20;
Bullet.prototype.moving = function(old_pos){
	mycs.superClass(Bullet).moving.apply(this, []);
	var r = this.r;
	if (this.pos.x + r * 2 < -cs.FIELD_X_WIDTH / 2 || this.pos.x - r * 2 > cs.FIELD_X_WIDTH / 2 ||
		this.pos.y + r * 2 < 0 || this.pos.y - r * 2 > cs.FIELD_Y_WIDTH ||
		this.pos.z + r * 2 < -cs.FIELD_Z_WIDTH / 2 || this.pos.z - r * 2 > cs.FIELD_Z_WIDTH / 2) {
		this.destroy();
		return false;
	}
	var palyers = field.getPiecesByType('player');
	for (var j = 0, jLen = palyers.length; j < jLen; j++) {
		var player = palyers[j];
		if (this.ownerType === 'enemy' || (this.ownerType === 'player' && this.ownerId !== player.id)) {
			if (player.checkShieldCollision(this.pos, this.r)) {
				this.destroy();
				return false;
			}
			if (player.checkDamageCollision(this.pos, this.r)) {
				player.setDamege(Bullet.POWER);
				this.explode();
				this.destroy();
				return false;
			}
		}
		if (this.ownerType === 'player') {
			var enemies = field.getPiecesByType('enemy');
			var len = enemies.length;
			for (var i = 0; i < len; i++) {
				var enemy = enemies[i];
				if (enemy.checkCollision(this.pos, this.r)) {
					enemy.setDamege(Bullet.POWER);
					this.explode();
					this.destroy();
					return false;
				}
			}
		}
	}
	return true;
};
Bullet.prototype.explode = function(){
	proxy.broadcast(this.makeSendData('explode', {
		pos: this.pos,
		firstR: this.r
	}));
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
mycs.inherit(Enemy, Unit);
Enemy.prototype.createBullet = function(){
	var palyers = field.getPiecesByType('player');
	var player = palyers[Math.floor(Math.random() * palyers.length)];
	
	var player_pos = player.getRandomServerJointPosition();
	if (!player_pos) {
		return;
	}
	var VIBRATION = 0.04;
	var dir = Bullet.calcDir(this.pos, player_pos, VIBRATION);
	new Bullet(this.pos, 2, dir, 'enemy', this.id);
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

function ServerJoint(type, player){
	mycs.superClass(ServerJoint).constructor.apply(this, [type, player]);
}
mycs.inherit(ServerJoint, cs.Joint);
ServerJoint.prototype.checkCollision = function(pos, r){
	if (!this.pos) {
		return false;
	}
	if (cs.isOverlapped(this.pos, this.harfSize, pos, r)) {
		return true;
	}
	return false;
};

function ServerEdgePoints(type){
	mycs.superClass(ServerEdgePoints).constructor.apply(this, [type]);
}
mycs.inherit(ServerEdgePoints, cs.EdgePoints);
ServerEdgePoints.prototype.checkCollision = function(pos, r){
	for (var i = 0; i < cs.EdgePoints.NUM; i++) {
		if (this.poss[i]) {
			if (cs.isOverlapped(this.poss[i], cs.EdgePoints.H_SIZE, pos, r)) {
				return true;
			}
		}
	}
	return false;
};

// todo: refactoring & move to client.js
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
	var len = cs.Joint.types.length;
	var snapshot = {};
	for (var i = 0; i < len; i++) {
		var id = cs.Joint.types[i];
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
				new Bullet(hand, speed * 2, bulletDir, 'player', self.player.id);
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

function ServerPlayer(client, opt_basePos, opt_angleY){
	var factory = {
		createJoint: function(type, player){
			return new ServerJoint(type, player);
		},
		createEdgePoints: function(type){
			return new ServerEdgePoints(type);
			
		}
	};
	mycs.superClass(ServerPlayer).constructor.apply(this, [factory, opt_basePos, opt_angleY]);
	this.type = 'player';
	this.id = this.type + mycs.createId(cs.ID_SIZE);
	proxy.send(client, {
		type: 'set_player_id',
		arg: {
			id: this.id
		}
	});
	proxy.broadcast({
		type: 'create',
		arg: {
			type: this.type,
			id: this.id,
			basePos: opt_basePos,
			angleY: opt_angleY
		}
	});
	this._gestureManager = new GestureManager(this);
	field.addPiece(this, this.id);
	
}
mycs.inherit(ServerPlayer, cs.Player);
ServerPlayer.prototype.destroy = function(){
	this._gestureManager.destroy();
	field.removePiece(this.id);
	proxy.broadcast({
		type: 'destroy',
		arg: {
			type: this.type,
			id: this.id
		}
	});
};
ServerPlayer.prototype.sendMap = function(client){
	proxy.send(client, {
		type: 'send_map',
		arg: {
			id: this.id,
			type: this.type,
			basePos: this.basePos,
			angleY: this.angleY
		}
	});
};
ServerPlayer.prototype.getRandomServerJointPosition = function(){
	return this.joints[cs.Joint.types[Math.floor(Math.random() * cs.Joint.types.length)]].pos;
};

ServerPlayer.prototype.checkShieldCollision = function(pos, r){
	return this.joints['LEFT_HAND'].checkCollision(pos, r);
};

ServerPlayer.prototype.checkDamageCollision = function(pos, r){
	for (var k in this.joints) {
		if (k === 'LEFT_HAND') {	// todo: 'shield' attribute must be attribute of each joint.
			continue;
		}
		var joint = this.joints[k];
		if (joint.checkCollision(pos, r)) {
			return true;
		}
	}
	for (var i= 0, len = this.edgePoints.length; i < len; i++) {
		if (this.edgePoints[i].checkCollision(pos, r)) {
			return true;
		}
	}
	return false;
};
ServerPlayer.prototype.setDamege = function(damege){
	this.life -= damege;
	this.life = (this.life < 0) ? 0: this.life;
	proxy.broadcast({
		type: 'update_life',
		arg: {
			id: this.id,
			life: this.life
		}
	});
};
ServerPlayer.prototype.move = function(dir){
	var angle = this.angleY;
	if (dir === 'up') {
		angle -= 180;
	}
	var diff = cs.calcRoatatePosition({
		x: 0,
		y: angle,
		z: 0
	}, 2);
	mycs.superClass(ServerPlayer).setBasePosition.apply(this, [{
		x: this.basePos.x + diff[0],
		y: this.basePos.y + diff[1],
		z: this.basePos.z + diff[2]
	}]);
	proxy.broadcast({
		type: 'set_base_position',
		arg: {
			id: this.id,
			pos: this.basePos
		}
	});
};
ServerPlayer.prototype.turn = function(diff){
	mycs.superClass(ServerPlayer).turn.apply(this, [diff]);
	proxy.broadcast({
		type: 'turn',
		arg: {
			id: this.id,
			diff: diff
		}
	});
};

// todo: filter dirty packet
var handleMessage = function(data, client){
	var player;
	switch (data.type) {
	case 'binding_request':
		bindManager.bind(client, data.arg.id);
		break;
	case 'create_player_request':
		if (client.playerId) {
			return;
		}
		if (client.playerInitialValue) {
			player = new ServerPlayer(client, client.playerInitialValue.basePos, client.playerInitialValue.angleY);
		} else {
			player = new ServerPlayer(client);
		}
		client.playerId = player.id;
		break;
	case 'kinect_joint_postion':
		player = field.getPiece(client.playerId);
		if (!player) {
			return;
		}
		player.setJointPosition(data.arg.positions);
		data.arg.id = client.playerId;
		proxy.broadcastExceptFor(client, data);
		break;
	case 'bullet':
		var enemy = field.getPiece(client.enemyId);
		if (enemy) {
			enemy.createBullet();
		}
		break;
	case 'move_request':
		player = field.getPiece(client.playerId);
		if (!player) {
			return;
		}
		player.move(data.arg.dir);
		break;
	case 'turn':
		player = field.getPiece(client.playerId);
		if (!player) {
			return;
		}
		player.turn(data.arg.diff);
		break;
	}
};

proxy = new mys.SocketIoProxy(cs.REMOTE_PORT, function(client){
		LOG('client connected');
		clientCount++;
		field.sendMap(client);
		client.enemyId = -1;	// todo: use userdata
		var x = Math.random() * 40 - 20;
		var y = cs.ENEMY_SIZE / 2 - 1;
		var z = -40;
//		new Enemy({x: x, y: y, z: z}, false, client);
		bindManager.addMainBrowser(client);
		if (clientCount <= playerInitialValues.length) {
			client.playerInitialValue = playerInitialValues[clientCount - 1];
		}
	}, handleMessage, function(client){
		LOG('client disconnected');
		clientCount--;
		if (client.enemyId != -1) {
			var enemy = field.getPiece(client.enemyId);
			if (enemy) {
				enemy.destroy();
			}
		}
		if (client.playerId != -1) {
			bindManager.removeMainBrowser(client);
			var player = field.getPiece(client.playerId);
			if (player) {
				player.destroy();
			}
		}
	}
);

controllerProxy = new mys.SocketIoProxy(cs.CONTROLLER_PORT, function(client){
		LOG('controller connected');
		bindManager.addController(client);
	}, function(data, client){
		var browserClient = bindManager.getBindedMainBrowser(getClientID(client));
		if (!browserClient) {
			return;
		}
		var player;
		switch (data.type) {
		case 'switch_hmd_mode':
			proxy.send(browserClient, {
				type: 'switch_hmd_mode'
			});
			break;
		case 'move_request':
			player = field.getPiece(browserClient.playerId);
			if (!player) {
				return;
			}
			player.move(data.arg.dir);
			break;
		case 'turn':
			player = field.getPiece(browserClient.playerId);
			if (!player) {
				return;
			}
			player.turn(data.arg.diff);
			break;
		}
	}, function(client){
		LOG('controller disconnected');
		bindManager.removeController(client);
	}
);

field = new ServerField();
if (DEBUG) {
	field.initEnemies();
}

bindManager = new BindManager();

