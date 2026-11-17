import { describe, expect, it } from 'bun:test'
import { archivedLast, familyLabel, supplierLabel, unitLabel } from '../../../features/prices/filterOptions'

describe('filter options', () => {
  it('labels a family by name with its code', () => {
    expect(familyLabel({ code: '301', name: 'AGREGADOS' })).toBe('AGREGADOS (301)')
  })

  it('labels a unit by code, with its description when it has one', () => {
    expect(unitLabel({ code: 'M3', description: 'Metro cúbico' })).toBe('M3 (Metro cúbico)')
    expect(unitLabel({ code: 'HOR', description: null })).toBe('HOR')
  })

  it('labels a supplier by name, with its branch when it has one', () => {
    expect(supplierLabel({ name: 'Home Depot', branch: 'Periférico Sur' })).toBe('Home Depot (Periférico Sur)')
    expect(supplierLabel({ name: 'VARIOS', branch: null })).toBe('VARIOS')
  })

  it('keeps the server order, moves archived entries after the active ones and marks them', () => {
    const units = [
      { id: 'u-1', code: 'KG', description: null, archivedAt: '2026-11-01T00:00:00Z' },
      { id: 'u-2', code: 'M2', description: null, archivedAt: null },
      { id: 'u-3', code: 'M3', description: null, archivedAt: '2026-11-02T00:00:00Z' },
      { id: 'u-4', code: 'PZA', description: null, archivedAt: null },
    ]
    expect(archivedLast(units, unitLabel, 'archivada')).toEqual([
      { value: 'u-2', label: 'M2' },
      { value: 'u-4', label: 'PZA' },
      { value: 'u-1', label: 'KG · archivada' },
      { value: 'u-3', label: 'M3 · archivada' },
    ])
  })
})
