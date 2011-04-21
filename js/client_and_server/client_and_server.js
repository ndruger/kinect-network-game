/*global exports, console, DP, JSON, mat4, ASSERT, myModules, require */
(function(){
if (typeof exports == 'undefined') {
	exports = {};
}
var mycs;
if (typeof myModules != 'undefined') {
	myModules.cs = exports;
	mycs = myModules.mycs;
} else {
	eval(require('fs').readFileSync('../client_and_server/lib/glMatrix-0.9.4.min.js', 'utf8'));
	mycs = require('../lib/my/my_client_and_server');
}
var ASSERT = mycs.ASSERT;
exports.REMOTE_PORT = 8761;
exports.DEVICE_PORT = 8869;
exports.FIELD_SIZE = 100;
exports.ENEMY_SIZE = 10;

exports.FIELD_X_WIDTH = 100.0;
exports.FIELD_Z_WIDTH = 100.0;
exports.FIELD_Y_WIDTH = 30.0;

var ID_SIZE = 10;
exports.ID_SIZE = ID_SIZE;

var SCALE = 0.008;
exports.SCALE = SCALE;

exports.calcRoatatePosition = function(angle, r){
	var modelView = mat4.create();
	
	mat4.identity(modelView);
	mat4.rotate(modelView, angle.x * (Math.PI / 180.0), [1, 0, 0]);
	mat4.rotate(modelView, angle.y * (Math.PI / 180.0), [0, 1, 0]);
	mat4.rotate(modelView, angle.z * (Math.PI / 180.0), [0, 0, 1]);

	var basePos = [0, 0, r];
	var newPos = [0, 0, 0];
	mat4.multiplyVec3(modelView, basePos, newPos);
	
	return newPos;
};

function normalize(pos){
	var l = Math.sqrt(Math.pow(pos.x, 2) + Math.pow(pos.y, 2) + Math.pow(pos.z, 2));
	var normalized = mycs.deepCopy(pos);
	normalized.x = normalized.x / l;
	normalized.y = normalized.y / l;
	normalized.z = normalized.z / l;
	return normalized;
}
exports.normalize = normalize;

exports.isOverlapped = function(pos1, r1, pos2, r2){
	if (Math.pow(pos1.x - pos2.x, 2) + Math.pow(pos1.y - pos2.y, 2) + Math.pow(pos1.z - pos2.z, 2) < Math.pow(r1 + r2, 2)) {
		return true;
	}
	return false;
};

exports.calcAngle = function(edge1, edge2, edge_point){
	var edge_point_base_edge1 = {x: edge1.x - edge_point.x, y: edge1.y - edge_point.y, z: edge1.z - edge_point.z};
	var edge_point_base_edge2 = {x: edge2.x - edge_point.x, y: edge2.y - edge_point.y, z: edge2.z - edge_point.z};
	var normalized_edge1 = normalize(edge_point_base_edge1);
	var normalized_edge2 = normalize(edge_point_base_edge2);
	return Math.acos(normalized_edge1.x * normalized_edge2.x +
		normalized_edge1.y * normalized_edge2.y +
		normalized_edge1.z * normalized_edge2.z
	) * 180 / Math.PI;
};

exports.calcDistance = function(pos1, pos2){
	return Math.sqrt(Math.pow(pos1.x - pos2.x, 2) + Math.pow(pos1.y - pos2.y, 2) + Math.pow(pos1.z - pos2.z, 2));
};

function EdgePoints(type){
	this.type = type;
	this.poss = [];
	this.id = this.type + mycs.createId(ID_SIZE);
}
EdgePoints.H_SIZE = 0.05;
EdgePoints.NUM = 2;
EdgePoints.types = [
	{from:'HEAD', to:'NECK'},
	{from:'NECK', to:'LEFT_SHOULDER'},
	{from:'LEFT_SHOULDER', to:'LEFT_ELBOW'},
	{from:'LEFT_ELBOW', to:'LEFT_HAND'},
	{from:'NECK', to:'RIGHT_SHOULDER'},
	{from:'RIGHT_SHOULDER', to:'RIGHT_ELBOW'},
	{from:'RIGHT_ELBOW', to:'RIGHT_HAND'},
	{from:'LEFT_SHOULDER', to:'TORSO'},
	{from:'RIGHT_SHOULDER', to:'TORSO'},
	{from:'TORSO', to:'LEFT_HIP'},
	{from:'LEFT_HIP', to:'LEFT_KNEE'},
	{from:'LEFT_KNEE', to:'LEFT_FOOT'},
	{from:'TORSO', to:'RIGHT_HIP'},
	{from:'RIGHT_HIP', to:'RIGHT_KNEE'},
	{from:'RIGHT_KNEE', to:'RIGHT_FOOT'},
	{from:'LEFT_HIP', to:'RIGHT_HIP'}
];
EdgePoints.calcPosition = function(from_pos, to_pos, index){
	return {
		x: from_pos.x + (to_pos.x - from_pos.x) / (EdgePoints.NUM + 1) * (index + 1),
		y: from_pos.y + (to_pos.y - from_pos.y) / (EdgePoints.NUM + 1) * (index + 1),
		z: from_pos.z + (to_pos.z - from_pos.z) / (EdgePoints.NUM + 1) * (index + 1)
	};
};
EdgePoints.prototype.setPosition = function(fromPos, toPos){
	for (var i = 0; i < EdgePoints.NUM; i++) {
		var pos = EdgePoints.calcPosition(fromPos, toPos, i);
		this.poss[i] = pos;
	}
};
exports.EdgePoints = EdgePoints;

function Field(){
	this._pieces = {};
}
exports.Field = Field;
Field.prototype.getPiece = function(id){
	return this._pieces[id];
};
Field.prototype.addPiece = function(piece, id){
	ASSERT(!this._pieces[id]);
	this._pieces[id] = piece;
};
Field.prototype.removePiece = function(id){
	ASSERT(this._pieces[id]);
	delete this._pieces[id];
};
Field.prototype.getPiecesByType = function(type){
	var pieces = [];
	for (var id in this._pieces) {
		var piece = this._pieces[id];
		if (piece.type === type) {
			pieces.push(piece);
		}
	}
	return pieces;
};

function Joint(type, player){
	this.type = type;
	this.pos = null;
	this.id = this.type + mycs.createId(ID_SIZE);
	if (this.type === 'LEFT_HAND') {
		this.harfSize = Joint.SIELD_H_SIZE;
	} else {
		this.harfSize =  Joint.H_SIZE;
	}
}
exports.Joint = Joint;
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
Joint.H_SIZE = 0.3;
Joint.SIELD_H_SIZE = 1.5;
Joint.prototype.setPosition = function(pos){
	this.pos = pos;
};
Joint.prototype.getPosition = function(){
	return this.pos;
};

function Player(factory){
	this.life = Player.LIFE_MAX;
	this.basePos = null;
	this.angleY = 0;

	this.oldFootY = {
		LEFT_FOOT: 0,
		RIGHT_FOOT: 0
	};
	this.jointBaseY = 0;

	this.joints = {};
	var len = Joint.types.length;
	for (var i = 0; i < len; i++) {
		var type = Joint.types[i];
		this.joints[type] = factory.createJoint(type, this);
	}
	this.edgePoints = [];
	for (i = 0, len = EdgePoints.types.length; i < len; i++) {
		this.edgePoints.push(factory.createEdgePoints(EdgePoints.types[i]));
	}
}
exports.Player = Player;
Player.LIFE_MAX = 200;
Player.prototype.setJointPosition = function(update){
	var joint = mycs.deepCopy(update);
	joint.x *= SCALE; joint.y *= SCALE;	joint.z *= SCALE;
	if (this.basePos) {
		var newPos = this.rotatePosition({x: joint.x, y: joint.y, z: joint.z});
		joint.x = newPos[0]; joint.y = newPos[1]; joint.z = newPos[2];
	}
	
	if (joint.name === 'LEFT_FOOT' || joint.name === 'RIGHT_FOOT') {
		this.oldFootY[joint.name] = joint.y;
	}
	this.jointBaseY = -Math.min(this.oldFootY['LEFT_FOOT'] - Joint.H_SIZE, this.oldFootY['RIGHT_FOOT'] - Joint.H_SIZE);		
	joint.y += this.jointBaseY;

	this.joints[joint.name].setPosition(joint);
	for (var i = 0, len = this.edgePoints.length; i < len; i++) {
		var points = this.edgePoints[i];
		if (points.type.from !== joint.name && points.type.to !== joint.name) {
			continue;
		}
		if (!this.joints[points.type.to].pos || !this.joints[points.type.from].pos) {
			continue;
		}
		points.setPosition(this.joints[points.type.from].pos, this.joints[points.type.to].pos);
	}
	if (!this.basePos) {
		this.updateBasePosition();
	}
};
Player.prototype.updateBasePosition = function(){
	var sumX = 0, sumZ = 0;
	var count = 0;
	for (var k in this.joints) {
		var pos = this.joints[k].pos;
		if (!pos) {
			continue;
		}
		count++;
		sumX += this.joints[k].pos.x;
		sumZ += this.joints[k].pos.z;
	}
	this.basePos = {x: sumX / count, y: 0, z: sumZ / count};
};
function pointToArray(point){
	return [point.x, point.y, point.z];
}
function arrayToPoint(array){
	return {
		x: array[0],
		y: array[1],
		z: array[2]
	};
}
Player.prototype.rotatePosition = function(pos){
	var modelView = mat4.create();
	
	mat4.identity(modelView);
	mat4.translate(modelView, pointToArray(this.basePos));
	mat4.rotate(modelView, this.angleY * (Math.PI / 180.0), [0, 1, 0]);
	mat4.translate(modelView, [-this.basePos.x, -this.basePos.y, -this.basePos.z]);

	var newPos = [0, 0, 0];
	mat4.multiplyVec3(modelView, pointToArray(pos), newPos);

	return newPos;
};
Player.prototype.turn = function(diff){
	this.angleY += diff;
};

})();