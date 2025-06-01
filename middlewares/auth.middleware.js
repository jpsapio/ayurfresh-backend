import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/env.js';
import prisma from '../config/db.js';
import { errorResponse } from '../utils/responseHandler.js';


export const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return errorResponse(res, 401, 'Unauthorized: Token not provided');
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const { userId, email } = decoded;

    const user = await prisma.user.findUnique({
      where: { id: userId, email: email },
    });

    if (!user) {
      return errorResponse(res, 401, 'Unauthorized: User does not exist');
    }
    req.user = {
      userId: user.id,
      role: user.role,
      email: user.email,
    };

    next();
  } catch (error) {
    console.error('Auth Error:', error);
    return errorResponse(res, 401, 'Invalid or expired token');
  }
};


export const adminProtect = async (req, res, next) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return errorResponse(res, 403, 'User ID not provided');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { verification: true }
    });

    if (!user || user.role !== 'ADMIN') {
      console.log(`Unauthorized admin access attempt by user ${userId}`);
      return errorResponse(res, 403, 'You are not authorized to access this resource');
    }

    user.email_verified = user.verification?.email_status === 'VERIFIED';
    user.phone_verified = user.phone_number 
      ? user.verification?.phone_status === 'VERIFIED' 
      : false;

    req.admin = user;
    next();
  } catch (error) {
    console.log(`Admin protect error: ${error.message}`);
    return errorResponse(res, 500, 'Internal server error');
  }
};
