import jwt from 'jsonwebtoken'
import { JWT_SECRET } from '../config/env.js'

export const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1]
    if (!token) throw new Error("Unauthorized")
    
    const decoded = jwt.verify(token, JWT_SECRET)
    req.user = { userId: decoded.userId }
    next()
  } catch (error) {
    res.status(401).json({ message: "Invalid token" })
  }
}