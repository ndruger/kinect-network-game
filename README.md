# Kinect Network Game Sample #

## Introduction ##
Experimental Kinect Network Game Sample

## How it work?##
	1.Kinect --> 2.OpenNI App --[TCP]--> 3.Node.js App(local server) --[WebSocket/Comet]--> 4.Browser <--[WebSocket/Comet]--> 5.Node.js App(remote server) <--[WebSocket/Comet]--> 6.Browser

## Tested Environment ##
- Client and Server
 - Windows 7
 - node.exe v0.5.10
 - socket.io@0.8.6
 - socket.io-client@0.8.6
  - Place socket.io.js and WebSocketMain.swf into "js\client\lib\socket.io-client".
 - Chrome16
 - Apache
- Server
 - CentOS 5.5
 - node.exe v0.4.10
 - socket.io@0.8.6
 - socket.io-client@0.8.6
 - Apache

## How to start on local PC(recored sample kinect motion) ##
- js\device_server>node device_server.js
- js\remote_server>node remote_server.js
- open http://127.0.0.1/[your path]/kinect_network_game/js/client/client.htm

## How to start on local PC(realtime kinect motion) ##
- js\device_server>node device_server.js
- js\remote_server>node remote_server.js
- open http://127.0.0.1/[your apache path]/kinect_network_game/js/client/client.htm
- NiUserTracker>Debug\NiUserTracker.exe

## How to start remote battle ##

### Server ###
- js\remote_server>node remote_server.js

### Client ###
- js\device_server>node device_server.js
- open http://[your server address]/[your apache path]/kinect_network_game/js/client/client.htm
- NiUserTracker>Debug\NiUserTracker.exe


## License ##
### Used library ###
This repository includes following library's source code. These own license applies to the source code.

- glMatrix.js
- SceneJS
- socket.io-client

### Image and 3D data ###
This program uses tux 3D data(http://opengameart.org/content/tux) in OpenGameArg.org.
