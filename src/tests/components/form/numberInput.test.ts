import { describe, expect, test } from 'bun:test'
import { caretIndex, cleanNumber, groupDigits, padCents } from '../../../components/form/numberInput'

const money = { decimals: 2, maxDigits: 12 }

describe('cleanNumber', () => {
  test('keeps digits and one dot, drops everything else', () => {
    expect(cleanNumber('$1,234.5a6', money)).toBe('1234.56')
    expect(cleanNumber('1.2.3', money)).toBe('1.23')
    expect(cleanNumber('-50', money)).toBe('50')
  })

  test('limits decimals and integer digits', () => {
    expect(cleanNumber('10.999', money)).toBe('10.99')
    expect(cleanNumber('1234567890123', money)).toBe('123456789012')
    expect(cleanNumber('12.5', { decimals: 0, maxDigits: 4 })).toBe('125')
  })

  test('collapses leading zeros and completes a bare dot', () => {
    expect(cleanNumber('007', money)).toBe('7')
    expect(cleanNumber('0', money)).toBe('0')
    expect(cleanNumber('.', money)).toBe('0.')
    expect(cleanNumber('00.5', money)).toBe('0.5')
    expect(cleanNumber('', money)).toBe('')
  })
})

describe('money display', () => {
  test('groups thousands and keeps what was typed after the dot', () => {
    expect(groupDigits('1234567.8')).toBe('1,234,567.8')
    expect(groupDigits('999')).toBe('999')
    expect(groupDigits('1000.')).toBe('1,000.')
  })

  test('pads cents when leaving the field', () => {
    expect(padCents('12')).toBe('12.00')
    expect(padCents('12.5')).toBe('12.50')
    expect(padCents('0.')).toBe('0.00')
    expect(padCents('')).toBe('')
  })

  test('puts the caret after the same digit once separators move', () => {
    expect(caretIndex('1,234', 2)).toBe(3)
    expect(caretIndex('1,234', 0)).toBe(0)
    expect(caretIndex('1,234.5', 6)).toBe(7)
    expect(caretIndex('12', 9)).toBe(2)
  })
})
