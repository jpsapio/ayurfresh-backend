import { Router } from "express";
import ProductController from "../controllers/product.controller.js";
const routes = Router();
import { uploadProductImages } from '../middlewares/multer.middleware.js'
import { authMiddleware, adminProtect } from "../middlewares/auth.middleware.js";

export default routes;
