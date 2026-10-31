import { describe, expect, test } from 'bun:test'
import { displayName, initials } from '../../../features/profile/profileDisplay'

describe('initials', () => {
  test('uses the first letters of the first and last name', () => {
    expect(initials('Ana María López', 'ana@example.com')).toBe('AL')
  })

  test('uses one letter for a single name', () => {
    expect(initials('  ana ', 'ana@example.com')).toBe('A')
  })

  test('falls back to the email when there is no name', () => {
    expect(initials(null, 'bruno@example.com')).toBe('B')
    expect(initials('   ', 'carla@example.com')).toBe('C')
  })
})

describe('displayName', () => {
  test('prefers the trimmed full name and falls back to the email', () => {
    expect(displayName(' Ana López ', 'ana@example.com')).toBe('Ana López')
    expect(displayName(null, 'ana@example.com')).toBe('ana@example.com')
  })
})
