import vine, { errors } from "@vinejs/vine";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "../validations/auth.validation.js";
import prisma from "../config/db.js";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcrypt";
import { sendMail } from "../config/mail.js";
import { renderEmailEjs } from "../utils/ejsHandler.js";
import { BACKEND_URL, FRONTEND_URL } from "../config/env.js";
import { generateAuthToken, generateOTP } from "../utils/helper.js";
import { sendSMS } from "../config/twilioSms.js";
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
} from "../utils/responseHandler.js";

class AuthController {
  static async register(req, res) {
    try {
        const body = req.body;
        const validator = vine.compile(registerSchema);
        const payload = await validator.validate(body);

      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [{ email: payload.email }, { phone_number: payload.phone_number }],
        },
      });

      if (existingUser) {
        const isEmailConflict = existingUser.email === payload.email;

        return errorResponse(res, 422, {
          [isEmailConflict ? "email" : "phone_number"]: isEmailConflict
            ? "Email already exists"
            : "Phone number already exists",
        });
      }

      const hashedPassword = await bcrypt.hash(payload.password, 10);
      const verificationToken = uuidv4();
      const verificationUrl = `${FRONTEND_URL}/verify-email?email=${encodeURIComponent(
        payload.email
      )}&token=${verificationToken}`;

      const user = await prisma.user.create({
        data: {
          name: payload.name,
          email: payload.email,
          password: hashedPassword,
          phone_number: payload.phone_number,
          verification: {
            create: {
              email_verify_token: verificationToken,
            },
          },
        },
        include: { verification: true },
      });

      const html = await renderEmailEjs("verify-email", {
        name: user.name,
        url: verificationUrl,
      });

      await sendMail(user.email, "Verify Your Email - Ayurfresh", html);

      return successResponse(res, 200, `Registration successful! Check ${user.name} email for verification`);
    } catch (error) {

      if (error instanceof errors.E_VALIDATION_ERROR) {
        console.log(error.messages);
        
        return validationErrorResponse(res, error.messages);
      }
      return errorResponse(res, 500, error.message);
    }
  }

  static async verifyEmail(req, res) {
    try {
      const { email, token } = req.query;
      console.log("Received:", email, token);
  
      const user = await prisma.user.findUnique({
        where: { email },
      });
  
      if (!user) {
        return errorResponse(res, 400, "User not found");
      }
  
      const verification = await prisma.userVerification.findUnique({
        where: { user_id: user.id },
      });
  
      if (!verification || verification.email_verify_token !== token) {
        return errorResponse(res, 400, "Invalid verification link");
      }
  
      await prisma.userVerification.update({
        where: { user_id: user.id },
        data: {
          email_status: "VERIFIED",
          email_verify_token: null,
          email_verified_at: new Date(),
        },
      });
  
      return successResponse(res, 200, "Email verified successfully!", {
        email: user.email,
        verified_at: new Date(),
      });
    } catch (error) {
      console.error("Verification Error:", error);
      return errorResponse(res, 500, error.message);
    }
  }
  



static async resendEmailVerification  (req, res)  {
    try {
      const { email } = req.body;
  
      if (!email) {
        return errorResponse(res, 400, "Email is required");
      }
  
      const user = await prisma.user.findUnique({
        where: { email },
        include: { verification: true },
      });
  
      if (!user) {
        return errorResponse(res, 404, "User not found with this email");
      }
  
      if (user.verification?.email_status === "VERIFIED") {
        return errorResponse(res, 400, "Email already verified");
      }
  
      const newToken = uuidv4();
      const verificationUrl = `${BACKEND_URL}/api/auth/verify-email?email=${encodeURIComponent(email)}&token=${newToken}`;
  
      await prisma.userVerification.update({
        where: { user_id: user.id },
        data: {
          email_verify_token: newToken,
        },
      });
  
      const html = await renderEmailEjs("verify-email", {
        name: user.name,
        url: verificationUrl,
      });
  
      await sendMail(user.email, "Resend Email Verification - Ayurfresh", html);
  
      return successResponse(res, 200, `Verification link resent to ${email}`);
    } catch (error) {
      console.error(error);
      if (error instanceof errors.E_VALIDATION_ERROR) {
        return validationErrorResponse(res, 422, error.messages);
      }
      return errorResponse(res, 500, error.message);
    }
  };

static async login(req, res) {
  try {
    const validator = vine.compile(loginSchema);
    const { login, password } = await validator.validate(req.body);

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: login }, { phone_number: login }],
      },
      include: { verification: true },
    });

    if (!user) {
      return errorResponse(res, 401, "Invalid Phone number or Email.");
    }

    if (user.verification?.email_status !== "VERIFIED") {
      return errorResponse(res, 403, "Email not verified. Please verify your email first.");
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return errorResponse(res, 401, "Incorrect password.");
    }

    const token = generateAuthToken({
      userId: user.id,
      role: user.role,
      email: user.email,
    });

    return successResponse(res, 200, "Login successful", {
      name: user.name,
      email: user.email,
      token,
    });
  } catch (error) {
    if (error instanceof errors.E_VALIDATION_ERROR) {
      return validationErrorResponse(res, error.messages);
    }
    console.error("Login Error:", error);
    return errorResponse(res, 500, error.message);
  }
}


  static async resetPassword(req, res) {
    try {
      const validator = vine.compile(changePasswordSchema);
      const { oldPassword, newPassword } = await validator.validate(req.body);

      const user = await prisma.user.findUnique({
        where: { id: req.user.userId },
        select: { password: true, email: true },
      });

      if (!user) return errorResponse(res, 404, "User not found");

      const isValid = await bcrypt.compare(oldPassword, user.password);
      if (!isValid) return errorResponse(res, 401, "Old password is incorrect");

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await prisma.user.update({
        where: { id: req.user.userId },
        data: { password: hashedPassword },
      });

      const html = await renderEmailEjs("message", {
        title: "Password reset message",
        message: "The password has been successfully reset. Click below to go to our website.",
        redirectUrl: FRONTEND_URL,
      });

      await sendMail(user.email, "Password Changed Successfully", html);
      return successResponse(res, 200, "Password updated! Please login again");
    } catch (error) {
      console.log(error);
      if (error instanceof errors.E_VALIDATION_ERROR) {
        return validationErrorResponse(res, error.messages);
      }
      return errorResponse(res, 500, error.message);
    }
  }

  static async forgetPassword(req, res) {
    try {
      const validator = vine.compile(forgotPasswordSchema);
      const payload = await validator.validate(req.body);

      const user = await prisma.user.findUnique({
        where: { email: payload.email },
        include: { verification: true },
      });

      if (!user) return errorResponse(res, 404, "User not found");

      const resetToken = uuidv4();
      const expiry = new Date(Date.now() + 1000 * 60 * 30); // 30 min
      const resetUrl = `${FRONTEND_URL}/reset-password?email=${encodeURIComponent(
        user.email
      )}&token=${resetToken}`;

      await prisma.userVerification.update({
        where: { user_id: user.id },
        data: {
          password_reset_token: resetToken,
          reset_token_expiry: expiry,
        },
      });

      const html = await renderEmailEjs("forget-password", {
        name: user.name,
        url: resetUrl,
      });

      await sendMail(user.email, "Reset Your Password - Ayurfresh", html);
      return successResponse(res, 200, "Reset link sent to your email");
    } catch (error) {
      console.log(error);
      if (error instanceof errors.E_VALIDATION_ERROR) {
        return validationErrorResponse(res, error.messages);
      }
      return errorResponse(res, 500, error.message);
    }
  }

  static async resetForgottenPassword(req, res) {
    try {
      const validator = vine.compile(resetPasswordSchema);
      const payload = await validator.validate(req.body);

      const user = await prisma.user.findUnique({
        where: { email: payload.email },
        include: { verification: true },
      });

      if (
        !user ||
        !user.verification?.password_reset_token ||
        user.verification.password_reset_token !== payload.token ||
        new Date(user.verification.reset_token_expiry) < new Date()
      ) {
        return errorResponse(res, 400, "Invalid or expired token");
      }

      const hashedPassword = await bcrypt.hash(payload.password, 10);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          verification: {
            update: {
              password_reset_token: null,
              reset_token_expiry: null,
            },
          },
        },
      });

      return successResponse(res, 200, "Password reset successfully!", {
        email: user.email,
        reset_at: new Date(),
      });
    } catch (error) {
      console.log(error);
      if (error instanceof errors.E_VALIDATION_ERROR) {
        return validationErrorResponse(res, error.messages);
      }
      return errorResponse(res, 500, error.message);
    }
  }

  static async sendPhoneOtp(req, res) {
    try {
      const userId = req.user?.userId;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { verification: true },
      });

      if (!user || !user.phone_number) {
        return errorResponse(res, 400, "Phone number not found for user");
      }

      if (user.verification?.phone_status === "VERIFIED") {
        return successResponse(res, 200, "Phone number already verified");
      }

      const otp = generateOTP();
      const expiry = new Date(Date.now() + 5 * 60 * 1000);

      await prisma.userVerification.upsert({
        where: { user_id: userId },
        update: {
          phone_otp: otp,
          otp_expiry: expiry,
        },
        create: {
          user_id: userId,
          phone_otp: otp,
          otp_expiry: expiry,
        },
      });

      const smsRes = await sendSMS(user.phone_number, `Your OTP is ${otp}. Valid for 5 minutes.`);

      if (!smsRes.success) {
        return errorResponse(res, 500, smsRes.error || "Failed to send OTP");
      }

      return successResponse(res, 200, "OTP sent successfully");
    } catch (err) {
      console.error(err);
      return errorResponse(res, 500, err.message);
    }
  }

  static async verifyPhoneOtp(req, res) {
    try {
      const userId = req.user?.userId;
      const { otp } = req.body;

      if (!otp) {
        return errorResponse(res, 400, "OTP is required");
      }

      const verification = await prisma.userVerification.findUnique({
        where: { user_id: userId },
      });

      if (!verification) {
        return errorResponse(res, 400, "No OTP found for user");
      }

      if (verification.phone_status === "VERIFIED") {
        return successResponse(res, 200, "Phone number already verified");
      }

      if (
        verification.phone_otp !== otp ||
        !verification.otp_expiry ||
        new Date() > verification.otp_expiry
      ) {
        return errorResponse(res, 400, "Invalid or expired OTP");
      }

      await prisma.userVerification.update({
        where: { user_id: userId },
        data: {
          phone_status: "VERIFIED",
          phone_verified_at: new Date(),
          phone_otp: null,
          otp_expiry: null,
        },
      });

      return successResponse(res, 200, "Phone number verified successfully");
    } catch (err) {
      console.error(err);
      return errorResponse(res, 500, err.message);
    }
  }
}

export default AuthController;
