import { Router } from "express";
import AuthRoutes from "./auth.routes.js";
import UserRoute from "./user.route.js";
const routes = Router()

routes.use("/api/auth",AuthRoutes );
routes.use("/api/user",UserRoute );
export default routes;