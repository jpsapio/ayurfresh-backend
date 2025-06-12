import { Router } from "express";
import CategoryController from "../controllers/category.controller.js";
import { adminProtect, authMiddleware } from "../middlewares/auth.middleware.js";
const routes = Router()
routes.get("/all-categories", CategoryController.getAll);
routes.get("/get-by-id/:slug", CategoryController.getById);
routes.post("/create-category", authMiddleware,adminProtect, CategoryController.create);
routes.put("/update-category/:id", CategoryController.update);
routes.delete("/delete-category/:id", CategoryController.delete);

export default routes;