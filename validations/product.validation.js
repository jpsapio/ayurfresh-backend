import vine from "@vinejs/vine";
import { CustomErrorReporter } from "./CustomErrorReporter.js";
vine.errorReporter = () => new CustomErrorReporter();
export const productValidator = vine.object({
  name: vine.string().minLength(3),
  price: vine.number(),
  offer_type: vine.enum(["PERCENTAGE", "PRICE_OFF"]).optional(),
  offer_value: vine.number().optional(),
  category_id: vine.number(),
  primary_image_index: vine.number().optional(),
 contents: vine.string().optional(),
  description: vine.string().optional(),
  stocks: vine.number().optional(),
  deal_types: vine
    .array(
      vine.enum([
        "TRENDING",
        "HOT",
        "MOST_PREFERRED",
        "NEW_ARRIVAL",
        "BEST_SELLER",
      ])
    )
    .optional(),
});


export const productUpdateValidator = vine.object({
  name: vine.string().minLength(2).maxLength(100).optional(),
  description: vine.string().maxLength(1000).optional(),
  price: vine.number().positive().optional(),
  offer_type: vine.enum(['PERCENTAGE', 'FIXED']).optional(),
  offer_value: vine.number().positive().optional(),
  stocks: vine.number().min(0).optional(),
  contents: vine
    .array(
      vine.object({
        key: vine.string(),
        value: vine.string(),
      })
    )
    .optional(),
  deal_types: vine
    .array(
      vine.enum(['TRENDING', 'HOT', 'MOST_PREFERRED', 'NEW_ARRIVAL', 'BEST_SELLER'])
    )
    .optional(),
  category_id: vine.number().optional(),
  primary_image_index: vine.number().min(0).max(3).optional(),
})