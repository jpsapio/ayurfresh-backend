import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import UserController from '../controllers/user.controller.js'
import ReviewController from "../controllers/review.controller.js";
const routes = Router()
routes.put("/details",authMiddleware,UserController.updateProfile )
routes.get("/details",authMiddleware,UserController.getProfile)
routes.patch("/notify", authMiddleware, UserController.toggleNotifyPreference);
routes.post("/send-otp", authMiddleware, UserController.sendOtp);
routes.post("/verify-otp", authMiddleware, UserController.verifyOtp);
routes.post("/resend-otp", authMiddleware, UserController.resendOtp);
routes.post("/reviews/:product_slug", authMiddleware, ReviewController.create);
routes.put("/reviews/:product_slug/:id", authMiddleware, ReviewController.update);
routes.delete("/reviews/:product_slug/:id", authMiddleware, ReviewController.delete);
routes.get("/reviews/:product_slug", ReviewController.getAllByProduct);
export default routes;