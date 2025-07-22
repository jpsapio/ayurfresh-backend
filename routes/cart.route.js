

import { Router } from "express";
import CartController from "../controllers/cart.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
const routes = Router()

routes.post("/add", authMiddleware, CartController.addToCart);
routes.get("/get", authMiddleware, CartController.getCart);
routes.delete("/remove", authMiddleware, CartController.removeFromCart);
routes.patch("/update-quantity", authMiddleware, CartController.updateQuantity);

export default routes;