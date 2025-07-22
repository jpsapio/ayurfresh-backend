import vine, { errors } from '@vinejs/vine';
import prisma from '../config/db.js';
import { updateProfileSchema } from "../validations/auth.validation.js";
import { renderEmailEjs } from "../utils/ejsHandler.js";
import { sendMail } from "../config/mail.js";
import {  FRONTEND_URL, OTP_EXPIRY_MINUTES } from "../config/env.js";
import { successResponse, errorResponse } from '../utils/responseHandler.js';
import { generateOtp, getExpiryMinutesFromNow, getPaginationParams } from '../utils/helper.js';
import { sendSMS } from '../config/twilioSms.js';

class UserController {
  static async sendOtp(req, res) {
    try {
      const userId = req.user.userId;

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user || !user.phone_number) {
        return errorResponse(res, 404, "User or phone number not found.");
      }

      const otp = generateOtp(6);
      const expiry = getExpiryMinutesFromNow(OTP_EXPIRY_MINUTES);

      await prisma.userVerification.upsert({
        where: { user_id: userId },
        update: { phone_otp: otp, otp_expiry: expiry },
        create: {
          user_id: userId,
          phone_otp: otp,
          otp_expiry: expiry,
        },
      });

      const sms = await sendSMS(user.phone_number, `Your OTP is ${otp}`);
      if (!sms.success) {
        return errorResponse(res, 500, "Failed to send OTP.");
      }

      return successResponse(res, 200, "OTP sent successfully.");
    } catch (err) {
      console.error(err);
      return errorResponse(res, 500, "Internal server error.");
    }
  }

  static async resendOtp(req, res) {
    try {
      const userId = req.user.userId;

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user || !user.phone_number) {
        return errorResponse(res, 404, "User or phone number not found.");
      }

      const otp = generateOtp(6);
      const expiry = getExpiryMinutesFromNow(OTP_EXPIRY_MINUTES);

      await prisma.userVerification.update({
        where: { user_id: userId },
        data: { phone_otp: otp, otp_expiry: expiry },
      });

      const sms = await sendSMS(user.phone_number, `Your OTP is ${otp}`);
      if (!sms.success) {
        return errorResponse(res, 500, "Failed to resend OTP.");
      }

      return successResponse(res, 200, "OTP resent successfully.");
    } catch (err) {
      console.error(err);
      return errorResponse(res, 500, "Internal server error.");
    }
  }

  static async verifyOtp(req, res) {
    try {
      const { otp } = req.body;
      const userId = req.user.userId;

      const verification = await prisma.userVerification.findUnique({
        where: { user_id: userId },
      });

      if (!verification || !verification.phone_otp) {
        return errorResponse(res, 400, "No OTP sent.");
      }

      const now = new Date();
      if (verification.otp_expiry < now) {
        return errorResponse(res, 410, "OTP has expired.");
      }

      if (verification.phone_otp !== otp) {
        return errorResponse(res, 400, "Invalid OTP.");
      }

      await prisma.userVerification.update({
        where: { user_id: userId },
        data: {
          phone_status: "VERIFIED",
          phone_verified_at: now,
          phone_otp: null,
          otp_expiry: null,
        },
      });

      return successResponse(res, 200, "Phone number verified successfully.");
    } catch (err) {
      console.error(err);
      return errorResponse(res, 500, "Internal server error.");
    }
  }
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
  
      // Fetch users and count in parallel
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
  
      // Fetch preferences for all user IDs
      const userIds = users.map(user => user.id);
  
      const preferences = await prisma.userPreference.findMany({
        where: { user_id: { in: userIds } },
        select: {
          user_id: true,
          notify_product_updates: true
        }
      });
  
      // Map preferences to user ID for quick lookup
      const preferenceMap = {};
      preferences.forEach(pref => {
        preferenceMap[pref.user_id] = pref.notify_product_updates;
      });
  
      // Attach data
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
        notify_product_updates: preferenceMap[user.id] ?? false, // <- ✅ added
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
  static async toggleNotifyPreference(req, res) {
    try {
      const userId = req.user.userId;
  
      const existing = await prisma.userPreference.findUnique({
        where: { user_id: userId },
      });
  
      if (existing) {
        const updated = await prisma.userPreference.update({
          where: { user_id: userId },
          data: {
            notify_product_updates: !existing.notify_product_updates,
          },
        });
  
   
        return successResponse(res, 200, `Notifications ${updated.notify_product_updates ? "enabled" : "disabled"}`,updated.notify_product_updates);

      } else {
        const created = await prisma.userPreference.create({
          data: {
            user_id: userId,
            notify_product_updates: true,
          },
        });
        return successResponse(res, 200, 'Notifications enabled',created.notify_product_updates);

      }
    } catch (error) {
      console.error("Toggle preference error:", error);
      return errorResponse(res, 500, 'Internal server error !');
    }
  }
  

}

export default UserController;
