import vine, { errors } from "@vinejs/vine";
import { successResponse,   errorResponse,validationErrorResponse,} from "../utils/responseHandler.js";
import { reviewValidator } from "../validations/product.validation.js";
import prisma from "../config/db.js";
import { getPaginationParams } from "../utils/helper.js";


class ReviewController {
    static async create(req, res) {
      try {
        const user_id = req.user.userId;
        const { product_slug } = req.params;
          const validator = vine.compile(reviewValidator);
        const payload = await validator.validate(req.body);
        const product = await prisma.product.findUnique({
          where: { slug: product_slug },
          select: { id: true },
        });
  
        if (!product) return errorResponse(res, 404, "Product not found");
  
        const existingReview = await prisma.review.findUnique({
          where: {
            user_id_product_id: {
              user_id,
              product_id: product.id,
            },
          },
        });
  
        let review;
        if (existingReview) {
          review = await prisma.review.update({
            where: {
              user_id_product_id: {
                user_id,
                product_id: product.id,
              },
            },
            data: {
              rating: payload.rating,
              comment: payload.comment,
            },
          });
          return successResponse(res, 200, "Review updated", review);
        } else {
          review = await prisma.review.create({
            data: {
              user_id,
              product_id: product.id,
              rating: payload.rating,
              comment: payload.comment,
            },
          });
          return successResponse(res, 201, "Review created", review);
        }
      } catch (error) {
        if (error instanceof errors.E_VALIDATION_ERROR) {
          return validationErrorResponse(res, error.messages);
        }
        return errorResponse(res, 500, error.message);
      }
    }
  
    static async update(req, res) {
      try {
        const user_id = req.user.userId;
        const { id, product_slug } = req.params;
  
        const validator = vine.compile(reviewValidator);
        const payload = await validator.validate(req.body);
  
        const review = await prisma.review.findUnique({
          where: { id: Number(id) },
        });
  
        if (!review || review.user_id !== user_id) {
          return errorResponse(res, 403, "You are not authorized to update this review");
        }
  
        // confirm product_slug matches the review's product
        const product = await prisma.product.findUnique({
          where: { slug: product_slug },
        });
  
        if (!product || product.id !== review.product_id) {
          return errorResponse(res, 400, "Product mismatch");
        }
  
        const updated = await prisma.review.update({
          where: { id: Number(id) },
          data: {
            rating: payload.rating,
            comment: payload.comment,
          },
        });
  
        return successResponse(res, 200, "Review updated", updated);
      } catch (error) {
        if (error instanceof errors.E_VALIDATION_ERROR) {
          return validationErrorResponse(res, error.messages);
        }
        return errorResponse(res, 500, error.message);
      }
    }
  
    // ✅ Delete Review (by review id & product_slug)
    static async delete(req, res) {
      try {
        const user_id = req.user.userId;
        const { id, product_slug } = req.params;
  
        const review = await prisma.review.findUnique({
          where: { id: Number(id) },
        });
  
        if (!review || review.user_id !== user_id) {
          return errorResponse(res, 403, "You are not authorized to delete this review");
        }
  
        const product = await prisma.product.findUnique({
          where: { slug: product_slug },
        });
  
        if (!product || product.id !== review.product_id) {
          return errorResponse(res, 400, "Product mismatch");
        }
  
        await prisma.review.delete({
          where: { id: Number(id) },
        });
  
        return successResponse(res, 200, "Review deleted");
      } catch (error) {
        return errorResponse(res, 500, error.message);
      }
    }
    static async getAllByProduct(req, res) {
      try {
        const { product_slug } = req.params;
        const { page, limit, skip, search } = getPaginationParams(req, 10);
    
        const product = await prisma.product.findUnique({
          where: { slug: product_slug },
          select: { id: true },
        });
    
        if (!product) return errorResponse(res, 404, "Product not found");
    
        const whereClause = {
          product_id: product.id,
          ...(search && {
            comment: {
              contains: search,
              mode: "insensitive",
            },
          }),
        };
    
        const [total, reviews] = await Promise.all([
          prisma.review.count({ where: whereClause }),
          prisma.review.findMany({
            where: whereClause,
            skip,
            take: limit,
            orderBy: {
              created_at: "desc",
            },
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          }),
        ]);
    
        const totalPages = Math.ceil(total / limit);
    
        return successResponse(res, 200, "Reviews fetched", {
          total,
          page,
          totalPages,
          perPage: limit,
          reviews,
        });
      } catch (error) {
        return errorResponse(res, 500, error.message);
      }
    }
  }

export default ReviewController;
