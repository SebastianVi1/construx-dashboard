import { describe, expect, it } from 'bun:test'
import { getLandingUrl } from '../../config/env'

describe('getLandingUrl', () => {
  it('is null when the setting is unset or blank', () => {
    expect(getLandingUrl('')).toBeNull()
    expect(getLandingUrl('   ')).toBeNull()
  })

  it('returns an HTTP(S) origin, trimmed', () => {
    expect(getLandingUrl(' https://construx.test ')).toBe('https://construx.test')
    expect(getLandingUrl('http://localhost')).toBe('http://localhost')
  })

  it('drops trailing slashes', () => {
    expect(getLandingUrl('https://construx.test/')).toBe('https://construx.test')
    expect(getLandingUrl('https://example.test/construx//')).toBe('https://example.test/construx')
  })

  it('treats a malformed or unsafe value as unset, so the links simply hide', () => {
    expect(getLandingUrl('construx.test')).toBeNull()
    expect(getLandingUrl('/guia')).toBeNull()
    expect(getLandingUrl('javascript:alert(1)')).toBeNull()
    expect(getLandingUrl('ftp://construx.test')).toBeNull()
    expect(getLandingUrl('https://user:secret@construx.test')).toBeNull()
    expect(getLandingUrl('https://construx.test/?ref=app')).toBeNull()
    expect(getLandingUrl('https://construx.test/#guide')).toBeNull()
  })
})
