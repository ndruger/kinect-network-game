/*global exports, JSON, console, require */
var io = require('socket.io');
var ws = require('websocket-server');
var http = require('http');
var sys = require('sys');

function WebSocketProxy(port, openProc, messageProc, closeProc, opt_maxConnection){
	this.server = ws.createServer();
	this.maxConnection = (typeof opt_maxConnection == 'undefined') ? -1: opt_maxConnection;
	this.connectionCount = 0;
	var self = this;
	this.server.on('connection', function(client){
		if (this.maxConnection !== -1) {
			if (self.connectionCount + 1 >= self.maxConnection) {
				client.reject();
				return;
			}
		}
		self.connectionCount ++;
		client.on('message', function(message){
			if (messageProc) {
				try {
					var data = JSON.parse(message);
					messageProc(data, client);
				}
				catch (e) {
					console.log('ignoring exception: ' + e);
				}
			}
		});
		client.on('close', function(){
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
					messageProc(data, client);
				}
				catch (e) {
					console.log('ignoring exception: ' + e);
				}
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

exports.WebSocketProxy = WebSocketProxy;
exports.SocketIoProxy = SocketIoProxy;
