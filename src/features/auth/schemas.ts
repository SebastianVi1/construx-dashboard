import { z } from 'zod'

const email = z.string().trim().min(1, 'Enter your email address').email('Enter a valid email address')

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Enter your password'),
})

export const registrationSchema = z.object({
  email,
  password: z.string().min(12, 'Use at least 12 characters'),
})

export const csrfSchema = z.object({
  headerName: z.string().regex(/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/),
  token: z.string().min(1),
})

export const problemSchema = z.object({
  title: z.string().optional(),
  detail: z.string().optional(),
  status: z.number().int().optional(),
})

export type LoginInput = z.infer<typeof loginSchema>
export type RegistrationInput = z.infer<typeof registrationSchema>
