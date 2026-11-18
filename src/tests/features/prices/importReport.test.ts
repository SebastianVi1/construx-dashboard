import { describe, expect, it } from 'bun:test'
import { formatDetail, warningGroups } from '../../../features/prices/importReport'

const sample = (code: string, resourceCode: string | null) => ({ code, sheet: 'CatalogoGeneral', row: 3, resourceCode, detail: null })

describe('import report', () => {
  it('groups warnings by code, most frequent first, with the samples of each code', () => {
    const groups = warningGroups({
      total: 26,
      byCode: { UNKNOWN_FAMILY: 3, WORK_ITEM_COST_MISMATCH: 20, COST_ROUNDED: 3 },
      sample: [sample('UNKNOWN_FAMILY', 'A'), sample('WORK_ITEM_COST_MISMATCH', 'B'), sample('UNKNOWN_FAMILY', 'C')],
    })
    expect(groups.map((group) => [group.code, group.count])).toEqual([
      ['WORK_ITEM_COST_MISMATCH', 20],
      ['COST_ROUNDED', 3],
      ['UNKNOWN_FAMILY', 3],
    ])
    expect(groups[2]?.samples.map((s) => s.resourceCode)).toEqual(['A', 'C'])
    expect(groups[1]?.samples).toEqual([])
  })

  it('shows a detail as its pairs, numbers and texts alike', () => {
    expect(formatDetail({ imported: '1006.42', derived: '1006.90' })).toBe('imported 1006.42 · derived 1006.90')
    expect(formatDetail({ length: 172 })).toBe('length 172')
    expect(formatDetail(null)).toBe('')
  })
})
