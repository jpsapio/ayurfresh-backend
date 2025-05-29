import rateLimit from "express-rate-limit";
import { NODE_ENV } from "../config/env.js";

export const authLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 30,
    standardHeaders: "draft-7",
    legacyHeaders: false,
  });

  export const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max:NODE_ENV === 'production' ? 100 : 1000,
    standardHeaders: true,
    legacyHeaders: false,
  });