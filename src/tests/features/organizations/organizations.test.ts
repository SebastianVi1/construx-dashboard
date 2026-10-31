import { describe, expect, it } from 'bun:test'
import { messages } from '../../../i18n/messages'
import { AuthApiError } from '../../../features/auth/authApi'
import type { Organization } from '../../../features/organizations/organizationsApi'
import { createErrorKind, makeOrganizationSchema } from '../../../features/organizations/schemas'
import { readSelectedId, resolveSelectedOrganization, selectedOrganizationKey, writeSelectedId } from '../../../features/organizations/selection'

const org = (id: string, name = id): Organization => ({ id, name, status: 'ACTIVE', myRole: null })
const a = org('a', 'Acme')
const b = org('b', 'Beta')

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  }
}

describe('resolveSelectedOrganization', () => {
  it('keeps the stored organization while the user still belongs to it', () => {
    expect(resolveSelectedOrganization([a, b], 'b')).toBe(b)
  })

  it('falls back to the first organization when the stored one is gone or missing', () => {
    expect(resolveSelectedOrganization([a, b], 'gone')).toBe(a)
    expect(resolveSelectedOrganization([a, b], null)).toBe(a)
  })

  it('selects nothing when the user has no organization', () => {
    expect(resolveSelectedOrganization([], 'a')).toBeNull()
  })
})

describe('selected organization storage', () => {
  it('scopes the stored id to the user', () => {
    expect(selectedOrganizationKey('u1')).not.toBe(selectedOrganizationKey('u2'))
    const storage = memoryStorage()
    writeSelectedId(storage, 'u1', 'b')
    expect(readSelectedId(storage, 'u1')).toBe('b')
    expect(readSelectedId(storage, 'u2')).toBeNull()
  })
})

describe('organization name', () => {
  const schema = makeOrganizationSchema(messages.en.organizations.validation)

  it('trims and accepts 1 to 160 characters', () => {
    expect(schema.parse({ name: '  Acme Builders ' })).toEqual({ name: 'Acme Builders' })
    expect(schema.safeParse({ name: 'a'.repeat(160) }).success).toBe(true)
  })

  it('rejects a blank name and one longer than 160 characters', () => {
    const blank = schema.safeParse({ name: '   ' })
    expect(blank.error?.issues[0]?.message).toBe(messages.en.organizations.validation.nameRequired)
    const long = schema.safeParse({ name: 'a'.repeat(161) })
    expect(long.error?.issues[0]?.message).toBe(messages.en.organizations.validation.nameMax)
  })
})

describe('createErrorKind', () => {
  it('maps backend validation failures to an invalid-name message', () => {
    expect(createErrorKind(new AuthApiError(400, undefined, 'VALIDATION_FAILED'))).toBe('invalidName')
    expect(createErrorKind(new AuthApiError(400, undefined, 'INVALID_ARGUMENT'))).toBe('invalidName')
  })

  it('maps an expired session and anything else to their own messages', () => {
    expect(createErrorKind(new AuthApiError(401))).toBe('session')
    expect(createErrorKind(new AuthApiError(500))).toBe('generic')
    expect(createErrorKind(new Error('network'))).toBe('generic')
  })
})
