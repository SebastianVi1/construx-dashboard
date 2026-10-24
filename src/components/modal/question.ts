import { z } from 'zod'

export const questionOptionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
})

/**
 * A single multiple-choice question. `options` must be non-empty and have
 * unique `id`s so the selection maps unambiguously to one option. Extending to
 * multi-select or several questions means growing this schema — the modal only
 * ever consumes a `Question`, so the caller API stays stable.
 */
export const questionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  options: z
    .array(questionOptionSchema)
    .min(1)
    .refine((options) => new Set(options.map((option) => option.id)).size === options.length, {
      message: 'Option ids must be unique',
    }),
})

export type Question = z.infer<typeof questionSchema>
export type QuestionOption = z.infer<typeof questionOptionSchema>
