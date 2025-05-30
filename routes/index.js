import { Router } from "express";
import AuthRoutes from "./auth.routes.js";
import UserRoute from "./user.route.js";
import AdminRoute from "./admin.routes.js";
const routes = Router()

routes.use("/api/auth",AuthRoutes );
routes.use("/api/user",UserRoute );
routes.use("/api/admin",AdminRoute );
export default routes;