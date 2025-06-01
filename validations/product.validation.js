import vine from "@vinejs/vine"
import { CustomErrorReporter } from './CustomErrorReporter.js';
vine.errorReporter = () => new CustomErrorReporter();
export const productValidator = vine.object({
  name: vine.string().minLength(3),
  price: vine.number(),
  offer_type: vine.enum(['PERCENTAGE', 'PRICE_OFF']).optional(),
  offer_value: vine.number().optional(),
  category_id: vine.number(),
  primary_image_index: vine.number().optional(),
  contents: vine.string().optional(),
  description: vine.string().optional(),
deal_types: vine.array(vine.enum(['TRENDING', 'HOT', 'MOST_PREFERRED', 'NEW_ARRIVAL', 'BEST_SELLER'])).optional(),
});
