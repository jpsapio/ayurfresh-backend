import vine, { errors } from '@vinejs/vine'
import prisma from '../config/db.js'
import logger from '../utils/logger.js'
import { createAddressSchema, updateAddressSchema } from '../validations/user.validation.js'
import { updateProfileSchema } from "../validations/auth.validation.js";
import { renderEmailEjs } from "../utils/ejsHandler.js";
import { sendMail } from "../config/mail.js";
import { APP } from "../config/env.js";

class UserController {
  static async getAllAddresses(req, res) {
    try {
      const addresses = await prisma.address.findMany({
        where: { user_id: req.user.userId },
        orderBy: [{ is_primary: 'desc' }, { updated_at: 'desc' }]
      })

      return res.json({
        success: true,
        data: addresses
      })
    } catch (error) {
      logger.error(`Get addresses error: ${error.message}`)
      return res.status(500).json({
        success: false,
        message: "Failed to fetch addresses"
      })
    }
  }

  static async createAddress(req, res) {
    try {
      const validator = vine.compile(createAddressSchema)
      const data = await validator.validate(req.body)
      const userId = req.user.userId
  
      if (data.is_primary) {
        await UserController.resetPrimaryAddress(userId)
      }
  
      const address = await prisma.address.create({
        data: { ...data, user_id: userId }
      })
  
      return res.status(201).json({
        success: true,
        message: "Address created successfully",
        data: address
      })
    } catch (error) {
      logger.error(`Create address error: ${error.message}`)
  
      if (error instanceof errors.E_VALIDATION_ERROR) {
        return res.status(422).json({
          success: false,
          message: "Validation failed",
          errors: error.messages
        })
      }
  
      return res.status(500).json({
        success: false,
        message: "Internal server error"
      })
    }
  }
  

  static async updateAddress(req, res) {
    try {
      const validator = vine.compile(updateAddressSchema)
      const data = await validator.validate(req.body)
      const { id } = req.params
      const userId = req.user.userId
  
      if (data.is_primary) {
        await UserController.resetPrimaryAddress(userId)
      }
  
      const updated = await prisma.address.updateMany({
        where: { id: parseInt(id), user_id: userId },
        data
      })
  
      if (updated.count === 0) {
        return res.status(404).json({
          success: false,
          message: "Address not found or you don't have permission"
        })
      }
  
      const updatedAddress = await prisma.address.findUnique({
        where: { id: parseInt(id) }
      })
  
      return res.json({
        success: true,
        message: "Address updated successfully",
        data: updatedAddress
      })
    } catch (error) {
      logger.error(`Update address error: ${error.message}`)
  
      if (error instanceof errors.E_VALIDATION_ERROR) {
        return res.status(422).json({
          success: false,
          message: "Validation failed",
          errors: error.messages
        })
      }
  
      return res.status(500).json({
        success: false,
        message: "Internal server error"
      })
    }
  }
s  
  

  static async deleteAddress(req, res) {
    try {
      const { id } = req.params
      const userId = req.user.userId

      const address = await prisma.address.findUnique({
        where: { id: parseInt(id), user_id: userId }
      })

      if (!address) {
        return res.status(404).json({
          success: false,
          message: "Address not found"
        })
      }

      await prisma.address.delete({
        where: { id: parseInt(id) }
      })

      if (address.is_primary) {
        const newPrimary = await prisma.address.findFirst({
          where: { user_id: userId },
          orderBy: { created_at: 'desc' }
        })

        if (newPrimary) {
          await prisma.address.update({
            where: { id: newPrimary.id },
            data: { is_primary: true }
          })
        }
      }

      return res.json({
        success: true,
        message: "Address deleted successfully"
      })
    } catch (error) {
      logger.error(`Delete address error: ${error.message}`)
      return res.status(500).json({
        success: false,
        message: "Failed to delete address"
      })
    }
  }

  static async setPrimaryAddress(req, res) {
    try {
      const { id } = req.params
      const userId = req.user.userId

      await UserController.resetPrimaryAddress(userId)

      const primaryAddress = await prisma.address.update({
        where: {
          id: parseInt(id),
          user_id: userId
        },
        data: { is_primary: true }
      })

      return res.json({
        success: true,
        message: "Primary address updated",
        data: primaryAddress
      })
    } catch (error) {
      logger.error(`Set primary error: ${error.message}`)
      return res.status(500).json({
        success: false,
        message: "Failed to set primary address"
      })
    }
  }

  static async resetPrimaryAddress(userId) {
    await prisma.address.updateMany({
      where: {
        user_id: userId,
        is_primary: true
      },
      data: { is_primary: false }
    })
  }
  static async updateProfile(req, res) {
    try {
      const userId = req.user?.userId;

      const validator = vine.compile(updateProfileSchema);
      const payload = await validator.validate(req.body);

      if (!Object.keys(payload).length) {
        return res.status(400).json({ message: "No fields to update" });
      }

      const user = await prisma.user.findUnique({ where: { id: userId } });

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      if (payload.email && payload.email !== user.email) {
        const emailUser = await prisma.user.findUnique({ where: { email: payload.email } });
        if (emailUser && emailUser.id !== userId) {
          return res.status(422).json({ errors: { email: "Email already in use" } });
        }
      }

      if (payload.phone_number && payload.phone_number !== user.phone_number) {
        const phoneUser = await prisma.user.findUnique({ where: { phone_number: payload.phone_number } });
        if (phoneUser && phoneUser.id !== userId) {
          return res.status(422).json({ errors: { phone_number: "Phone number already in use" } });
        }
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: payload,
      });
      const updates = Object.entries(payload)
        .map(([key, value]) => `<strong>${key}</strong>: ${value}`)
        .join("<br/>");

      const html = await renderEmailEjs('message', {
        title: "Profile Updated",
        message: `Your profile has been updated:<br/><br/>${updates}`,
        redirectUrl: null,
      });

      await sendMail(updatedUser.email, `Profile Updated - ${APP}`, html);

      return res.json({
        message: "Profile updated successfully!",
        data: {
          id: updatedUser.id,
          name: updatedUser.name,
          email: updatedUser.email,
          phone_number: updatedUser.phone_number,
        },
      });

    } catch (error) {
      console.error(error);

      if (error instanceof errors.E_VALIDATION_ERROR) {
        return res.status(422).json({ message: "Invalid data", errors: error.messages });
      }

      return res.status(500).json({ message: "Internal server error" });
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
          preference: {
            select: {
              notify_product_updates: true
            }
          },
          verification: {
            select: {
              email_status: true,
              phone_status: true
            }
          }
        }
      });
  
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
  
      return res.json({
        message:`hello ${user.name}, Welcome Back`,
        data: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone_number: user.phone_number,
          joined_at: user.created_at.toLocaleString('en-IN', {
            dateStyle: 'medium',
            timeStyle: 'short'
          }),
          notify_product_updates: user.preference?.notify_product_updates ?? false,
          profile_status: {
            email_status: user.verification?.email_status || "PENDING",
            phone_status: user.verification?.phone_status || "PENDING"
          }
        }
      });
  
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
  
}

export default UserController
