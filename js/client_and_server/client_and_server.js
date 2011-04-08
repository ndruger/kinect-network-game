/*global exports, console, DP, JSON, mat4, ASSERT, myModules, require */
(function(){
if (typeof exports == 'undefined') {
	exports = {};
}
var csmy;
if (typeof myModules != 'undefined') {
	myModules.cs = exports;
	csmy = myModules.csmy;
} else {
	csmy = require('../lib/my/my_client_and_server');
}
exports.REMOTE_PORT = 8761;
exports.DEVICE_PORT = 8869;
exports.FIELD_SIZE = 100;
exports.ENEMY_SIZE = 10;

exports.FIELD_X_WIDTH = 100.0;
exports.FIELD_Z_WIDTH = 100.0;
exports.FIELD_Y_WIDTH = 30.0;

exports.SCALE = 0.008;
exports.calcRoatatePosition = function(angle, r, omat4){
	if (typeof omat4 !== 'undefined') {	// todo
		mat4 = omat4;
	}
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
	var normalized = csmy.deepCopy(pos);
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

})();
