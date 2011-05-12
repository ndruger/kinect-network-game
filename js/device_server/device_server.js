/*global require, DP, process */
var net = require('net');
var sys = require('sys');
var fs = require('fs');
var csmy = require('../lib/my/my_client_and_server');
var cs = require('../client_and_server/client_and_server');
var mys = require('../lib/my/my_server');
var argv = require('optimist').argv;

var replayPath, proxy, ws;
var isReplay = false;

if (argv.w) {
	ws = fs.createWriteStream(argv.w);
}
if (argv.r) {
	isReplay = true;
	replayPath = argv.r;
}
var BROWSER_PORT = (argv.b) ? argv.b: cs.DEVICE_PORT;
var KINECT_PORT = (argv.k) ? argv.k: 8841;
var HMD_PORT = (argv.h) ? argv.h: 8821;

// Proxy for sending data to Browser
proxy = new mys.SocketIoProxy(BROWSER_PORT, null, null, null);

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

function createBufferingTCPServer(port){	
	net.createServer(function(socket){
		var buff = '';
		socket.on("data", function(data){
			buff = handleData(buff, data);
		});
		socket.on('error', function (exc) {
			sys.log("ignoring exception: " + exc);
		});
	}).listen(port, "127.0.0.1");
}

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
		}, 10);	// todo: save original time line
	});
} else {
	createBufferingTCPServer(KINECT_PORT);
}
createBufferingTCPServer(HMD_PORT);
