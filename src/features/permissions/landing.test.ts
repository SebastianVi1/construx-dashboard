import { describe, expect, it } from 'bun:test'
import type { MyAccess } from './can'
import { hasPermission, landingPath } from './landing'

function role(grants: Array<[string, 'ORGANIZATION' | 'PROJECT' | 'OWN']>): MyAccess {
  return {
    membershipId: 'm-1',
    role: { code: 'X', name: 'X' },
    permissions: grants.map(([action, scope]) => ({ action, scope })),
  }
}

describe('landingPath', () => {
  it('sends a role that manages tasks only at OWN scope (a worker) to My tasks', () => {
    expect(landingPath(role([['VIEW_PROJECT', 'PROJECT'], ['VIEW_ACTIVITY', 'PROJECT'], ['MANAGE_ACTIVITY', 'OWN']]))).toBe(
      '/tasks',
    )
  })

  it('sends roles that manage tasks more widely, or not at all, to the sites list', () => {
    expect(landingPath(role([['MANAGE_ACTIVITY', 'ORGANIZATION']]))).toBe('/sites')
    expect(landingPath(role([['MANAGE_ACTIVITY', 'PROJECT']]))).toBe('/sites')
    expect(landingPath(role([['VIEW_PROJECT', 'ORGANIZATION']]))).toBe('/sites')
    expect(landingPath(null)).toBe('/sites')
  })
})

describe('hasPermission', () => {
  it('is true for an action held at any scope and false otherwise', () => {
    const worker = role([['MANAGE_ACTIVITY', 'OWN']])
    expect(hasPermission(worker, 'MANAGE_ACTIVITY')).toBe(true)
    expect(hasPermission(worker, 'VIEW_ACTIVITY')).toBe(false)
    expect(hasPermission(null, 'MANAGE_ACTIVITY')).toBe(false)
  })
})
