/*global KeyEvent, WebSocket, io, myModules, exports, JSON, LOG */
(function(){
var module;
if (typeof exports == 'undefined') {
	exports = {};
}
if (typeof myModules != 'undefined') {
	module = myModules.myc = {};
} else {
	module = exports;
}

if (typeof KeyEvent == 'undefined') {
	KeyEvent = {
		DOM_VK_CANCEL: 3,
		DOM_VK_HELP: 6,
		DOM_VK_BACK_SPACE: 8,
		DOM_VK_TAB: 9,
		DOM_VK_CLEAR: 12,
		DOM_VK_RETURN: 13,
		DOM_VK_ENTER: 14,
		DOM_VK_SHIFT: 16,
		DOM_VK_CONTROL: 17,
		DOM_VK_ALT: 18,
		DOM_VK_PAUSE: 19,
		DOM_VK_CAPS_LOCK: 20,
		DOM_VK_ESCAPE: 27,
		DOM_VK_SPACE: 32,
		DOM_VK_PAGE_UP: 33,
		DOM_VK_PAGE_DOWN: 34,
		DOM_VK_END: 35,
		DOM_VK_HOME: 36,
		DOM_VK_LEFT: 37,
		DOM_VK_UP: 38,
		DOM_VK_RIGHT: 39,
		DOM_VK_DOWN: 40,
		DOM_VK_PRINTSCREEN: 44,
		DOM_VK_INSERT: 45,
		DOM_VK_DELETE: 46,
		DOM_VK_0: 48,
		DOM_VK_1: 49,
		DOM_VK_2: 50,
		DOM_VK_3: 51,
		DOM_VK_4: 52,
		DOM_VK_5: 53,
		DOM_VK_6: 54,
		DOM_VK_7: 55,
		DOM_VK_8: 56,
		DOM_VK_9: 57,
		DOM_VK_SEMICOLON: 59,
		DOM_VK_EQUALS: 61,
		DOM_VK_A: 65,
		DOM_VK_B: 66,
		DOM_VK_C: 67,
		DOM_VK_D: 68,
		DOM_VK_E: 69,
		DOM_VK_F: 70,
		DOM_VK_G: 71,
		DOM_VK_H: 72,
		DOM_VK_I: 73,
		DOM_VK_J: 74,
		DOM_VK_K: 75,
		DOM_VK_L: 76,
		DOM_VK_M: 77,
		DOM_VK_N: 78,
		DOM_VK_O: 79,
		DOM_VK_P: 80,
		DOM_VK_Q: 81,
		DOM_VK_R: 82,
		DOM_VK_S: 83,
		DOM_VK_T: 84,
		DOM_VK_U: 85,
		DOM_VK_V: 86,
		DOM_VK_W: 87,
		DOM_VK_X: 88,
		DOM_VK_Y: 89,
		DOM_VK_Z: 90
	};
}
function WebSocketProxy(port, openProc, messageProc, closeProc, opt_fullDomain){
	var fullDomain;
	if (typeof opt_fullDomain == 'undefined') {
		fullDomain = location.href.split('/')[2].split(':')[0];
	} else {
		fullDomain = opt_fullDomain;
	}
	this._ws = new WebSocket('ws://' + fullDomain + ':' + port);
	this._ws.onopen = openProc;
	this._ws.onmessage = function(message){
		if (messageProc) {
			try {
				var data = JSON.parse(message.data);
			}
			catch (e) {
				LOG('ignoring exception: ' + e);
				return;
			}
			messageProc(data);
		}
	};
	this._ws.onclose = closeProc;
}
module.WebSocketProxy = WebSocketProxy;
WebSocketProxy.prototype.send = function(data){
	if (typeof data == 'object') {
		this._ws.send(JSON.stringify(data));
	} else {
		this._ws.send(data);
	}
};
WebSocketProxy.prototype.close = function(){
	this._ws.close();
};

function SocketIoProxy(port, openProc, messageProc, closeProc, opt_fullDomain){
	var fullDomain;
	if (typeof opt_fullDomain == 'undefined') {
		fullDomain = location.href.split('/')[2].split(':')[0];
	} else {
		fullDomain = opt_fullDomain;
	}
	this._socket = new io.Socket(fullDomain, {port: port}); 
	this._socket.connect();

	this._socket.on('connect', function(){ openProc(); });
	this._socket.on('message', function(message){
		if (messageProc) {
			try {
				var data = JSON.parse(message);
			}
			catch (e) {
				LOG('ignoring exception: ' + e);
				return;
			}
			messageProc(data);
		}
	});
	this._socket.on('disconnect', function(){ closeProc(); });
}
module.SocketIoProxy = SocketIoProxy;
SocketIoProxy.prototype.send = function(data){
	if (typeof data == 'object') {
		this._socket.send(JSON.stringify(data));
	} else {
		this._socket.send(data);
	}
};
SocketIoProxy.prototype.close = function(){
	this._socket.disconnect();
};

})();
