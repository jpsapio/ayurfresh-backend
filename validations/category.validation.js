
import vine from '@vinejs/vine'
import { CustomErrorReporter } from './CustomErrorReporter.js'
vine.errorReporter = () => new CustomErrorReporter()

export const categoryValidator = vine.object({
  name: vine.string().minLength(2),
  description: vine.string().optional()
})

