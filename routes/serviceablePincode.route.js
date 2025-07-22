import { Router } from "express";
import ServiceablePincodeController from "../controllers/serviceablePincode.controller.js";
const routes = Router();
routes.get("/all",ServiceablePincodeController.getAll)
routes.delete("/delete/:id",ServiceablePincodeController.delete)
routes.put("/update/:id",ServiceablePincodeController.update)
routes.post("/create",ServiceablePincodeController.create)
routes.post("/check",ServiceablePincodeController.checkAvailability)

export default routes;
