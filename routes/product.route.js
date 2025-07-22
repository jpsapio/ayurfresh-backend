import { Router } from "express";
import ProductController from "../controllers/product.controller.js";
const routes = Router();
routes.get("/all-products",ProductController.getAll)
routes.get("/product-by-category/:slug",ProductController.getByCategorySlug)
routes.get("/product-page/:slug",ProductController.productPage)

export default routes;
