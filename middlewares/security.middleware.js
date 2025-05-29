import helmet from 'helmet';
import cors from 'cors';

import { limiter } from './rateLimiter.middleware.js';

const securityMiddleware = (app) => {
  app.use(helmet());
  app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
      ? ['https://your-frontend-domain.com'] 
      : 'http://localhost:8000',
    methods: ['GET', 'POST', 'PUT','PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));

  app.use(limiter);
};

export default securityMiddleware;