import { afterEach, describe, expect, it } from 'bun:test'
import { subscribeGuideSteps, type GuideMark } from '../../../features/guide/guideEvents'
import { saveSiteBudget } from '../../../features/sites/siteBudgetSave'
import type { Site } from '../../../features/sites/sitesApi'

let marks: GuideMark[] = []
let stop = subscribeGuideSteps((mark) => marks.push(mark))
afterEach(() => {
  stop()
  marks = []
  stop = subscribeGuideSteps((mark) => marks.push(mark))
})

const site = { id: 'site-1', name: 'Torre Norte', allocatedBudget: 250000 } as Site

describe('saveSiteBudget', () => {
  it('saves the amount and ticks "Set a site budget" in its Company', async () => {
    const sent: unknown[] = []
    const saved = await saveSiteBudget('org-1', 'site-1', 250000, async (...args) => {
      sent.push(args)
      return site
    })
    expect(saved).toBe(site)
    expect(sent).toEqual([['org-1', 'site-1', 250000]])
    expect(marks).toEqual([{ stepId: 'site-budget', organizationId: 'org-1' }])
  })

  it('does not tick the step when the save fails, and passes the error on', async () => {
    const failure = new Error('409')
    await expect(
      saveSiteBudget('org-1', 'site-1', 250000, async () => {
        throw failure
      }),
    ).rejects.toBe(failure)
    expect(marks).toEqual([])
  })

  it('does not tick the step when the budget is removed', async () => {
    await saveSiteBudget('org-1', 'site-1', null, async () => ({ ...site, allocatedBudget: null }))
    expect(marks).toEqual([])
  })
})
