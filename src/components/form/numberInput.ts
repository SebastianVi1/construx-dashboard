export type NumberRules = {
  /** Decimal places allowed; 0 keeps the field to whole numbers. */
  decimals: number
  /** Digits allowed before the dot. */
  maxDigits: number
}

/**
 * What the user typed, kept to digits and one dot: extra decimals and integer digits are dropped,
 * leading zeros collapse ("007" → "7") and a bare dot becomes "0.". Commas are thousands
 * separators, so they are ignored.
 */
export function cleanNumber(text: string, { decimals, maxDigits }: NumberRules): string {
  let whole = ''
  let fraction = ''
  let dot = false
  for (const char of text) {
    if (char >= '0' && char <= '9') {
      if (!dot) whole += char
      else if (fraction.length < decimals) fraction += char
    } else if (char === '.' && decimals > 0) {
      dot = true
    }
  }
  whole = whole.replace(/^0+(?=\d)/, '').slice(0, maxDigits)
  if (dot && !whole) whole = '0'
  return dot ? `${whole}.${fraction}` : whole
}

/** "1234567.8" → "1,234,567.8". */
export function groupDigits(raw: string): string {
  const [whole, fraction] = raw.split('.')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return fraction === undefined ? grouped : `${grouped}.${fraction}`
}

/** A money amount always ends in cents once the user leaves the field: "12" → "12.00". */
export function padCents(raw: string): string {
  if (!raw) return raw
  const [whole, fraction = ''] = raw.split('.')
  return `${whole}.${fraction.padEnd(2, '0')}`
}

/** Index in `display` just after its `count`-th digit or dot, skipping group separators. */
export function caretIndex(display: string, count: number): number {
  if (count <= 0) return 0
  let seen = 0
  for (let index = 0; index < display.length; index += 1) {
    if (display[index] !== ',') seen += 1
    if (seen === count) return index + 1
  }
  return display.length
}
