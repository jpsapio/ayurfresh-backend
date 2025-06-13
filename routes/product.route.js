import { Router } from "express";
import ProductController from "../controllers/product.controller.js";
const routes = Router();
routes.get("/all-products",ProductController.getAll)
routes.get("/product-page/:slug",ProductController.getBySlug)
routes.get("/product-by-category/:categorySlug",ProductController.getByCategorySlug)
export default routes;
