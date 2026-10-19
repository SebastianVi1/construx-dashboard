import { describe, expect, it } from 'bun:test'
import { z } from 'zod'
import { collectErrors } from './validation'

describe('collectErrors', () => {
  it('maps the first issue per field into a message map', () => {
    const schema = z.object({
      email: z.string().min(1, 'Enter your email').email('Enter a valid email'),
      password: z.string().min(1, 'Enter your password'),
    })

    const parsed = schema.safeParse({ email: '', password: '' })
    expect(parsed.success).toBe(false)
    if (parsed.success) return

    expect(collectErrors(parsed.error)).toEqual({
      email: 'Enter your email',
      password: 'Enter your password',
    })
  })

  it('keeps only the first message when several issues hit one field', () => {
    const schema = z.object({ email: z.string().min(1, 'Required').email('Invalid') })
    const parsed = schema.safeParse({ email: '' })
    expect(parsed.success).toBe(false)
    if (parsed.success) return

    expect(collectErrors(parsed.error)).toEqual({ email: 'Required' })
  })
})
