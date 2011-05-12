/*global exports, JSON, cs, ASSERT, LOG, superClass, inherit, Proxy, DP */
/*global myModules */
(function(){
var myc = myModules.myc;
var mycs = myModules.mycs;
var cs = myModules.cs;

var field, proxy;

function debugOneDP(in_s){
	document.getElementById('debug2').innerHTML = in_s;
}
var debugCount = 0;
function debugStyle(){
	var a = document.documentElement.scrollHeight + ',';
	a += document.documentElement.offsetHeight + ',';
	a += document.documentElement.clientHeight + ',';
	a += document.documentElement.scrollLeft + ',';
	a += document.body.clientHeight + ',';
	a += document.body.scrollHeight + ',';
	a += window.innerHeight + ',';
	a += debugCount;debugCount++;
	debugOneDP(a);
}

function myDocumentSize(){
	// Don't use documentElement.clientHeight. FX4 returns content height.
	// Don't use body.clientHeight. iPhone landscape mode returns bad value.
	
	return { width: window.innerWidth, height: window.innerHeight };
}

function setButtonsStyle(){
	var space = 30;
	document.body.scrollLeft = 0;	// for iPhone bug(?)
	document.body.scrollTop = 0;
	
	var doc_size = myDocumentSize();

	var vertical_button_hypotenuse = doc_size.height - space;
	var vertical_button_size = Math.sqrt(Math.pow(vertical_button_hypotenuse, 2) / 2);

	var horizontal_button_hypotenuse = doc_size.width - space;
	var horizontal_button_size = Math.sqrt(Math.pow(horizontal_button_hypotenuse, 2) / 2);

	var up_button = document.getElementById('up_button');
	up_button.style.width = vertical_button_size;
	up_button.style.height = vertical_button_size;
	up_button.style.left = doc_size.width / 2 - vertical_button_size / 2;
	up_button.style.top = - vertical_button_size / 2;

	var down_button = document.getElementById('down_button');
	down_button.style.width = vertical_button_size;
	down_button.style.height = vertical_button_size;
	down_button.style.left = doc_size.width / 2 - vertical_button_size / 2;
	down_button.style.top = doc_size.height - vertical_button_size / 2;

	var left_button = document.getElementById('left_button');
	left_button.style.width = horizontal_button_size;
	left_button.style.height = horizontal_button_size;
	left_button.style.left = - horizontal_button_size / 2;
	left_button.style.top = doc_size.height / 2 - horizontal_button_size / 2;

	var right_button = document.getElementById('right_button');
	right_button.style.width = horizontal_button_size;
	right_button.style.height = horizontal_button_size;
	right_button.style.left = doc_size.width - horizontal_button_size / 2;
	right_button.style.top = doc_size.height / 2 - horizontal_button_size / 2;	
}
function handleTouchStart(in_e, in_dir){
	in_e.preventDefault();
	if (!proxy) {
		return;
	}
	var dir = in_e.target.id.split('_button')[0];
	switch (dir) {		
	case 'up':
	case 'down':
		proxy.send({
			type: 'move_request',
			arg: {
				dir: dir
			}
		});
		break;
	case 'left':
	case 'right':
		proxy.send({
			type: 'turn',
			arg: {
				diff: {'right': -10, 'left': 10}[dir]
			}
		});
		break;
	}
}

window.addEventListener('load', function(){
	setTimeout(function(){	// for Android progress bar on xhr-polling
		setButtonsStyle();	

		proxy = new myc.SocketIoProxy(
			cs.CONTROLLER_PORT,
			function(){
				LOG('open');
				var buttons = ['up_button', 'down_button', 'left_button', 'right_button'];
				var len = buttons.length;
				for(var i = 0; i < len; i++) {
					document.getElementById(buttons[i]).addEventListener('touchstart', handleTouchStart, false);
					document.getElementById(buttons[i]).addEventListener('click', handleTouchStart, false);
				}
			},
			null,
			function(){
				LOG('close');
			}
		);
	}, 0);

	var old_doc_height = myDocumentSize().height;
	setInterval(function(){	// I can't use orientationchange. window.innerHeight does not changed on the listener on Android.
		var new_height = myDocumentSize().height;
		if (old_doc_height !== new_height) {
			old_doc_height = new_height;
			setButtonsStyle();
		}
	}, 300);
	
	document.getElementById('switch_hmd_mode').addEventListener('click', function(){
		proxy.send({
			type: 'switch_hmd_mode'
		});
	}, false);
}, false);

window.addEventListener('unload', function(){	// for browser bug
	if (proxy) {
		proxy.close();
	}
}, false);

})();

