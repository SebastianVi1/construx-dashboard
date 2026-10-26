import { z } from 'zod'

export type ValidationMessages = {
  emailRequired: string
  emailInvalid: string
  passwordRequired: string
  passwordMin: string
  passwordMax: string
  passwordMismatch: string
}

export type LoginInput = { email: string; password: string }
export type RegistrationInput = { email: string; password: string }

export function makeLoginSchema(messages: ValidationMessages) {
  return z.object({
    email: z.string().trim().min(1, messages.emailRequired).email(messages.emailInvalid),
    password: z.string().min(1, messages.passwordRequired),
  })
}

export function makeRegistrationSchema(messages: ValidationMessages) {
  return z.object({
    email: z.string().trim().min(1, messages.emailRequired).email(messages.emailInvalid),
    password: z.string().min(12, messages.passwordMin).max(72, messages.passwordMax),
  })
}

export function makeForgotPasswordSchema(messages: ValidationMessages) {
  return z.object({
    email: z.string().trim().min(1, messages.emailRequired).email(messages.emailInvalid),
  })
}

export function makeResetPasswordSchema(messages: ValidationMessages) {
  return z
    .object({
      newPassword: z.string().min(12, messages.passwordMin).max(72, messages.passwordMax),
      confirmPassword: z.string(),
    })
    .refine((values) => values.confirmPassword === values.newPassword, {
      message: messages.passwordMismatch,
      path: ['confirmPassword'],
    })
}

export const csrfSchema = z.object({
  headerName: z.string().regex(/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/),
  token: z.string().min(1),
})

export const problemSchema = z.object({
  title: z.string().optional(),
  detail: z.string().optional(),
  status: z.number().int().optional(),
})

export const userSchema = z.object({
  id: z.union([z.string(), z.number()]),
  email: z.string().email(),
})

export type CurrentUser = z.infer<typeof userSchema>
