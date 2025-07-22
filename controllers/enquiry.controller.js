import vine, { errors } from '@vinejs/vine'
import { enquiryValidator } from '../validations/enquiry.validation.js'
import prisma from '../config/db.js'
import { errorResponse, successResponse, validationErrorResponse } from '../utils/responseHandler.js'
import { getPaginationParams } from '../utils/helper.js'

class EnquiryController {

  // Create Enquiry
  static async create(req, res) {
    try {
      const body = req.body
      const validator = vine.compile(enquiryValidator)
      const payload = await validator.validate(body)

      const enquiry = await prisma.enquiry.create({
        data: payload
      })

      return successResponse(res, 201, 'Business enquiry submitted successfully', enquiry)

    } catch (error) {
      if (error instanceof errors.E_VALIDATION_ERROR) {
        return validationErrorResponse(res, error.messages)
      }
      console.error('Create Enquiry Error:', error.message)
      return errorResponse(res, 500, error.message)
    }
  }

// Get All Enquiries with Pagination & Search
static async getAll(req, res) {
  try {
    const { skip, limit, search, page } = getPaginationParams(req);

    const [enquiries, total] = await prisma.$transaction([
      prisma.enquiry.findMany({
        where: {
          OR: [
            { company_name: { contains: search, mode: 'insensitive' } },
            { contact_person: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search, mode: 'insensitive' } },
            { business_need: { contains: search, mode: 'insensitive' } },
          ],
        },
        orderBy: [
          { responded: 'asc' },
          { created_at: 'desc' },
        ],
        skip,
        take: limit,
      }),
      prisma.enquiry.count({
        where: {
          OR: [
            { company_name: { contains: search, mode: 'insensitive' } },
            { contact_person: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search, mode: 'insensitive' } },
            { business_need: { contains: search, mode: 'insensitive' } },
          ],
        },
      }),
    ]);

    return successResponse(res, 200, 'All enquiries fetched', {
      data: enquiries,
      total,
      page,
      record: limit
    });

  } catch (error) {
    console.error('Get All Enquiries Error:', error.message);
    return errorResponse(res, 500, 'Failed to fetch enquiries');
  }
}


  // Get Enquiry By ID
  static async getById(req, res) {
    try {
      const { id } = req.params

      const enquiry = await prisma.enquiry.findUnique({
        where: { id: parseInt(id) }
      })

      if (!enquiry) {
        return errorResponse(res, 404, 'Enquiry not found')
      }

      return successResponse(res, 200, 'Enquiry fetched', enquiry)

    } catch (error) {
      console.error('Get Enquiry By ID Error:', error.message)
      return errorResponse(res, 500, 'Failed to fetch enquiry')
    }
  }

  // Delete Enquiry
  static async delete(req, res) {
    try {
      const { id } = req.params

      await prisma.enquiry.delete({
        where: { id: parseInt(id) }
      })

      return successResponse(res, 200, 'Enquiry deleted successfully')

    } catch (error) {
      console.error('Delete Enquiry Error:', error.message)
      return errorResponse(res, 500, 'Failed to delete enquiry')
    }
  }

  // Toggle Responded Status
  static async toggleResponse(req, res) {
    try {
      const { id } = req.params

      const enquiry = await prisma.enquiry.findUnique({
        where: { id: parseInt(id) }
      })

      if (!enquiry) {
        return errorResponse(res, 404, 'Enquiry not found')
      }

      const updated = await prisma.enquiry.update({
        where: { id: parseInt(id) },
        data: { responded: !enquiry.responded }
      })

      return successResponse(res, 200, 'Enquiry response status updated', updated)

    } catch (error) {
      console.error('Toggle Response Error:', error.message)
      return errorResponse(res, 500, 'Failed to update enquiry response status')
    }
  }

}

export default EnquiryController
