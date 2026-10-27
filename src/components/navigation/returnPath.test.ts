import { describe, expect, it } from 'bun:test'
import { forgetReturnPath, readReturnPath, rememberReturnPath, safeReturnPath, withReturnPath } from './returnPath'

function memoryStorage() {
  const items = new Map<string, string>()
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
    size: () => items.size,
  }
}

const acceptLink = '/invitations/accept?token=a%2Bb&x=1'

describe('return path', () => {
  it('keeps an in-app path with its query, so the invitation token survives sign-in', () => {
    const loginUrl = withReturnPath('/login', acceptLink)
    expect(loginUrl).toBe(`/login?next=${encodeURIComponent(acceptLink)}`)

    const next = new URLSearchParams(loginUrl.split('?')[1]).get('next')
    expect(safeReturnPath(next)).toBe(acceptLink)
  })

  it('rejects anything that could leave the app', () => {
    expect(safeReturnPath(null)).toBeNull()
    expect(safeReturnPath('')).toBeNull()
    expect(safeReturnPath('https://evil.example')).toBeNull()
    expect(safeReturnPath('//evil.example/x')).toBeNull()
    expect(safeReturnPath('/\\evil.example')).toBeNull()
    expect(safeReturnPath('javascript:alert(1)')).toBeNull()
    // browsers drop tab and newline while parsing, turning these into //evil.example
    expect(safeReturnPath('/\t/evil.example')).toBeNull()
    expect(safeReturnPath('/\n/evil.example')).toBeNull()
    expect(safeReturnPath('/sites\\evil')).toBeNull()
  })

  it('links without a return path when there is none', () => {
    expect(withReturnPath('/register', null)).toBe('/register')
  })

  it('remembers a path across the Google redirect; reading is repeatable until it is forgotten', () => {
    const storage = memoryStorage()
    rememberReturnPath(storage, acceptLink)

    expect(readReturnPath(storage)).toBe(acceptLink)
    expect(readReturnPath(storage)).toBe(acceptLink)
    forgetReturnPath(storage)
    expect(readReturnPath(storage)).toBeNull()
    expect(storage.size()).toBe(0)
  })

  it('ignores a stored path that is not an in-app path', () => {
    const storage = memoryStorage()
    storage.setItem('construx.returnTo', '//evil.example')

    expect(readReturnPath(storage)).toBeNull()
  })
})
