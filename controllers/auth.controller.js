import vine, { errors } from "@vinejs/vine";
import { changePasswordSchema, forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema } from "../validations/auth.validation.js";
import prisma from "../config/db.js";
import {v4 as uuidv4} from "uuid"
import bcrypt from "bcrypt"
import { sendMail } from "../config/mail.js";
import { renderEmailEjs } from "../utils/ejsHandler.js";
import { BACKEND_URL, FRONTEND_URL } from "../config/env.js";
import { generateAuthToken } from "../utils/helper.js";
import { generateOTP } from "../utils/helper.js";
import { sendSMS } from "../config/twilioSms.js";

class AuthController {
  static async register(req, res) {
    try {
      const body = req.body;
      const validator = vine.compile(registerSchema);
      const payload = await validator.validate(body);
      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [
            { email: payload.email },
            { phone_number: payload.phone_number },
          ],
        },
      });

      if (existingUser) {
        return res.status(422).json({
          errors: {
            [existingUser.email ? "email" : "phone_number"]: `${
              existingUser.email ? "Email" : "Phone_number"
            } already exists`,
          },
        });
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(payload.password, salt);
      const verificationToken = uuidv4();
      const verificationUrl = `${BACKEND_URL}/api/auth/verify-email?email=${encodeURIComponent(payload.email)}&token=${verificationToken}`;

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

      return res.json({
        message: `Registration successful! Check ${user.name} email for verification`
      });
    } catch (error) {
      console.log(error);
      
      if (error instanceof errors.E_VALIDATION_ERROR) {
        return res
          .status(422)
          .json({ message: "Invalid data", errors: error.messages });
      } else {
        return res.status(500).json({
          status: 500,
          message: "Something went wrong.Please try again.",
        });
      }
    }
  }
  static async verifyEmail(req, res) {
    try {
      const { email, token } = req.query;
  
      const user = await prisma.user.findUnique({
        where: { email },
        include: { verification: true },
      });
  
      if (!user || user.verification.email_verify_token !== token) {
        return res.status(400).json({
          message: "Invalid verification link",
        });
      }
  
      await prisma.userVerification.update({
        where: { user_id: user.id },
        data: {
          email_status: "VERIFIED",
          email_verify_token: null,
          email_verified_at: new Date(),
        },
      });
  
      res.json({
        message: "Email verified successfully!",
        data: {
          email: user.email,
          verified_at: new Date(),
        },
      });
    } catch (error) {
      console.error("Verification Error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }
  static async login(req, res) {
    try {
      const body = req.body;
      const validator = vine.compile(loginSchema);
      const { login, password } = await validator.validate(body);
      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { email: login },
            { phone_number: login }
          ]
        },
        include: { verification: true }
      })
  
      if (!user) {
        return res.status(401).json({
          message: 'Invalid Phone number or Email.'
        })
      }
  
      if (user.verification?.email_status !== 'VERIFIED') {
        return res.status(403).json({
          message: 'Email not verified. Please verify your email first.'
        })
      }
      const validPassword = await bcrypt.compare(password, user.password)
      if (!validPassword) {
        return res.status(401).json({
          message: 'Incorrect password.'
        })
      }
      const token = generateAuthToken(user)
  
      return res.json({
        message: 'Login successful',
        data: {
         name:user.name,
         email:user.email,
          token
        }
      })
  
    } catch (error) {
      if (error instanceof errors.E_VALIDATION_ERROR) {
        return res.status(422).json({
          message: 'Validation failed',
          errors: error.messages
        })
      }
      console.error('Login Error:', error)
      res.status(500).json({ message: 'Internal server error' })
    }
  }

static async resetPassword(req,res){
  try {
    const validator = vine.compile(changePasswordSchema)
    const { oldPassword, newPassword } = await validator.validate(req.body)
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { password: true }
    })
    if (!user) return res.status(404).json({ message: "User not found" })
    const isValid = await bcrypt.compare(oldPassword, user.password)
    if (!isValid) return res.status(401).json({ message: "Old password is incorrect" })
    const hashedPassword = await bcrypt.hash(newPassword, 10)
   const data =  await prisma.user.update({
      where: { id: req.user.userId },
      data: { password: hashedPassword }
    })
    const html = await renderEmailEjs('message', {title:"Password reset message",message:"The password has been successfully reset. Click on the below link to fo to our website.",redirectUrl:FRONTEND_URL})
    await sendMail(data.email, "Password Changed Successfully", html)
    res.json({ message: "Password updated! Please login again" })

  } catch (error) {
    console.log(error);
    
    if (error instanceof errors.E_VALIDATION_ERROR) {
      return res.status(422).json({ errors: error.messages })
    }
    res.status(500).json({ message: "Internal server error" })
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

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const resetToken = uuidv4();
      const resetUrl = `${FRONTEND_URL}/reset-password?email=${encodeURIComponent(user.email)}&token=${resetToken}`;
      const expiry = new Date(Date.now() + 1000 * 60 * 30); // 30 min

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

      return res.json({ message: "Reset link sent to your email" });
    } catch (error) {
      console.log(error);

      if (error instanceof errors.E_VALIDATION_ERROR) {
        return res.status(422).json({ message: "Invalid data", errors: error.messages });
      }

      return res.status(500).json({ message: "Internal server error" });
    }
  }
  static async resetForgottenPassword(req, res) {
    try {
      const validator = vine.compile(resetPasswordSchema);
      const payload = await validator.validate(req.body); // email, token, password, confirm_password
  
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
        return res.status(400).json({ message: "Invalid or expired token" });
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
  
      return res.json({
        message: "Password reset successfully!",
        data: {
          email: user.email,
          reset_at: new Date(),
        },
      });
    } catch (error) {
      console.log(error);
      if (error instanceof errors.E_VALIDATION_ERROR) {
        return res.status(422).json({
          message: "Invalid data",
          errors: error.messages,
        });
      }
  
      return res.status(500).json({ message: "Internal server error" });
    }
  }
  static async sendPhoneOtp(req, res) {
    try {
      const userId = req.user?.userId;
  
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { verification: true }
      });
  
      if (!user || !user.phone_number) {
        return res.status(400).json({ message: "Phone number not found for user" });
      }
  
      if (user.verification?.phone_status === "VERIFIED") {
        return res.json({ message: "Phone number already verified" });
      }
  
      const otp = generateOTP()
      const expiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now
  
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
        }
      });
  
      const smsRes = await sendSMS(user.phone_number, `Your OTP is ${otp}. Valid for 5 minutes.`);
  
      if (!smsRes.success) {
        return res.status(500).json({ message: "Failed to send OTP", error: smsRes.error });
      }
  
      return res.json({ message: "OTP sent successfully" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Internal server error" });
    }
  }
  
  static async verifyPhoneOtp(req, res) {
    try {
      const userId = req.user?.userId;
      const { otp } = req.body;
  
      if (!otp) {
        return res.status(400).json({ message: "OTP is required" });
      }
  
      const verification = await prisma.userVerification.findUnique({
        where: { user_id: userId }
      });
  
      if (!verification) {
        return res.status(400).json({ message: "No OTP found for user" });
      }
  
      if (verification.phone_status === "VERIFIED") {
        return res.json({ message: "Phone number already verified" });
      }
  
      if (
        verification.phone_otp !== otp ||
        !verification.otp_expiry ||
        new Date() > verification.otp_expiry
      ) {
        return res.status(400).json({ message: "Invalid or expired OTP" });
      }
  
      await prisma.userVerification.update({
        where: { user_id: userId },
        data: {
          phone_status: "VERIFIED",
          phone_verified_at: new Date(),
          phone_otp: null,
          otp_expiry: null
        }
      });
  
      return res.json({ message: "Phone number verified successfully" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Internal server error" });
    }
  }
}
export default AuthController;
