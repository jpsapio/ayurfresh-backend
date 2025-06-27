import fetch from 'node-fetch'
import prisma from '../config/db.js';
import vine, { errors } from '@vinejs/vine';
import { errorResponse, successResponse } from "../utils/responseHandler.js"
import logger from "../utils/logger.js"
import { createAddressSchema, updateAddressSchema } from "../validations/user.validation.js"
class AddressController {
  static async pincodeLocation(req, res) {
    const { pincode } = req.query;

    if (!pincode || !/^[1-9][0-9]{5}$/.test(pincode)) {
      return res.status(400).json({ success: false, message: 'Invalid PIN code' });
    }

    try {
      const resp = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
      const [data] = await resp.json();

      if (data.Status !== 'Success' || !data.PostOffice?.length) {
        return res.status(404).json({ success: false, message: 'Pincode not found', data: {} });
      }

      const areas = data.PostOffice.map((po) => ({
        name: po.Name,
        type: po.BranchType,
        deliveryStatus: po.DeliveryStatus,
        taluk: po.Taluk,
        district: po.District,
        state: po.State,
        country: po.Country,
        block: po.Block,
        region: po.Region,
      }));

      const uniqueAreas = Array.from(new Map(areas.map(a => [a.name, a])).values());

      return res.status(200).json({
        success: true,
        message: 'Pincode fetched successfully',
        data: {
          pincode,
          areas: uniqueAreas,
        },
      });
    } catch (err) {
      console.error('PIN autofill error', err);
      return res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  static async getAllAddresses(req, res) {
    try {
      const addresses = await prisma.address.findMany({
        where: { user_id: req.user.userId },
        orderBy: [{ is_primary: 'desc' }, { updated_at: 'desc' }]
      });
      return successResponse(res, 200, "User addresses", addresses);
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
  
      await prisma.address.updateMany({
        where: { user_id: userId },
        data: { is_primary: false },
      });
  
      const address = await prisma.address.create({
        data: {
          ...data,
          is_primary: true, 
          user_id: userId,
        },
      });
  
      return successResponse(res, 201, 'Address created successfully', address);
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

      if (data.is_primary) await AddressController.resetPrimaryAddress(userId);

      const updated = await prisma.address.updateMany({
        where: { id: parseInt(id), user_id: userId },
        data
      });

      if (updated.count === 0) {
        return errorResponse(res, 404, 'Address not found or you don\'t have permission');
      }

      const updatedAddress = await prisma.address.findUnique({ where: { id: parseInt(id) } });
      return successResponse(res, 200, 'Address updated successfully', updatedAddress);
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

      return successResponse(res, 200, 'Address deleted successfully', {});
    } catch (error) {
      logger.error(`Delete address error: ${error.message}`);
      return errorResponse(res, 500, 'Failed to delete address');
    }
  }

  static async setPrimaryAddress(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.userId;
        const address = await prisma.address.findUnique({
        where: { id: parseInt(id) },
      });
  
      if (!address || address.user_id !== userId) {
        return errorResponse(res, 404, 'Address not found');
      }
        await prisma.address.updateMany({
        where: { user_id: userId },
        data: { is_primary: false },
      });
        const primaryAddress = await prisma.address.update({
        where: { id: parseInt(id) },
        data: { is_primary: true },
      });
  
      return successResponse(res, 200, 'Primary address updated', primaryAddress);
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
}

export default AddressController;

