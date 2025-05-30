import prisma from "../config/db.js";
import { successResponse, errorResponse } from "../utils/responseHandler.js";

class AdminController {
  static async getAllUsers(req, res) {
    try {
      const users = await prisma.user.findMany({
        where: { role: 'USER' },
        include: {
          addresses: true,
          verification: true
        }
      });

      const processedUsers = users.map(user => ({
        id: user.id,
        name: user.name,
        email: user.email,
        phone_number: user.phone_number,
        email_verified: user.verification?.email_status === 'VERIFIED',
        phone_verified: user.phone_number
          ? user.verification?.phone_status === 'VERIFIED'
          : false,
        addresses: user.addresses.map(address => ({
          id: address.id,
          name: address.name,
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

      return successResponse(res,200,`Total ${processedUsers.length} users available `,processedUsers);
    } catch (error) {
      console.error(`Get users error: ${error.message}`);
      return errorResponse(res, 500, 'Failed to fetch users');
    }
  }
}

export default AdminController;
