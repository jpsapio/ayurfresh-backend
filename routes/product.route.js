import { Router } from "express";
import ProductController from "../controllers/product.controller.js";
const routes = Router();
routes.get("/all-products",ProductController.getAll)
export default routes;
