import { describe, expect, test } from 'bun:test'
import { makeCrewSchema } from '../../../features/crews/crewForm'

const schema = makeCrewSchema({ nameRequired: 'nameRequired', nameMax: 'nameMax', leaderRequired: 'leaderRequired' })

describe('crew form', () => {
  test('needs a name of at most 60 characters and a leader', () => {
    expect(schema.safeParse({ name: 'Albañiles A', leader: 'm-1' }).success).toBe(true)
    const result = schema.safeParse({ name: 'x'.repeat(61), leader: '' })
    expect(result.error?.issues.map((issue) => issue.message)).toEqual(['nameMax', 'leaderRequired'])
    expect(schema.safeParse({ name: '   ', leader: 'm-1' }).error?.issues[0].message).toBe('nameRequired')
  })
})
