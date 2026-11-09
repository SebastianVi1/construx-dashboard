import { describe, expect, test } from 'bun:test'
import { siteAccessSchema } from '../../../features/sites/sitesApi'
import { assigneeSchema } from '../../../features/tasks/tasksApi'

describe('people payloads carry the profile photo', () => {
  const access = { accessId: 'a', membershipId: 'm', userId: 'u', fullName: 'Ana Gil', role: { code: 'WORKER', name: 'Worker' } }
  const assignee = { accessId: 'a', membershipId: 'm', fullName: 'Ana Gil', taskRole: 'LEAD' }

  test('keeps the photo link a site person or task assignee arrives with', () => {
    expect(siteAccessSchema.parse({ ...access, avatarUrl: 'https://s3.test/a' }).avatarUrl).toBe('https://s3.test/a')
    expect(assigneeSchema.parse({ ...assignee, avatarUrl: 'https://s3.test/a' }).avatarUrl).toBe('https://s3.test/a')
  })

  test('accepts people without a photo and responses from a backend that does not send one yet', () => {
    expect(siteAccessSchema.parse({ ...access, avatarUrl: null }).avatarUrl).toBeNull()
    expect(siteAccessSchema.parse(access).avatarUrl).toBeUndefined()
    expect(assigneeSchema.parse(assignee).avatarUrl).toBeUndefined()
  })
})
