/*****************************************************************************
*                                                                            *
*  OpenNI 1.0 Alpha                                                          *
*  Copyright (C) 2010 PrimeSense Ltd.                                        *
*                                                                            *
*  This file is part of OpenNI.                                              *
*                                                                            *
*  OpenNI is free software: you can redistribute it and/or modify            *
*  it under the terms of the GNU Lesser General Public License as published  *
*  by the Free Software Foundation, either version 3 of the License, or      *
*  (at your option) any later version.                                       *
*                                                                            *
*  OpenNI is distributed in the hope that it will be useful,                 *
*  but WITHOUT ANY WARRANTY; without even the implied warranty of            *
*  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the              *
*  GNU Lesser General Public License for more details.                       *
*                                                                            *
*  You should have received a copy of the GNU Lesser General Public License  *
*  along with OpenNI. If not, see <http://www.gnu.org/licenses/>.            *
*                                                                            *
*****************************************************************************/




//---------------------------------------------------------------------------
// Includes
//---------------------------------------------------------------------------
#include "SceneDrawer.h"
#include "network.h"

extern xn::UserGenerator g_UserGenerator;
extern xn::DepthGenerator g_DepthGenerator;

extern XnBool g_bDrawBackground;
extern XnBool g_bDrawPixels;
extern XnBool g_bDrawSkeleton;
extern XnBool g_bPrintID;
extern XnBool g_bPrintState;
extern Tunnel *g_tunnel;

typedef struct {
	XnSkeletonJoint joint;
	const char* text;
} JointMap;

JointMap jointMapTable[] = {
	{XN_SKEL_HEAD, "HEAD"},
	{XN_SKEL_NECK, "NECK"},
	{XN_SKEL_TORSO, "TORSO"},
//	{XN_SKEL_WAIST, "WAIST"},
	{XN_SKEL_LEFT_COLLAR, "LEFT_COLLAR"},
	{XN_SKEL_LEFT_SHOULDER, "LEFT_SHOULDER"},
	{XN_SKEL_LEFT_ELBOW, "LEFT_ELBOW"},
//	{XN_SKEL_LEFT_WRIST, "LEFT_WRIST"},
	{XN_SKEL_LEFT_HAND, "LEFT_HAND"},
//	{XN_SKEL_LEFT_FINGERTIP, "LEFT_FINGERTIP"},
	{XN_SKEL_RIGHT_COLLAR, "RIGHT_COLLAR"},
	{XN_SKEL_RIGHT_SHOULDER, "RIGHT_SHOULDER"},
	{XN_SKEL_RIGHT_ELBOW, "RIGHT_ELBOW"},
//	{XN_SKEL_RIGHT_WRIST, "RIGHT_WRIST"},
	{XN_SKEL_RIGHT_HAND, "RIGHT_HAND"},
//	{XN_SKEL_RIGHT_FINGERTIP, "RIGHT_FINGERTIP"},
	{XN_SKEL_LEFT_HIP, "LEFT_HIP"},
	{XN_SKEL_LEFT_KNEE, "LEFT_KNEE"},
//	{XN_SKEL_LEFT_ANKLE, "LEFT_ANKLE"},
	{XN_SKEL_LEFT_FOOT, "LEFT_FOOT"},
	{XN_SKEL_RIGHT_HIP, "RIGHT_HIP"},
	{XN_SKEL_RIGHT_KNEE, "RIGHT_KNEE"},
//	{XN_SKEL_RIGHT_ANKLE, "RIGHT_ANKLE"},
	{XN_SKEL_RIGHT_FOOT, "RIGHT_FOOT"}
};


void loop()
{
	static bool bInitialized = false;	
	static unsigned char* pDepthTexBuf;
	static int texWidth, texHeight;

	unsigned int nValue = 0;
	unsigned int nHistValue = 0;
	unsigned int nIndex = 0;
	unsigned int nX = 0;
	unsigned int nY = 0;
	unsigned int nNumberOfPoints = 0;

	char strLabel[50] = "";
	XnUserID aUsers[15];
	XnUInt16 nUsers = 15;
	g_UserGenerator.GetUsers(aUsers, nUsers);
	for (int i = 0; i < nUsers; ++i)
	{
		if (g_bPrintID)
		{
			XnPoint3D com;
			g_UserGenerator.GetCoM(aUsers[i], com);
			g_DepthGenerator.ConvertRealWorldToProjective(1, &com, &com);

			xnOSMemSet(strLabel, 0, sizeof(strLabel));
			if (!g_bPrintState)
			{
				// Tracking
				sprintf(strLabel, "%d", aUsers[i]);
			}
			else if (g_UserGenerator.GetSkeletonCap().IsTracking(aUsers[i]))
			{
				// Tracking
				sprintf(strLabel, "%d - Tracking", aUsers[i]);
			}
			else if (g_UserGenerator.GetSkeletonCap().IsCalibrating(aUsers[i]))
			{
				// Calibrating
				sprintf(strLabel, "%d - Calibrating...", aUsers[i]);
			}
			else
			{
				// Nothing
				sprintf(strLabel, "%d - Looking for pose", aUsers[i]);
			}
		}

		if (g_bDrawSkeleton && g_UserGenerator.GetSkeletonCap().IsTracking(aUsers[i]))
		{
			{
				int tableLen = sizeof(jointMapTable) / sizeof(jointMapTable[0]);
				char buff[1024 * sizeof(jointMapTable) / sizeof(jointMapTable[0])];
				int len = 0;
				bool isFirst = true;
				len += sprintf_s(buff + len, sizeof(buff) - len, "{\"type\":\"kinect_joint_postion\", \"arg\": {\"positions\": [");
				for (int j = 0; j < tableLen; j++)
				{
					XnSkeletonJointPosition pos;
					g_UserGenerator.GetSkeletonCap().GetSkeletonJointPosition(aUsers[i], jointMapTable[j].joint, pos);
					if (pos.fConfidence < 0.5)
					{
						continue;
					}
					if (!isFirst) {
						len += sprintf_s(buff + len, sizeof(buff) - len, ",");
					}
					isFirst = false;
					len += sprintf_s(buff + len, sizeof(buff) - len, "{\"name\":\"%s\", \"x\":%d, \"y\":%d, \"z\":%d}",
						jointMapTable[j].text, (int)pos.position.X, (int)pos.position.Y, (int)pos.position.Z);
				}
				len += sprintf_s(buff + len, sizeof(buff) - len, "]}}!");
				g_tunnel->send(buff);
			}
		}
	}
}
