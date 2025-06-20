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
  
      let {
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
        return errorResponse(res, 400, "At least one product image is required");
      }
  
      // ✅ Format name: Capitalize first letter of every word
      const formatTitle = (text) =>
        text
          .split(" ")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(" ");
      name = formatTitle(name);
  
      // ✅ Format description: Capitalize first letter, and first letter after full stop
      const formatDescription = (desc) => {
        return desc
          .trim()
          .replace(/\s*\.\s*/g, ". ") // normalize spacing
          .split(/(?<=\.)\s+/)
          .map((sentence, index) =>
            sentence.charAt(0).toUpperCase() + sentence.slice(1)
          )
          .join(" ");
      };
      description = formatDescription(description);
  
      // ✅ Offered price calculation
      const calculateOfferedPrice = (price, type, value) => {
        const numericPrice = parseFloat(price);
        const numericValue = parseFloat(value);
        if (!type || isNaN(numericValue)) return numericPrice;
  
        if (type === "PERCENTAGE") {
          return Math.max(numericPrice - (numericPrice * numericValue) / 100, 0);
        }
  
        if (type === "PRICE_OFF") {
          return Math.max(numericPrice - numericValue, 0);
        }
  
        return numericPrice;
      };
  
      const offered_price = calculateOfferedPrice(price, offer_type, offer_value);
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
  
      // ✅ Parse content
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
  
      return successResponse(res, 201, "Product created successfully!", product);
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
    const { slug } = req.params;
  
    try {
      // Step 1: Get category by slug
      const category = await prisma.category.findUnique({
        where: { slug },
      });
  
      if (!category) {
        return errorResponse(res, 404, "Category not found");
      }
  
      // Step 2: Get products with category_id
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
  
      // Step 3: Transform products
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
        `Total ${transformedProducts.length} products found in '${category.name}' category`,
        transformedProducts
      );
    } catch (error) {
      console.error("Get Products By Category Error:", error);
      return errorResponse(res, 500, "Internal server error");
    }
  }
  static async productPage(req, res) {
    const { slug } = req.params;
  
    try {
      // Step 1: Find product by slug including category and created_by
      const product = await prisma.product.findUnique({
        where: { slug },
        include: {
          category: {
            select: { name: true, slug: true },
          },
          created_by: {
            select: { id: true, name: true, email: true },
          },
        },
      });
  
      if (!product) {
        return errorResponse(res, 404, "Product not found");
      }
  
      // Step 2: Get all images of this product
      const images = await prisma.productImage.findMany({
        where: { product_id: product.id },
        select: { url: true },
      });
  
      // Step 3: Calculate offered price
      let offeredPrice = null;
      if (product.offer_type === "PRICE_OFF") {
        offeredPrice = product.price - product.offer_value;
      } else if (product.offer_type === "PERCENTAGE") {
        offeredPrice = Math.round(
          product.price - (product.price * product.offer_value) / 100
        );
      }
  
      // Step 4: Build final response
      const responseData = {
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
        category: {
          name: product.category.name,
          slug: product.category.slug,
        },
        images: images.map((img) => img.url),
        content: product.contents || [], // ← now taken directly from product
      };
  
      return successResponse(res, 200, "Product fetched successfully", responseData);
    } catch (error) {
      console.error("Get Product By Slug Error:", error);
      return errorResponse(res, 500, "Internal server error");
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
}

export default ProductController;
