import jwt from "jsonwebtoken"
import { JWT_SECRET } from "../config/env.js"
export const generateAuthToken = (user) => {
    return jwt.sign(
      {
        userId: user.id,
        role: user.role
      },
     JWT_SECRET,
      { expiresIn: '15d' }
    )
  }
  
  export const  generateOTP=()=> {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
  