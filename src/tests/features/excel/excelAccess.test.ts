import { describe, expect, it } from 'bun:test'
import type { MyAccess } from '../../../features/permissions/can'
import { seesWorkbooks } from '../../../features/excel/excelAccess'

function access(permissions: MyAccess['permissions']): MyAccess {
  return { membershipId: 'm1', role: { code: 'FINANCE', name: 'Finance' }, permissions }
}

describe('seesWorkbooks', () => {
  it('allows VIEW_BUDGET at organization scope', () => {
    expect(seesWorkbooks(access([{ action: 'VIEW_BUDGET', scope: 'ORGANIZATION' }]))).toBe(true)
  })

  it('denies VIEW_BUDGET at project scope, other permissions and null access', () => {
    expect(seesWorkbooks(access([{ action: 'VIEW_BUDGET', scope: 'PROJECT' }]))).toBe(false)
    expect(seesWorkbooks(access([{ action: 'VIEW_PRICES', scope: 'ORGANIZATION' }]))).toBe(false)
    expect(seesWorkbooks(null)).toBe(false)
  })
})
