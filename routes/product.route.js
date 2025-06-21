import { Router } from "express";
import ProductController from "../controllers/product.controller.js";
const routes = Router();
routes.get("/all-products",ProductController.getAll)
<<<<<<< HEAD
routes.get("/product-page/:slug",ProductController.getBySlug)
routes.get("/product-by-category/:categorySlug",ProductController.getByCategorySlug)
=======
routes.get("/product-by-category/:slug",ProductController.getByCategorySlug)
routes.get("/product-page/:slug",ProductController.productPage)
>>>>>>> 0ca8690f2ecb429b06ccf6422b445ea8dc7a1b00
export default routes;
