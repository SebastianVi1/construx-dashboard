import { describe, expect, it } from 'bun:test'
import {
  forgetReturnPath,
  loginRedirect,
  readReturnPath,
  rememberAcrossVerification,
  rememberReturnPath,
  safeReturnPath,
  verifiedSignInPath,
  withReturnPath,
} from './returnPath'

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

  it('keeps the return path from registration through email verification, then clears it after sign-in', () => {
    // The verification link may open in a new tab, so this is localStorage in the app.
    const storage = memoryStorage()
    rememberAcrossVerification(storage, acceptLink)

    // Verified: the sign-in link carries the remembered path as `?next=`.
    expect(verifiedSignInPath(storage)).toBe(`/login?next=${encodeURIComponent(acceptLink)}`)

    // Signed in and sent there: forgotten, so a later verification lands as usual.
    forgetReturnPath(storage)
    expect(verifiedSignInPath(storage)).toBe('/login')
    expect(storage.size()).toBe(0)
  })

  it('registration without a return path leaves the verified sign-in link unchanged and clears a stale one', () => {
    const storage = memoryStorage()
    expect(verifiedSignInPath(storage)).toBe('/login')

    rememberReturnPath(storage, acceptLink)
    rememberAcrossVerification(storage, null)
    expect(verifiedSignInPath(storage)).toBe('/login')
    expect(storage.size()).toBe(0)
  })

  it('never remembers an unsafe path for after verification', () => {
    const storage = memoryStorage()
    rememberAcrossVerification(storage, '//evil.example')
    expect(verifiedSignInPath(storage)).toBe('/login')
  })

  it('sends an expired session to sign in with the current page as `next`', () => {
    expect(loginRedirect('/sites/7?tab=people', true)).toBe(`/login?next=${encodeURIComponent('/sites/7?tab=people')}`)
  })

  it('keeps the plain login redirect for a visitor who was never signed in', () => {
    expect(loginRedirect('/sites/7', false)).toBe('/login')
  })
})
