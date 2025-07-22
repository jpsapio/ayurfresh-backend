import { Router } from "express";
import AuthRoutes from "./auth.routes.js";
import UserRoute from "./user.route.js";
import AdminRoute from "./admin.routes.js";
import ProductRoute from "./product.route.js";
import CartRoute from "./cart.route.js";
import CategoryRoute from "./category.route.js";
import AddressRoute from "./address.route.js";
import EnquiryRoute from "./enquiry.route.js";
import PincodeRoute from "./serviceablePincode.route.js";
const routes = Router()

routes.use("/api/auth",AuthRoutes );
routes.use("/api/user",UserRoute );
routes.use("/api/address",AddressRoute );
routes.use("/api/admin",AdminRoute );
routes.use("/api/product",ProductRoute );
routes.use("/api/category",CategoryRoute );
routes.use("/api/cart",CartRoute );
routes.use("/api/pincode",PincodeRoute );
routes.use("/api/enquiry",EnquiryRoute );
export default routes;