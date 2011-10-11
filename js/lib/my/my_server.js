/*global exports, JSON, console, myModules, require */
var io = require('socket.io');
var ws = require('websocket-server');
var http = require('http');
var sys = require('sys');

var mycs;
if (typeof myModules != 'undefined') {
	mycs = myModules.mycs;
} else {
	mycs = require('./my_client_and_server');
}
var ASSERT = mycs.ASSERT;
var DP = mycs.DP;
var DPD = mycs.DPD;

function SocketIoProxy(port, openProc, messageProc, closeProc, opt_server){
	this.io = io.listen(port);
	this.io.sockets.on('connection', function(socket){
		socket.on('message', function(message){
			if (messageProc) {
				if (message.type === '_heartbeat') {
					return;
				}
				messageProc(message, socket);
			}
		});
		socket.on('disconnect', function(){
			if (closeProc) {
				closeProc(socket);
			}
		});
		if (openProc) {
			openProc(socket);
		}
	});
}
SocketIoProxy.prototype.broadcast = function(data){	// todo: rename
	this.io.sockets.emit('message', data);
};
SocketIoProxy.prototype.send = function(socket, data){
	socket.emit('message', data);
};
SocketIoProxy.prototype.broadcastExceptFor = function(socket, data){	// todo: rename
	socket.broadcast.emit('message', data);
};

exports.SocketIoProxy = SocketIoProxy;
