import { z } from 'zod'

/** A saved bar color: `#rrggbb` (stored lowercase), or empty for the default blue. */
export function colorSchema(message: string) {
  return z
    .string()
    .regex(/^(#[0-9a-fA-F]{6})?$/, message)
    .transform((value) => value.toLowerCase())
    .default('')
}

export type BarInk = 'dark' | 'light'

/** Text that stays readable on a solid fill of this color (WCAG relative luminance). */
export function barInk(color: string): BarInk {
  const channels = [1, 3, 5].map((offset) => {
    const value = parseInt(color.slice(offset, offset + 2), 16) / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
  return luminance > 0.179 ? 'dark' : 'light'
}
