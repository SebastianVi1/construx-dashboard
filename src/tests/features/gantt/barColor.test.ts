import { describe, expect, it } from 'bun:test'
import { barInk, colorSchema } from '../../../features/gantt/barColor'

describe('bar colors', () => {
  it('keeps labels readable on solid light and dark fills', () => {
    expect(barInk('#ffffff')).toBe('dark')
    expect(barInk('#000000')).toBe('light')
    expect(barInk('#facc15')).toBe('dark')
    expect(barInk('#1e3a8a')).toBe('light')
  })

  it('validates custom hex values, lowercases them and allows the default', () => {
    const schema = colorSchema('Invalid color')
    expect(schema.parse('#ABCDEF')).toBe('#abcdef')
    expect(schema.parse('')).toBe('')
    expect(schema.safeParse('red').success).toBe(false)
    expect(schema.safeParse('#12345').success).toBe(false)
  })
})
