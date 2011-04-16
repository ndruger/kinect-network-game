/*global global, console, exports, myModules, JSON */
(function(){
var module;
if (typeof exports == 'undefined') {
	exports = {};
}
if (typeof myModules != 'undefined') {
	module = myModules.mycs = {};
} else {
	module = exports;
}

module.dirToDiff = {
	down: {dx: 0, dy: 1},
	up: {dx: 0, dy: -1},
	left: {dx: -1, dy: 0},
	right: {dx: 1, dy: 0}
};
module.reverseDir = {	
	down: 'up',
	up: 'down',
	left: 'right',
	right: 'left'
};

var DP = function(var_args){
	if (typeof console != 'undefined') {
		console.log.apply(console, arguments);
	}
};
module.DIR = function(var_args){
	if (typeof console != 'undefined') {
		console.dir.apply(console, arguments);
	}
};
module.DP = DP;
module.LOG = function(var_args){
	DP.apply(this, arguments);
};
module.DPD = function(var_args){
	DP(JSON.stringify(var_args));
};
var ASSERT = function(exp, var_args){
	if (!exp) {
		if (typeof console != 'undefined') {
			debugger;
//			console.assert.apply(console, arguments);
		}
	}
};
module.ASSERT = ASSERT;
module.inherit = function(subClass, superClass){
	for (var prop in superClass.prototype) {
		subClass.prototype[prop] = superClass.prototype[prop];
	}
	subClass.prototype.constructor = subClass;
	subClass.prototype.superClass = superClass;
};
module.superClass = function(subClass){
	return subClass.prototype.superClass.prototype;
};

function XPSCounter(){
	this.countFrame = 0;
	this.oldTime = -1;
}
XPSCounter.prototype.count = function(proc){
	if (this.oldTime !== -1) {
		var current = Date.now();
		if (current - this.oldTime > 1000) {
			proc(this.countFrame);
			this.countFrame = 0;
			this.oldTime += 1000;
		}
	} else {
		this.oldTime = Date.now();
	}
	this.countFrame++;
};
module.XPSCounter = XPSCounter;

function deepCopy(o){
	if (o instanceof Array) {
		var new_array = [];
		var len = o.length;
		for (var i = 0; i < len; i++) {
			new_array[i] = exports.deepCopy(o[i]);
		}
		return new_array;
	} else if (typeof o === 'object') {
		var new_o = {};
		for (var k in o) {
			new_o[k] = deepCopy(o[k]);
		}
		return new_o;
	} else {
		return o;
	}
}

module.deepCopy = deepCopy;

// IntervalTimer
function IntervalTimer(){
	this.timer = -1;
	this.start = 0;
	this.proc = null;
}
IntervalTimer.prototype.setInterval = function(proc, limit, unit){
	this.start = (new Date()).getTime();
	this.proc = proc;
	var self = this;
	this.timer = setInterval(function(){
		var current = (new Date()).getTime();
		var progress = (current - self.start) / limit;
		progress = (progress > 1) ? 1: progress;
		if (!self.proc(progress) || current > self.start + limit) {
			clearInterval(self.timer);
			self.timer = -1;
		}
	}, unit);
};
IntervalTimer.prototype.IsEnd = function(){
	return (this.timer === -1);
};
IntervalTimer.prototype.clearInterval = function(do_last_action){
	if (do_last_action && this.timer !== -1) {
		this.proc(1);
	}
	clearInterval(this.timer);
	this.timer = -1;
};
module.IntervalTimer = IntervalTimer;

// IndexPool
function IndexPool(start, end){
	this.pool = {};
	this.start = start;
	this.end = end;
	for (var i = start; i <= end; i++) {
		this.pool[i] = true;
	}
}
IndexPool.prototype.hold = function(){
	for (var k in this.pool) {
		delete this.pool[k];
		return k;
	}
	ASSERT(true);
};
IndexPool.prototype.release = function(index){
	ASSERT(!(index in this.pool));
	ASSERT(this.start <= index && index <= this.end);
	this.pool[index] = true;
};
module.IndexPool = IndexPool;

module.createId = function(n){
	var table = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
	var id = '';
	for (var i = 0; i < n; i++) {
		id += table.charAt(Math.floor(table.length * Math.random()));
	}
	return id;
};

})();
