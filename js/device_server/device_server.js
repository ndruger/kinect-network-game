/*global require, DP, process */
var net = require('net');
var sys = require('sys');
var fs = require('fs');
var csmy = require('../lib/my/my_client_and_server');
var cs = require('../client_and_server/client_and_server');
var mys = require('../lib/my/my_server');

var replayPath, proxy, ws;
var isReplay = false;

if (process.argv[2] === '-w') {
	ws = fs.createWriteStream(process.argv[3]);
} else if (process.argv[2] === '-r') {
	isReplay = true;
	replayPath = process.argv[3];
}

// Proxy for sending data to Browser
proxy = new mys.SocketIoProxy(cs.DEVICE_PORT, null, null, null);

// receive from OpenNI
var handleData = (function(){
	return function(buff, data){
		var mess = (buff + data.toString()).split('!');
		var len = mess.length;
		var new_buff = mess[len - 1];
		for (var i = 0; i < len - 1; i++) {
			proxy.broadcast(mess[i]);
			if (ws) {
				ws.write(mess[i] + '!');
			}
		}
		return new_buff;
	};
})();
if (isReplay) {
	fs.open(replayPath, 'r', undefined, function(status, fd){
		if (status !== null) {
			process.exit();
		}
		var pos = 0;
		var READ_SIZE = 500;
		var buff = '';
		setInterval(function(){
			var data = fs.readSync(fd, READ_SIZE, pos, 'utf8');
			pos += READ_SIZE;
			if (data[1] !== READ_SIZE) {
				pos = 0;
			}
			buff = handleData(buff, data[0]);
		}, 40);
	});
}
net.createServer(function(socket){
	var buff = '';
	socket.on("data", function(data){
		buff = handleData(buff, data);
	});
	socket.on('error', function (exc) {
		sys.log("ignoring exception: " + exc);
	});
}).listen(8841, "127.0.0.1");
