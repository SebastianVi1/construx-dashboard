import { describe, expect, it } from 'bun:test'
import { rateLimitText } from './retryAfter'
import { messages } from '../../i18n/messages'

const texts = {
  rateLimited: 'Too many attempts. Please wait a moment and try again.',
  rateLimitedRetry: 'Too many attempts. Try again in {seconds} seconds.',
}

describe('rateLimitText', () => {
  it('puts the Retry-After seconds into the template', () => {
    expect(rateLimitText(texts, 42)).toBe('Too many attempts. Try again in 42 seconds.')
  })

  it('falls back to the generic text when Retry-After is missing', () => {
    expect(rateLimitText(texts, undefined)).toBe(texts.rateLimited)
  })

  it('falls back to the generic text for zero or negative seconds', () => {
    expect(rateLimitText(texts, 0)).toBe(texts.rateLimited)
    expect(rateLimitText(texts, -5)).toBe(texts.rateLimited)
  })

  it('rounds a fractional wait up to whole seconds', () => {
    expect(rateLimitText(texts, 1.2)).toBe('Too many attempts. Try again in 2 seconds.')
  })

  it('has a seconds placeholder in both languages', () => {
    expect(rateLimitText(messages.en.auth.error, 7)).toContain('7')
    expect(rateLimitText(messages.es.auth.error, 7)).toContain('7')
  })
})
