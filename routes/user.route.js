import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import UserController from '../controllers/user.controller.js'
const routes = Router()
routes.put("/details",authMiddleware,UserController.updateProfile )
routes.get("/details",authMiddleware,UserController.getProfile)

export default routes;