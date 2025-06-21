import vine, { errors } from "@vinejs/vine";
import { categoryValidator } from "../validations/category.validation.js";
import { slugify } from "../utils/helper.js";
import prisma from "../config/db.js";
import {
  errorResponse,
  successResponse,
  validationErrorResponse,
} from "../utils/responseHandler.js";
class CategoryController {
  static async create(req, res) {
    try {
      const body = req.body;
      const validator = vine.compile(categoryValidator);
      const payload = await validator.validate(body);

      const slug = slugify(payload.name);

      const existing = await prisma.category.findFirst({
        where: { OR: [{ name: payload.name }, { slug }] },
      });

      if (existing)
        return errorResponse(res, 400, "Category name or slug already exists");

      const category = await prisma.category.create({
        data: {
          name: payload.name,
          slug,
          description: payload.description,
        },
      });

      return successResponse(res, 201, "Category created", category);
    } catch (error) {
      if (error instanceof errors.E_VALIDATION_ERROR) {
        console.log(error.messages);

        return validationErrorResponse(res, error.messages);
      }
      return errorResponse(res, 500, error.message);
    }
  }

  static async update(req, res) {
    try {
      const { id } = req.params;
      const payload = await vine.validate({
        schema: categoryValidator,
        data: req.body,
      });

      const slug = slugify(payload.name);

      const existing = await prisma.category.findFirst({
        where: {
          AND: [
            { OR: [{ name: payload.name }, { slug }] },
            { id: { not: parseInt(id) } },
          ],
        },
      });

      if (existing)
        return errorResponse(res, 400, "Category name or slug already in use");

      const updated = await prisma.category.update({
        where: { id: parseInt(id) },
        data: {
          name: payload.name,
          slug,
          description: payload.description,
        },
      });

      return successResponse(res, 200, "Category updated", updated);
    } catch (error) {
      console.error("Update Category Error:", error.message);
      return errorResponse(
        res,
        400,
        "Validation failed",
        error.messages || undefined
      );
    }
  }

  static async delete(req, res) {
    try {
      const { id } = req.params;
      await prisma.category.delete({ where: { id: parseInt(id) } });
      return successResponse(res, 200, "Category deleted");
    } catch (err) {
      console.error("Delete Category Error:", err.message);
      return errorResponse(res, 500, "Failed to delete category");
    }
  }

  static async getAll(req, res) {
    try {
      const categories = await prisma.category.findMany();
      return successResponse(res, 200, "All categories", categories);
    } catch (err) {
      return errorResponse(res, 500, "Failed to fetch categories");
    }
  }

  static async getById(req, res) {
    try {
      const { slug } = req.params;
      const category = await prisma.category.findUnique({
        where: { slug: slug },
      });
      if (!category) return errorResponse(res, 404, "Category not found");
      return successResponse(res, 200, "Category found", category);
    } catch (err) {
      return errorResponse(res, 500, "Failed to fetch category");
    }
  }
}
export default CategoryController;
