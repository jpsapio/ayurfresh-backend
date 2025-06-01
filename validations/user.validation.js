import vine from '@vinejs/vine'
import { CustomErrorReporter } from './CustomErrorReporter.js';
vine.errorReporter = () => new CustomErrorReporter();

export const createAddressSchema = vine.object({
  name: vine.string().minLength(3),
  phone: vine.string().mobile({ locale: ['en-IN'] }),
  house_no: vine.string(),
  street: vine.string(),
  landmark: vine.string().optional(),
  city: vine.string(),
  state: vine.string(),
  country: vine.string()
    .optional()
    .transform((value) => value || 'India'),
  pincode: vine.string().fixedLength(6),
  address_type: vine.enum(['HOME', 'WORK', 'OTHER']),
  is_primary: vine.boolean().optional()
})

export const updateAddressSchema = vine.object({
  name: vine.string().minLength(3).optional(),
  phone: vine.string().mobile({ locale: ['en-IN'] }).optional(),
  house_no: vine.string().optional(),
  street: vine.string().optional(),
  landmark: vine.string().optional(),
  city: vine.string().optional(),
  state: vine.string().optional(),
  country: vine.string()
    .optional()
    .transform((value) => value || 'India'),
  pincode: vine.string().fixedLength(6).optional(),
  address_type: vine.enum(['HOME', 'WORK', 'OTHER']).optional(),
  is_primary: vine.boolean().optional()
})