import { Router } from "express";
import AdminController from "../controllers/admin.controller.js";
import { adminProtect, authMiddleware } from "../middlewares/auth.middleware.js";
const routes = Router()

routes.get("/users",authMiddleware,adminProtect,AdminController.getAllUsers );
export default routes;