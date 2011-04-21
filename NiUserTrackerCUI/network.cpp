#include <stdio.h>
#include <winsock2.h>
#include <ws2tcpip.h>
#include "SceneDrawer.h"
#include "network.h"

Tunnel::Tunnel()
{
	char *dest = "127.0.0.1";
	unsigned short port = 8841;

	WSADATA data;
	WSAStartup(MAKEWORD(2,0), &data);

	this->soc = socket(AF_INET, SOCK_STREAM, 0);

	struct sockaddr_in dest_addr;
	memset(&dest_addr, 0, sizeof(dest_addr));
	dest_addr.sin_family = AF_INET;
	dest_addr.sin_addr.s_addr = inet_addr(dest);
	dest_addr.sin_port = htons(port);

	if (connect(soc, (struct sockaddr *)&dest_addr, sizeof(dest_addr)) == SOCKET_ERROR) {
		fprintf(stderr, "connection error\n");
		return;	// todo exception
	}
}

Tunnel::~Tunnel()	// can't call. glutMainLoop() is never end.
{
	closesocket(this->soc);
	WSACleanup();
}

void Tunnel::send(char *in_mes)
{
	::send(this->soc, in_mes, strlen(in_mes), 0);
}