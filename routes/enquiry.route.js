import { Router } from "express"
import EnquiryController from "../controllers/enquiry.controller.js"
const router = Router()
router.post('/create', EnquiryController.create)
router.get('/get', EnquiryController.getAll)
router.get('/get/:id', EnquiryController.getById)
router.delete('/delete/:id', EnquiryController.delete)
router.patch('/toggle-response/:id', EnquiryController.toggleResponse)

export default router