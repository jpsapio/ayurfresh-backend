import vine from '@vinejs/vine';
import { CustomErrorReporter } from './CustomErrorReporter.js';

vine.errorReporter = () => new CustomErrorReporter();

export const createPincodeValidator = vine.object({
  pincode: vine.string().fixedLength(6),
  city: vine.string(),
  delivery_days: vine.number(),
  delivery_charge: vine.number(),
});

export const updatePincodeValidator = vine.object({
  pincode: vine.string().fixedLength(6),
  city: vine.string(),
  delivery_days: vine.number(),
  delivery_charge: vine.number(),
});
