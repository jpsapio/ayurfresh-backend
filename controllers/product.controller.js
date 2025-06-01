import vine, { errors } from "@vinejs/vine"
import { errorResponse, successResponse, validationErrorResponse } from "../utils/responseHandler.js"
import prisma from "../config/db.js"
import slugify from "slugify"
import { calculateOfferedPrice, processAndUploadImages } from "../utils/helper.js"
import { productValidator } from "../validations/product.validation.js"
class ProductController {
 static async create(req, res) {
    try {
      const body = req.body;
      const validator = vine.compile(productValidator);
      const payload = await validator.validate(body);

      const {
        name,
        description,
        price,
        offer_type,
        offer_value,
        contents,
        deal_types,
        category_id,
        primary_image_index
      } = payload;

      if (!req.files || req.files.length === 0) {
        return errorResponse(res, 400, 'At least one product image is required');
      }

      const offered_price = calculateOfferedPrice(price, offer_type, offer_value);
      const slug = slugify(name + '-' + Date.now(), { lower: true });

      const uploadedImages = await processAndUploadImages(
        req.files,
        slug,
        parseInt(primary_image_index) || 0
      );
console.log(deal_types);
const dealTypesArray = Array.isArray(deal_types)
  ? deal_types
  : typeof deal_types === 'string'
    ? deal_types.split(',').map(d => d.trim())
    : [];
      const product = await prisma.product.create({
        data: {
          name,
          slug,
          description,
          price: parseFloat(price),
          offer_type: offer_type || null,
          offer_value: offer_value ? parseFloat(offer_value) : null,
          offered_price,
          contents: contents ? JSON.parse(contents) : {},
          deal_types:dealTypesArray,
          category_id: parseInt(category_id),
          user_id: req.admin.id,
          images: {
            create: uploadedImages
          }
        },
        include: { images: true }
      });

      return successResponse(res, 201, 'Product created successfully!', product);
    } catch (error) {
      console.log('Create Product Error:', error);
      if (error instanceof errors.E_VALIDATION_ERROR) {
        return validationErrorResponse(res,  error.messages);
      }
      return errorResponse(res, 500, 'Internal server error');
    }
  } 
}

export default ProductController;
