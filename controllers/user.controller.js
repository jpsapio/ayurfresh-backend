import vine, { errors } from '@vinejs/vine';
import prisma from '../config/db.js';
import logger from '../utils/logger.js';
import { createAddressSchema, updateAddressSchema } from '../validations/user.validation.js';
import { updateProfileSchema } from "../validations/auth.validation.js";
import { renderEmailEjs } from "../utils/ejsHandler.js";
import { sendMail } from "../config/mail.js";
import { APP } from "../config/env.js";
import { successResponse, errorResponse } from '../utils/responseHandler.js';

class UserController {
  static async getAllAddresses(req, res) {
    try {
      const addresses = await prisma.address.findMany({
        where: { user_id: req.user.userId },
        orderBy: [{ is_primary: 'desc' }, { updated_at: 'desc' }]
      });
      return successResponse(res,200,"User addresses", addresses);
    } catch (error) {
      logger.error(`Get addresses error: ${error.message}`);
      return errorResponse(res, 500, 'Failed to fetch addresses');
    }
  }

  static async createAddress(req, res) {
    try {
      const validator = vine.compile(createAddressSchema);
      const data = await validator.validate(req.body);
      const userId = req.user.userId;

      if (data.is_primary) await UserController.resetPrimaryAddress(userId);

      const address = await prisma.address.create({ data: { ...data, user_id: userId } });
      return successResponse(res,201, 'Address created successfully',address );
    } catch (error) {
      console.log(error);
      if (error instanceof errors.E_VALIDATION_ERROR) {
        return errorResponse(res, 422, error.messages);
      }
      return errorResponse(res, 500, 'Internal server error');
    }
  }

  static async updateAddress(req, res) {
    try {
      const validator = vine.compile(updateAddressSchema);
      const data = await validator.validate(req.body);
      const { id } = req.params;
      const userId = req.user.userId;

      if (data.is_primary) await UserController.resetPrimaryAddress(userId);

      const updated = await prisma.address.updateMany({
        where: { id: parseInt(id), user_id: userId },
        data
      });

      if (updated.count === 0) {
        return errorResponse(res, 404, 'Address not found or you don\'t have permission');
      }

      const updatedAddress = await prisma.address.findUnique({ where: { id: parseInt(id) } });
      return successResponse(res,200, 'Address updated successfully', updatedAddress);
    } catch (error) {
      logger.error(`Update address error: ${error.message}`);
      if (error instanceof errors.E_VALIDATION_ERROR) {
        return errorResponse(res, 422, error.messages);
      }
      return errorResponse(res, 500, 'Internal server error');
    }
  }

  static async deleteAddress(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.userId;

      const address = await prisma.address.findUnique({
        where: { id: parseInt(id), user_id: userId }
      });

      if (!address) return errorResponse(res, 404, 'Address not found');

      await prisma.address.delete({ where: { id: parseInt(id) } });

      if (address.is_primary) {
        const newPrimary = await prisma.address.findFirst({
          where: { user_id: userId },
          orderBy: { created_at: 'desc' }
        });
        if (newPrimary) {
          await prisma.address.update({
            where: { id: newPrimary.id },
            data: { is_primary: true }
          });
        }
      }

      return successResponse(res, 200, 'Address deleted successfully',{});
    } catch (error) {
      logger.error(`Delete address error: ${error.message}`);
      return errorResponse(res, 500, 'Failed to delete address');
    }
  }

  static async setPrimaryAddress(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.userId;

      await UserController.resetPrimaryAddress(userId);

      const primaryAddress = await prisma.address.update({
        where: { id: parseInt(id), user_id: userId },
        data: { is_primary: true }
      });

      return successResponse(res,200, 'Primary address updated', primaryAddress);
    } catch (error) {
      console.log(`Set primary error: ${error.message}`);
      return errorResponse(res, 500, 'Failed to set primary address');
    }
  }

  static async resetPrimaryAddress(userId) {
    await prisma.address.updateMany({
      where: { user_id: userId, is_primary: true },
      data: { is_primary: false }
    });
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

      await sendMail(updatedUser.email, `Profile Updated - ${APP}`, html);

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
          verification: { select: { email_status: true, phone_status: true } }
        }
      });

      if (!user) return errorResponse(res, 404, 'User not found');

      return successResponse(res,200, `Hello ${user.name}, Welcome Back`, {
        id: user.id,
        name: user.name,
        email: user.email,
        phone_number: user.phone_number,
        joined_at: user.created_at.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
        profile_status: {
          email_status: user.verification?.email_status || 'PENDING',
          phone_status: user.verification?.phone_status || 'PENDING'
        }
      });
    } catch (error) {
      console.error(error);
      return errorResponse(res, 500, 'Internal server error');
    }
  }
}

export default UserController;
