import { afterEach, describe, expect, it } from 'bun:test'
import { subscribeGuideSteps, type GuideMark } from '../../../features/guide/guideEvents'
import type { OrgFinanceSummary } from '../../../features/org-finance/orgFinanceApi'
import { loadOrgFinanceSummary } from '../../../features/org-finance/orgFinanceLoad'

let marks: GuideMark[] = []
let stop = subscribeGuideSteps((mark) => marks.push(mark))
afterEach(() => {
  stop()
  marks = []
  stop = subscribeGuideSteps((mark) => marks.push(mark))
})

const summary = { totalBudget: 0, totalSpent: 0, totalRemaining: 0, sites: [], byCategory: [] } as unknown as OrgFinanceSummary

describe('loadOrgFinanceSummary', () => {
  it('returns the summary and ticks "Review company finance" in its Company once it loaded', async () => {
    const asked: string[] = []
    const loaded = await loadOrgFinanceSummary('org-1', async (organizationId) => {
      asked.push(organizationId)
      return summary
    })
    expect(loaded).toBe(summary)
    expect(asked).toEqual(['org-1'])
    expect(marks).toEqual([{ stepId: 'view-finance', organizationId: 'org-1' }])
  })

  it('does not tick the step when loading fails, and passes the error on', async () => {
    const failure = new Error('403')
    await expect(
      loadOrgFinanceSummary('org-1', async () => {
        throw failure
      }),
    ).rejects.toBe(failure)
    expect(marks).toEqual([])
  })
})
