import express from 'express'
import "dotenv/config"
import securityMiddleware from './middlewares/security.middleware.js';
import { requestLogger } from './utils/logger.js';
import { BACKEND_URL, NODE_ENV, PORT } from './config/env.js';
import routes from './routes/index.js';
import path from "path"
import { fileURLToPath } from 'url';
const app = express();  
 
const port = PORT ||3000;
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));
securityMiddleware(app);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.set("view engine", "ejs");
app.set("views", path.resolve(__dirname, "./views"));
app.use(express.static("public"))
app.use(requestLogger); 

app.use(routes)
  

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', environment: NODE_ENV });
});
app.listen(port, () => {
  console.log(`Server is running at ${BACKEND_URL}`);
});
