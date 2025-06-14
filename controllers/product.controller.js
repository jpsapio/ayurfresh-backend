import vine, { errors } from "@vinejs/vine";
import {
  errorResponse,
  successResponse,
  validationErrorResponse,
} from "../utils/responseHandler.js";
import prisma from "../config/db.js";
import slugify from "slugify";
import {
  calculateOfferedPrice,
  deleteCloudinaryImage,
  processAndUploadImages,
} from "../utils/helper.js";
import { productValidator } from "../validations/product.validation.js";
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
        stocks,
        deal_types,
        category_id,
        primary_image_index,
      } = payload;

      // ✅ Validate files
      if (!req.files || req.files.length === 0) {
        return errorResponse(
          res,
          400,
          "At least one product image is required"
        );
      }

      // ✅ Calculate offered price
      const offered_price = calculateOfferedPrice(
        price,
        offer_type,
        offer_value
      );
      const slug = slugify(name + "-" + Date.now(), { lower: true });

      // ✅ Upload images
      const uploadedImages = await processAndUploadImages(
        req.files,
        slug,
        parseInt(primary_image_index) || 0
      );

      // ✅ Deal types normalization
      const dealTypesArray = Array.isArray(deal_types)
        ? deal_types
        : typeof deal_types === "string"
        ? deal_types.split(",").map((d) => d.trim())
        : [];

      // ✅ Contents parsing and validation
      let parsedContents = [];

      if (contents) {
        try {
          parsedContents = JSON.parse(contents);

          const isValid =
            Array.isArray(parsedContents) &&
            parsedContents.every(
              (item) =>
                typeof item === "object" &&
                typeof item.key === "string" &&
                typeof item.value === "string"
            );

          if (!isValid) {
            return errorResponse(
              res,
              400,
              "Each content item must be an object with key and value"
            );
          }
        } catch (e) {
          return errorResponse(res, 400, "Invalid JSON format in contents");
        }
      }

      // ✅ Create Product
      const product = await prisma.product.create({
        data: {
          name,
          slug,
          description,
          price: parseFloat(price),
          offer_type: offer_type || null,
          offer_value: offer_value ? parseFloat(offer_value) : null,
          offered_price,
          stocks: stocks ?? 0,
          contents: parsedContents,
          deal_types: dealTypesArray,
          category_id: parseInt(category_id),
          user_id: req.admin.id,
          images: {
            create: uploadedImages,
          },
        },
        include: { images: true, category: true },
      });

      return successResponse(
        res,
        201,
        "Product created successfully!",
        product
      );
    } catch (error) {
      console.log("Create Product Error:", error);
      if (error instanceof errors.E_VALIDATION_ERROR) {
        return validationErrorResponse(res, error.messages);
      }
      return errorResponse(res, 500, "Internal server error");
    }
  }

  static async getAll(req, res) {
    try {
      const products = await prisma.product.findMany({
        include: {
          category: {
            select: {
              name: true,
              slug: true,
            },
          },
          images: {
            select: {
              url: true,
            },
          },
          created_by: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          created_at: "desc",
        },
      });
  
      const transformedProducts = products.map((product) => {
        const words = product.description.split(" ");
        const shortDescription =
          words.length > 12 ? words.slice(0, 12).join(" ") + "..." : product.description;
  
        let offeredPrice = null;
        if (product.offer_type === "PRICE_OFF") {
          offeredPrice = product.price - product.offer_value;
        } else if (product.offer_type === "PERCENTAGE") {
          offeredPrice = Math.round(product.price - (product.price * product.offer_value) / 100);
        }
  
        return {
          id: product.id,
          name: product.name,
          slug: product.slug,
          description: shortDescription,
          price: product.price,
          stocks: product.stocks,
          offer_value: product.offer_value,
          offer_type: product.offer_type,
          offered_price: offeredPrice,
          category_id: product.category_id,
          user_id: product.user_id,
          deal_type: product.deal_types || [],
          created_at: product.created_at,
          category: {
            name: product.category.name,
            slug: product.category.slug,
          },
          image: product.images.length > 0 ? product.images[0].url : null,
        };
      });
  
      return successResponse(
        res,
        200,
        `Total ${transformedProducts.length} products available`,
        transformedProducts
      );
    } catch (error) {
      console.error("Get All Products Error:", error);
      return errorResponse(res, 500, "Internal server error");
    }
  }

  static async getByCategorySlug(req, res) {
  const { categorySlug } = req.params;

  if (!categorySlug) {
    return errorResponse(res, 400, "Category slug is required");
  }

  try {
    const category = await prisma.category.findUnique({
      where: { slug: categorySlug },
    });

    if (!category) {
      return errorResponse(res, 404, "Category not found");
    }

    const products = await prisma.product.findMany({
      where: {
        category_id: category.id,
      },
      include: {
        category: {
          select: {
            name: true,
            slug: true,
          },
        },
        images: {
          select: {
            url: true,
          },
        },
      },
      orderBy: {
        created_at: "desc",
      },
    });

    const transformedProducts = products.map((product) => {
      let offeredPrice = null;
      if (product.offer_type === "PRICE_OFF") {
        offeredPrice = product.price - product.offer_value;
      } else if (product.offer_type === "PERCENTAGE") {
        offeredPrice = Math.round(product.price - (product.price * product.offer_value) / 100);
      }

      return {
        id: product.id,
        name: product.name,
        slug: product.slug,
        description: product.description,
        price: product.price,
        stocks: product.stocks,
        offer_value: product.offer_value,
        offer_type: product.offer_type,
        offered_price: offeredPrice,
        category_id: product.category_id,
        user_id: product.user_id,
        deal_type: product.deal_types || [],
        created_at: product.created_at,
        category: product.category,
        image: product.images.length > 0 ? product.images[0].url : null,
      };
    });

    return successResponse(
      res,
      200,
      `Total ${transformedProducts.length} products found in category '${category.name}'`,
      transformedProducts
    );
  } catch (error) {
    console.error("Get Products By Category Slug Error:", error);
    return errorResponse(res, 500, "Internal server error");
  }
}

static async getBySlug(req, res) {
  const { slug } = req.params;

  try {
    const product = await prisma.product.findUnique({
      where: { slug },
      include: {
        category: {
          select: {
            name: true,
            slug: true,
          },
        },
        images: {
          select: {
            url: true,
          },
        },
        created_by: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!product) {
      return errorResponse(res, 404, "Product not found");
    }

    let offeredPrice = null;
    if (product.offer_type === "PRICE_OFF") {
      offeredPrice = product.price - product.offer_value;
    } else if (product.offer_type === "PERCENTAGE") {
      offeredPrice = Math.round(product.price - (product.price * product.offer_value) / 100);
    }

    const transformedProduct = {
      name: product.name,
      description: product.description,
      price: product.price,
      offer_type: product.offer_type,
      offer_value: product.offer_value,
      offered_price: offeredPrice,
      contents: product.contents || null,
      deal_type: product.deal_types || [],
      stocks: product.stocks,
      category: product.category,
      images: product.images.map((img) => img.url),
      created_by: product.created_by,
    };

    return successResponse(res, 200, "Product fetched successfully", transformedProduct);
  } catch (error) {
    console.error("Get Product By Slug Error:", error);
    return errorResponse(res, 500, "Internal server error");
  }
}

  
static async delete(req, res) {
  try {
    const { id } = req.params;
    const productId = parseInt(id);

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { images: true }
    });

    if (!product) {
      return errorResponse(res, 404, 'Product not found');
    }


    await Promise.all(
      product.images.map((img) => deleteCloudinaryImage(img.url))
    );

    await prisma.productImage.deleteMany({
      where: { product_id: productId }
    });
    await prisma.product.delete({
      where: { id: productId }
    });

    return successResponse(res, 200, 'Product deleted successfully');
  } catch (err) {
    console.error('Delete Product Error:', err);
    return errorResponse(res, 500, 'Internal Server Error');
  }
}

static async update(req, res) {
  try {
    const { id } = req.params;

    const existingProduct = await prisma.product.findUnique({
      where: { id: parseInt(id) },
      include: { images: true }
    });

    if (!existingProduct) {
      return errorResponse(res, 404, 'Product not found');
    }

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
      primary_image_index,
      stocks
    } = payload;

    const offered_price = calculateOfferedPrice(price, offer_type, offer_value);
    const slug = slugify(name + '-' + Date.now(), { lower: true });

    let uploadedImages = [];
    if (req.files && req.files.length > 0) {

      await Promise.all(existingProduct.images.map(img => deleteCloudinaryImage(img.url)));

      uploadedImages = await processAndUploadImages(req.files, slug, parseInt(primary_image_index) || 0);
    }

    const dealTypesArray = Array.isArray(deal_types)
      ? deal_types
      : typeof deal_types === 'string'
        ? deal_types.split(',').map(d => d.trim())
        : [];

    const updatedProduct = await prisma.product.update({
      where: { id: parseInt(id) },
      data: {
        name,
        slug,
        description,
        price: parseFloat(price),
        offer_type: offer_type || null,
        offer_value: offer_value ? parseFloat(offer_value) : null,
        offered_price,
        stocks: stocks ?? 0,
        contents: contents ? JSON.parse(contents) : [],
        deal_types: dealTypesArray,
        category_id: parseInt(category_id),
        ...(uploadedImages.length > 0 && {
          images: {
            deleteMany: {},
            create: uploadedImages
          }
        })
      },
      include: { images: true }
    });

    return successResponse(res, 200, 'Product updated successfully', updatedProduct);
  } catch (error) {
    console.error('Update Product Error:', error);
    if (error instanceof errors.E_VALIDATION_ERROR) {
      return validationErrorResponse(res, error.messages);
    }
    return errorResponse(res, 500, 'Internal server error');
  }
}

}

export default ProductController;
