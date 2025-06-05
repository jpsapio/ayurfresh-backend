import { Router } from "express";
import AdminController from "../controllers/admin.controller.js";
import { adminProtect, authMiddleware } from "../middlewares/auth.middleware.js";
import ProductController from "../controllers/product.controller.js";
import { uploadProductImages } from "../middlewares/multer.middleware.js";
const routes = Router()

routes.get("/users",authMiddleware,adminProtect,AdminController.getAllUsers );
routes.delete("/delete-product/:id",authMiddleware,adminProtect,ProductController.delete );
routes.post(
  "/create-product",
 authMiddleware,adminProtect,
  uploadProductImages,
  ProductController.create
);
routes.patch(
  "/update-product/:id",
 authMiddleware,adminProtect,
  uploadProductImages,
  ProductController.update
);
export default routes;