import { describe, expect, test } from 'bun:test'
import { teamPreview } from '../../../features/sites/teamPreview'

const person = (id: string, fullName: string | null, code: string) => ({
  accessId: `a-${id}`,
  membershipId: `m-${id}`,
  fullName,
  role: { code, name: code },
})

describe('site team preview', () => {
  const people = [
    person('1', 'Zoe Ruiz', 'WORKER'),
    person('2', 'Ana Gil', 'WORKER'),
    person('3', null, 'WORKER'),
    person('4', 'Luis Paz', 'SITE_MANAGER'),
    person('5', 'Eva Sol', 'CUSTOM'),
  ]

  test('puts the caller first, then site leadership, then names, with unnamed people last in their role', () => {
    const { shown } = teamPreview(people, 'm-1', 10)
    expect(shown.map((p) => p.accessId)).toEqual(['a-1', 'a-4', 'a-2', 'a-3', 'a-5'])
  })

  test('counts each role once in leadership order', () => {
    const { roles } = teamPreview(people, null, 10)
    expect(roles.map((r) => [r.role.code, r.count])).toEqual([['SITE_MANAGER', 1], ['WORKER', 3], ['CUSTOM', 1]])
  })

  test('limits the shown people and reports how many are left out', () => {
    const preview = teamPreview(people, null, 3)
    expect(preview.shown).toHaveLength(3)
    expect(preview.hidden).toBe(2)
    expect(teamPreview([], null, 3)).toEqual({ shown: [], hidden: 0, roles: [] })
  })
})
