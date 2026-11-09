import { describe, expect, test } from 'bun:test'
import { memberSchema } from '../../../features/members/membersApi'
import { personSchema } from '../../../features/people/personSchema'
import { profileSchema } from '../../../features/profile/profileApi'
import { siteAccessSchema } from '../../../features/sites/sitesApi'
import { assigneeSchema } from '../../../features/tasks/tasksApi'

const role = { code: 'WORKER', name: 'Worker' }

/** Every API payload that shows a person, without its photo. */
const people = [
  ['person', personSchema, { fullName: 'Ana Gil' }],
  ['site person', siteAccessSchema, { accessId: 'a', membershipId: 'm', userId: 'u', fullName: 'Ana Gil', role }],
  ['task assignee', assigneeSchema, { accessId: 'a', membershipId: 'm', fullName: 'Ana Gil', taskRole: 'LEAD' }],
  ['member', memberSchema, { membershipId: 'm', userId: 'u', email: 'ana@test', fullName: 'Ana Gil', role, status: 'ACTIVE' }],
  ['profile', profileSchema, { fullName: 'Ana Gil', phoneNumber: null, trade: null }],
] as const

describe('person payloads share one photo rule', () => {
  test.each(people)('a %s keeps the photo link it arrives with', (_, schema, person) => {
    expect(schema.parse({ ...person, avatarUrl: 'https://s3.test/a' }).avatarUrl).toBe('https://s3.test/a')
  })

  test.each(people)('a %s without a photo, or from a backend that omits it, has a null photo', (_, schema, person) => {
    expect(schema.parse({ ...person, avatarUrl: null }).avatarUrl).toBeNull()
    expect(schema.parse(person).avatarUrl).toBeNull()
  })

  test('a person keeps a missing name as null', () => {
    expect(personSchema.parse({ fullName: null })).toEqual({ fullName: null, avatarUrl: null })
  })
})
