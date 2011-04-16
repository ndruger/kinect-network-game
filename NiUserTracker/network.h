#ifndef MY_NETWORK_H_
#define MY_NETWORK_H_

class Tunnel
{
public:
	Tunnel();
	~Tunnel();
	void send(char *in_mes);
private:
	int soc;
};



#endif	/* MY_NETWORK_H_ */
