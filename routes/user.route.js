import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import UserController from '../controllers/user.controller.js'
const routes = Router()
routes.get("/address",authMiddleware, UserController.getAllAddresses )
routes.put("/address/:id",authMiddleware, UserController.updateAddress);
routes.post("/address",authMiddleware, UserController.createAddress);
routes.delete("/address/:id",authMiddleware, UserController.deleteAddress);
routes.patch('/address/:id', authMiddleware,UserController.setPrimaryAddress);
routes.put("/details",authMiddleware,UserController.updateProfile )
routes.get("/details",authMiddleware,UserController.getProfile)

export default routes;