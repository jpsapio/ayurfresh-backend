import dotenv from 'dotenv';

dotenv.config();

 export const  NODE_ENV= process.env.NODE_ENV || 'development'
 export const  PORT= process.env.PORT || 4000
 export const  DATABASE_URL= process.env.DATABASE_URL
 export const  JWT_SECRET= process.env.JWT_SECRET
 export const  RATE_LIMIT_WINDOW= 15 * 60 * 1000
 export const  RATE_LIMIT_MAX= process.env.NODE_ENV === 'production' ? 100 : 1000
 export const  BACKEND_URL= process.env.BACKEND_URL
 export const  SMTP_PASS= process.env.SMTP_PASS
 export const  SMTP_USER= process.env.SMTP_USER
 export const  SMTP_SERVER= process.env.SMTP_SERVER
 export const  SMTP_SENDER= process.env.SMTP_SENDER
 export const TWILIO_ACCOUNT_ID= process.env.TWILIO_ACCOUNT_ID
 export const TWILIO_AUTH_TOKEN= process.env.TWILIO_AUTH_TOKEN
 export const TWILIO_NUMBER= process.env.TWILIO_NUMBER
 export const  FRONTEND_URL= process.env.FRONTEND_URL
 export const  APP= process.env.APP
 
