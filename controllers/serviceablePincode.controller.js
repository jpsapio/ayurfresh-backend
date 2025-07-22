import vine, { errors } from "@vinejs/vine";
import prisma from "../config/db.js";
import { successResponse, errorResponse, validationErrorResponse } from "../utils/responseHandler.js";
import { createPincodeValidator, updatePincodeValidator } from "../validations/serviceablePincode.validation.js";
import { getPaginationParams } from "../utils/helper.js";

class ServiceablePincodeController {
  
  static async create(req, res) {
    try {
      const validator = vine.compile(createPincodeValidator);
      const payload = await validator.validate(req.body);

      const pincode = await prisma.serviceablePincode.create({
        data: payload,
      });

      return successResponse(res, 201, "Pincode added successfully", pincode);
    } catch (error) {
      if (error instanceof errors.E_VALIDATION_ERROR) {
        return validationErrorResponse(res, error.messages);
      }
      if (error.code === "P2002") {
        return errorResponse(res, 409, "Pincode already exists");
      }
      return errorResponse(res, 500, error.message);
    }
  }
  static async getAll(req, res) {
    try {
      const { page, limit, skip, search } = getPaginationParams(req, 10);

      const whereClause = {
        ...(search && {
          pincode: {
            contains: search,
            mode: "insensitive",
          },
        }),
      };

      const [total, pincodes] = await Promise.all([
        prisma.serviceablePincode.count({ where: whereClause }),
        prisma.serviceablePincode.findMany({
          where: whereClause,
          skip,
          take: limit,
          orderBy: { id: 'desc' },
        }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return successResponse(res, 200, "Pincodes fetched", {
        total,
        page,
        totalPages,
        perPage: limit,
        pincodes,
      });
    } catch (error) {
      return errorResponse(res, 500, error.message);
    }
  }

  // ✅ Update
  static async update(req, res) {
    try {
      const { id } = req.params;
      const validator = vine.compile(updatePincodeValidator);
      const payload = await validator.validate(req.body);

      const pincode = await prisma.serviceablePincode.update({
        where: { id: Number(id) },
        data: payload,
      });

      return successResponse(res, 200, "Pincode updated successfully", pincode);
    } catch (error) {
      if (error instanceof errors.E_VALIDATION_ERROR) {
        return validationErrorResponse(res, error.messages);
      }
      if (error.code === "P2025") {
        return errorResponse(res, 404, "Pincode not found");
      }
      return errorResponse(res, 500, error.message);
    }
  }

  static async delete(req, res) {
    try {
      const { id } = req.params;

      await prisma.serviceablePincode.delete({
        where: { id: Number(id) },
      });

      return successResponse(res, 200, "Pincode deleted successfully");
    } catch (error) {
      if (error.code === "P2025") {
        return errorResponse(res, 404, "Pincode not found");
      }
      return errorResponse(res, 500, error.message);
    }
  }

  static async checkAvailability(req, res) {
    try {
      const { pincode } = req.body;

      const record = await prisma.serviceablePincode.findUnique({
        where: { pincode },
      });

      if (record) {
        return successResponse(res, 200, "Delivery available", {
          message: `Delivery is available in your area. Delivery time: ${record.delivery_days} day(s). Delivery charge: ₹${record.delivery_charge}.`,
          data: record,
        });
      } else {
        return errorResponse(res, 404, 
          "Delivery not available in your area. Please call or email us to book delivery manually."
        );
      }
    } catch (error) {
      return errorResponse(res, 500, error.message);
    }
  }
}

export default ServiceablePincodeController;
