import { describe, expect, it } from 'bun:test'
import { z } from 'zod'
import { collectErrors, visibleFieldState } from './validation'

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

describe('visibleFieldState', () => {
  const values = { email: 'a@b', password: '' }
  const allErrors = { email: 'Enter a valid email', password: 'Enter your password' }

  it('hides errors until a field is touched or a submit was attempted', () => {
    expect(visibleFieldState(values, allErrors, {}, false)).toEqual({ errors: {}, valid: {} })
    expect(visibleFieldState(values, allErrors, { email: true }, false).errors).toEqual({
      email: 'Enter a valid email',
    })
    expect(visibleFieldState(values, allErrors, {}, true).errors).toEqual(allErrors)
  })

  it('marks a touched, non-empty, error-free field as valid and follows value changes', () => {
    const touched = { email: true }
    expect(visibleFieldState({ ...values, email: 'a@b.co' }, { password: 'x' }, touched, false)).toEqual({
      errors: {},
      valid: { email: true },
    })
  })
})
