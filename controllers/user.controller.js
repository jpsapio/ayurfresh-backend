import vine, { errors } from '@vinejs/vine';
import prisma from '../config/db.js';
import logger from '../utils/logger.js';
import { createAddressSchema, updateAddressSchema } from '../validations/user.validation.js';
import { updateProfileSchema } from "../validations/auth.validation.js";
import { renderEmailEjs } from "../utils/ejsHandler.js";
import { sendMail } from "../config/mail.js";
import {  FRONTEND_URL } from "../config/env.js";
import { successResponse, errorResponse } from '../utils/responseHandler.js';
import { getPaginationParams } from '../utils/helper.js';

class UserController {
 
  static async updateProfile(req, res) {
    try {
      const userId = req.user?.userId;
      const validator = vine.compile(updateProfileSchema);
      const payload = await validator.validate(req.body);

      if (!Object.keys(payload).length) return errorResponse(res, 400, 'No fields to update');

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return errorResponse(res, 404, 'User not found');

      if (payload.email && payload.email !== user.email) {
        const emailUser = await prisma.user.findUnique({ where: { email: payload.email } });
        if (emailUser && emailUser.id !== userId) {
          return errorResponse(res, 422, { email: 'Email already in use' });
        }
      }

      if (payload.phone_number && payload.phone_number !== user.phone_number) {
        const phoneUser = await prisma.user.findUnique({ where: { phone_number: payload.phone_number } });
        if (phoneUser && phoneUser.id !== userId) {
          return errorResponse(res, 422, { phone_number: 'Phone number already in use' });
        }
      }

      const updatedUser = await prisma.user.update({ where: { id: userId }, data: payload });
      const updates = Object.entries(payload).map(([k, v]) => `<strong>${k}</strong>: ${v}`).join('<br/>');

      const html = await renderEmailEjs('message', {
        title: 'Profile Updated',
        message: `Your profile has been updated:<br/><br/>${updates}`,
        redirectUrl: null
      });

      await sendMail(updatedUser.email, `Profile Updated - ${FRONTEND_URL}`, html);

      return successResponse(res,200, 'Profile updated successfully', {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        phone_number: updatedUser.phone_number
      });
    } catch (error) {
      console.error(error);
      if (error instanceof errors.E_VALIDATION_ERROR) {
        return errorResponse(res, 422, error.messages);
      }
      return errorResponse(res, 500, 'Internal server error');
    }
  }

  static async getProfile(req, res) {
    try {
      const userId = req.user?.userId;
  
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          phone_number: true,
          created_at: true,
          verification: {
            select: {
              email_status: true,
              phone_status: true,
            },
          },
          preference: {
            select: {
              notify_product_updates: true,
            },
          },
          addresses: {
            select: {
              id: true,
              phone: true,
              house_no: true,
              street: true,
              landmark: true,
              city: true,
              state: true,
              country: true,
              pincode: true,
              address_type: true,
              is_primary: true,
              created_at: true,
              updated_at: true,
            },
            orderBy: { is_primary: 'desc' }, // primary address first
          },
        },
      });
  
      if (!user) return errorResponse(res, 404, 'User not found');
  
      return successResponse(res, 200, `Hello ${user.name}, Welcome Back`, {
        id: user.id,
        name: user.name,
        email: user.email,
        phone_number: user.phone_number,
        joined_at: user.created_at.toLocaleString('en-IN', {
          dateStyle: 'medium',
          timeStyle: 'short',
        }),
        profile_status: {
          email_status: user.verification?.email_status || 'PENDING',
          phone_status: user.verification?.phone_status || 'PENDING',
        },
        notify_product_updates: user.preference?.notify_product_updates ?? null,
        addresses: user.addresses ?? [],
      });
    } catch (error) {
      console.error(error);
      return errorResponse(res, 500, 'Internal server error');
    }
  }
  

  
static async getAllUsers(req, res) {
  try {
    const { skip, limit, search, page } = getPaginationParams(req);

    const whereClause = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { phone_number: { contains: search, mode: 'insensitive' } }
          ]
        }
      : {};

    const [users, totalCount] = await Promise.all([
      prisma.user.findMany({
        where: whereClause,
        include: {
          addresses: true,
          verification: true
        },
        skip,
        take: limit,
        orderBy: { created_at: 'desc' }
      }),
      prisma.user.count({ where: whereClause })
    ]);

    const processedUsers = users.map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone_number: user.phone_number,
      email_verified: user.verification?.email_status === 'VERIFIED',
      phone_verified: user.phone_number
        ? user.verification?.phone_status === 'VERIFIED'
        : false,
      addresses: user.addresses.map(address => ({
        id: address.id,
        phone: address.phone,
        house_no: address.house_no,
        street: address.street,
        landmark: address.landmark,
        city: address.city,
        state: address.state,
        country: address.country,
        pincode: address.pincode,
        address_type: address.address_type,
        is_primary: address.is_primary
      })),
      created_at: user.created_at,
      updated_at: user.updated_at
    }));

    return successResponse(res, 200, 'Users fetched successfully', {
      users: processedUsers,
      pagination: {
        totalRecords: totalCount,
        currentPage: page,
        perPage: limit,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error(`Get users error: ${error.message}`);
    return errorResponse(res, 500, 'Failed to fetch users');
  }
}

  static async updateUserRole(req, res) {
    try {
      const userId = parseInt(req.params.id);
      const { role } = req.body;

      if (!['USER', 'ADMIN'].includes(role)) {
        return errorResponse(res, 400, 'Invalid role. Must be either USER or ADMIN.');
      }

      const user = await prisma.user.update({
        where: { id: userId },
        data: { role },
      });

      return successResponse(res, 200, `User role updated to ${role}`, user);
    } catch (error) {
      console.error(`Update user role error: ${error.message}`);
      return errorResponse(res, 500, 'Failed to update user role');
    }
  }

  static async deleteUser(req, res) {
    try {
      const userId = parseInt(req.params.id);
      await prisma.userVerification.deleteMany({ where: { user_id: userId } });
      await prisma.address.deleteMany({ where: { user_id: userId } });
      const deletedUser = await prisma.user.delete({
        where: { id: userId },
      });

      return successResponse(res, 200, 'User deleted successfully', deletedUser);
    } catch (error) {
      console.error(`Delete user error: ${error.message}`);
      return errorResponse(res, 500, 'Failed to delete user');
    }
  }


}

export default UserController;
