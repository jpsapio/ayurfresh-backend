import { Router } from "express";
import AdminController from "../controllers/admin.controller.js";
import { adminProtect, authMiddleware } from "../middlewares/auth.middleware.js";
import ProductController from "../controllers/product.controller.js";
import { uploadProductImages } from "../middlewares/multer.middleware.js";
const routes = Router()

routes.get("/users",authMiddleware,adminProtect,AdminController.getAllUsers );
routes.post(
  "/upload-product",
 authMiddleware,adminProtect,
  uploadProductImages,
  ProductController.create
);
export default routes;