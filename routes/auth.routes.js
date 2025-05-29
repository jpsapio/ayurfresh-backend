import { Router } from "express";
import AuthController from "../controllers/auth.controller.js";
import { authLimiter } from "../middlewares/rateLimiter.middleware.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const routes = Router()
routes.get("/verify-email",authLimiter,AuthController.verifyEmail )
routes.post("/register",authLimiter, AuthController.register);
routes.post("/login",authLimiter, AuthController.login);
routes.post("/reset-password",authMiddleware, AuthController.resetPassword);
routes.post('/forget-password', AuthController.forgetPassword);
routes.post('/reset-forgot-password', AuthController.resetForgottenPassword);
routes.post("/send-phone-otp", authMiddleware, AuthController.sendPhoneOtp);
routes.post("/verify-phone", authMiddleware, AuthController .verifyPhoneOtp);


export default routes;