import vine from "@vinejs/vine";
import { CustomErrorReporter } from "./CustomErrorReporter.js";

vine.errorReporter = () => new CustomErrorReporter();
const phoneRegex = /^(?:\+91|0)?[6789]\d{9}$/

export const registerSchema = vine.object({
  name: vine.string().minLength(2).maxLength(150),
  email: vine.string().email(),
  phone_number: vine.string().regex(phoneRegex).optional(),
  password: vine.string().minLength(6).maxLength(32).confirmed(),
});

export const loginSchema = vine.object({
  login: vine.string().regex(
    /^(?:[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|[0-9]{10,15})$/,
    {
      message: 'Please enter a valid email or phone number'
    }
  ),
  password: vine.string().minLength(6).maxLength(32)
})



export const changePasswordSchema = vine.object({
  oldPassword: vine.string().minLength(8),
  newPassword: vine.string().minLength(8),
  confirmPassword: vine.string().sameAs('newPassword')
})

export const forgotPasswordSchema = vine.object({
  email: vine.string().email()
})
export const updateProfileSchema = vine.object({
  name: vine.string().minLength(3).maxLength(100).optional(),
  email: vine.string().email().optional(),
  phone_number: vine.string().mobile().optional(),
})
export const resetPasswordSchema = vine.object({
  email: vine.string().email(),
  token: vine.string(),
  password: vine.string().minLength(6),
  confirm_password: vine.string().sameAs('password'),
})