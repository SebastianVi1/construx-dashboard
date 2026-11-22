import { describe, expect, it } from 'bun:test'
import { addSite } from '../../../features/sites/siteSave'
import type { Site, SiteDraft } from '../../../features/sites/sitesApi'
import { recordGuideMarks } from '../../support/guideMarks'

const marks = recordGuideMarks()
const site = { id: 'site-1', name: 'Torre Norte' } as Site

describe('addSite', () => {
  const draft: SiteDraft = { name: 'Torre Norte', address: '', startDate: '', expectedEndDate: '', status: '' }

  it('creates the Site and ticks "Create your first site" in its Company', async () => {
    const sent: unknown[] = []
    const created = await addSite('org-1', draft, async (...args) => {
      sent.push(args)
      return site
    })
    expect(created).toBe(site)
    expect(sent).toEqual([['org-1', draft]])
    expect(marks).toEqual([{ stepId: 'create-site', organizationId: 'org-1' }])
  })

  it('does not tick the step when the create fails, and passes the error on', async () => {
    const failure = new Error('400')
    await expect(
      addSite('org-1', draft, async () => {
        throw failure
      }),
    ).rejects.toBe(failure)
    expect(marks).toEqual([])
  })
})
