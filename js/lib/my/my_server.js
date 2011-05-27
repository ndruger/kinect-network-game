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

function WebSocketProxy(port, openProc, messageProc, closeProc, opt_maxConnection){
	this.server = ws.createServer();
	this.maxConnection = (typeof opt_maxConnection == 'undefined') ? -1: opt_maxConnection;
	this.connectionCount = 0;
	this.clients = {};
	var self = this;
	this.server.on('connection', function(client){
		if (self.maxConnection !== -1) {
			if (self.connectionCount + 1 >= self.maxConnection) {
				client.reject();
				return;
			}
		}
		self.clients[client.id] = client;
		self.connectionCount ++;
		client.on('message', function(message){
			if (messageProc) {
				try {
					var data = JSON.parse(message);
					if (data.type === '_heartbeat') {
						return;
					}
				}
				catch (e) {
					console.log('ignoring exception: ' + e);
					return;
				}
				messageProc(data, client);
			}
		});
		client.on('close', function(){
			delete self.clients[client.id];
			self.connectionCount --;
			if (closeProc) {
				closeProc(client);
			}
		});
		client.on('error', function(exc){	// for ECONNABORTED and ECONNRESET
		    console.log('ignoring exception: ' + exc);
		});
		if (openProc) {
			openProc(client);
		}
	});
	this.server.listen(port);
}
WebSocketProxy.prototype.broadcast = function(data){
	if (typeof data == 'object') {
		this.server.broadcast(JSON.stringify(data));
	} else {
		this.server.broadcast(data);
	}
};
WebSocketProxy.prototype.send = function(client, data){
	if (typeof data == 'object') {
		client.send(JSON.stringify(data));
	} else {
		client.send(data);
	}
};
WebSocketProxy.prototype.broadcastExceptFor = function(client, data){
	for (var id in this.clients) {
		if (id !== client.id) {
			this.send(this.clients[id], data);
		}
	}
};

function SocketIoProxy(port, openProc, messageProc, closeProc, opt_server){
	if (typeof opt_server != 'undefined') {
		this.server = opt_server;
	} else {
		this.server = http.createServer(function(req, res){
			res.writeHead(200, {'Content-Type': 'text/html'}); 
			res.end('<h1>Hello world</h1>'); 
		});
	}
	this.socket = io.listen(this.server);
	this.socket.on('connection', function(client){
		client.on('message', function(message){
			if (messageProc) {
				try {
					var data = JSON.parse(message);
					if (data.type === '_heartbeat') {
						return;
					}
				}
				catch (e) {
					console.log('ignoring exception: ' + e);
					return;
				}
				messageProc(data, client);
			}
		});
		client.on('disconnect', function(){
			if (closeProc) {
				closeProc(client);
			}
		});
		if (openProc) {
			openProc(client);
		}
	});
	if (typeof opt_server == 'undefined') {
		this.server.listen(port);
	}
}
SocketIoProxy.prototype.broadcast = function(data){
	if (typeof data == 'object') {
		this.socket.broadcast(JSON.stringify(data));
	} else {
		this.socket.broadcast(data);
	}
};
SocketIoProxy.prototype.send = function(client, data){
	if (typeof data == 'object') {
		client.send(JSON.stringify(data));
	} else {
		client.send(data);
	}
};
SocketIoProxy.prototype.broadcastExceptFor = function(client, data){
	for (var id in client.listener.clients) {
		if (id !== client.sessionId) {
			this.send(client.listener.clients[id], data);
		}
	}
};

exports.WebSocketProxy = WebSocketProxy;
exports.SocketIoProxy = SocketIoProxy;
