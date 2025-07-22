import vine from '@vinejs/vine'
import { CustomErrorReporter } from './CustomErrorReporter.js'
vine.errorReporter = () => new CustomErrorReporter()

export const enquiryValidator = vine.object({
  company_name: vine.string().trim().minLength(2),
  contact_person: vine.string().trim().minLength(2),
  email: vine.string().email(),
  phone: vine.string().mobile({ locale: ['en-IN'] }),
  business_need: vine.string().trim().minLength(5),
})
