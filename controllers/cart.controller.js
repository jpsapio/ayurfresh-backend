import prisma from "../config/db.js";
import { successResponse, errorResponse, validationErrorResponse } from "../utils/responseHandler.js";
import vine, { errors } from "@vinejs/vine";
import { addToCartSchema, removeCartItemSchema } from "../validations/user.validation.js";
import { updateCartQuantitySchema } from "../validations/product.validation.js";

export default class CartController {
  static async addToCart(req, res) {
    try {
      const body = req.body;
      const validator = vine.compile(addToCartSchema);
      const payload = await validator.validate(body);
  
      const { userId } = req.user;
      const { slug, quantity = 1 } = payload;
  
      const product = await prisma.product.findUnique({
        where: { slug },
      });
  
      if (!product) {
        return errorResponse(res, 404, "Product not found");
      }
  
      let cart = await prisma.cart.findUnique({
        where: { user_id: userId },
      });
  
      if (!cart) {
        cart = await prisma.cart.create({
          data: {
            user_id: userId,
          },
        });
      }
  
      const existingItem = await prisma.cartItem.findUnique({
        where: {
          cart_id_product_id: {
            cart_id: cart.id,
            product_id: product.id,
          },
        },
      });
  
      if (existingItem) {
        await prisma.cartItem.update({
          where: {
            cart_id_product_id: {
              cart_id: cart.id,
              product_id: product.id,
            },
          },
          data: {
            quantity: existingItem.quantity + quantity,
          },
        });
      } else {
        await prisma.cartItem.create({
          data: {
            cart_id: cart.id,
            product_id: product.id,
            quantity,
          },
        });
      }
  
      return successResponse(res, 200, `${product.name} added to cart`, {
        productName: product.name,
        slug: product.slug,
      });
    } catch (error) {
      if (error instanceof errors.E_VALIDATION_ERROR) {
        return validationErrorResponse(res, error.messages);
      }
      return errorResponse(res, 500, error.message);
    }
  }
  

  static async getCart(req, res) {
    try {
      const { userId } = req.user;

      const cart = await prisma.cart.findUnique({
        where: { user_id: userId },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  price: true,
                  offer_type: true,
                  offer_value: true,
                  images: {
                    select: { url: true },
                    take: 1,
                  },
                },
              },
            },
          },
        },
      });

      if (!cart) {
        return successResponse(res, 200, "Cart is empty", {
          items: [],
          total_price: 0,
          total_offer_price: 0,
        });
      }

      let total_price = 0;
      let total_offer_price = 0;

      const transformedItems = cart.items.map((item) => {
        const { product, quantity } = item;

        const image = product.images[0]?.url || null;
        const offered_price =
          product.offer_type === "PRICE_OFF"
            ? product.price - product.offer_value
            : product.offer_type === "PERCENTAGE"
            ? Math.round(product.price - (product.price * product.offer_value) / 100)
            : product.price;

        total_price += product.price * quantity;
        total_offer_price += offered_price * quantity;

        return {
          id: item.id,
          quantity,
          product: {
            id: product.id,
            name: product.name,
            slug: product.slug,
            image,
            price: product.price,
            offered_price,
          },
        };
      });

      return successResponse(res, 200, "Cart fetched successfully", {
        items: transformedItems,
        total_price,
        total_offer_price,
      });
    } catch (error) {
      return errorResponse(res, 500, error.message);
    }
  }

  static async removeFromCart(req, res) {
    try {
      const body = req.body;
      const validator = vine.compile(removeCartItemSchema);
      const payload = await validator.validate(body);
  
      const { userId } = req.user;
      const { slug } = payload;
  
      const product = await prisma.product.findUnique({
        where: { slug },
        select: { id: true, name: true },
      });
  
      if (!product) {
        return errorResponse(res, 404, "Product not found");
      }
  
      const cart = await prisma.cart.findUnique({
        where: { user_id: userId },
      });
  
      if (!cart) {
        return errorResponse(res, 404, "Cart not found");
      }
  
      const cartItem = await prisma.cartItem.findUnique({
        where: {
          cart_id_product_id: {
            cart_id: cart.id,
            product_id: product.id,
          },
        },
      });
  
      if (!cartItem) {
        return errorResponse(res, 404, "Product not found in cart");
      }
  
      await prisma.cartItem.delete({
        where: {
          cart_id_product_id: {
            cart_id: cart.id,
            product_id: product.id,
          },
        },
      });
  
      return successResponse(res, 200, `${product.name} removed from cart`, {
        productName: product.name,
        slug: slug,
      });
    } catch (error) {
      if (error instanceof errors.E_VALIDATION_ERROR) {
        return validationErrorResponse(res, error.messages);
      }
      return errorResponse(res, 500, error.message);
    }
  }
  

  static async updateQuantity(req, res) {
    try {
      const body = req.body;
      const validator = vine.compile(updateCartQuantitySchema);
      const payload = await validator.validate(body);
  
      const { userId } = req.user;
      const { slug, type } = payload;
  
      const product = await prisma.product.findUnique({
        where: { slug },
        select: { id: true, name: true },
      });
  
      if (!product) {
        return errorResponse(res, 404, "Product not found");
      }
  
      const cart = await prisma.cart.findUnique({
        where: { user_id: userId },
      });
  
      if (!cart) {
        return errorResponse(res, 404, "Cart not found");
      }
  
      const cartItem = await prisma.cartItem.findUnique({
        where: {
          cart_id_product_id: {
            cart_id: cart.id,
            product_id: product.id,
          },
        },
      });
  
      if (!cartItem) {
        return errorResponse(res, 404, "Product not found in cart");
      }
  
      let message = "";
      if (type === "INCREMENT") {
        await prisma.cartItem.update({
          where: {
            cart_id_product_id: {
              cart_id: cart.id,
              product_id: product.id,
            },
          },
          data: {
            quantity: cartItem.quantity + 1,
          },
        });
        message = `${product.name} quantity increased`;
      } else if (type === "DECREMENT") {
        if (cartItem.quantity === 1) {
          await prisma.cartItem.delete({
            where: {
              cart_id_product_id: {
                cart_id: cart.id,
                product_id: product.id,
              },
            },
          });
          message = `${product.name} removed from cart`;
        } else {
          await prisma.cartItem.update({
            where: {
              cart_id_product_id: {
                cart_id: cart.id,
                product_id: product.id,
              },
            },
            data: {
              quantity: cartItem.quantity - 1,
            },
          });
          message = `${product.name} quantity decreased`;
        }
      }
  
      return successResponse(res, 200, message, {
        productName: product.name,
        slug: slug,
      });
    } catch (error) {
      if (error instanceof errors.E_VALIDATION_ERROR) {
        return validationErrorResponse(res, error.messages);
      }
      return errorResponse(res, 500, error.message);
    }
  }
  
  
}
