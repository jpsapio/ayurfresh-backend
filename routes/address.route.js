import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import AddressController from "../controllers/address.controller.js";
const routes = Router()
routes.get("/get",authMiddleware, AddressController.getAllAddresses )
routes.put("/update/:id",authMiddleware, AddressController.updateAddress);
routes.post("/create",authMiddleware, AddressController.createAddress);
routes.delete("/delete/:id",authMiddleware, AddressController.deleteAddress);
routes.patch('/set-primary/:id', authMiddleware,AddressController.setPrimaryAddress);
routes.get('/autofill',AddressController.pincodeLocation);


export default routes;