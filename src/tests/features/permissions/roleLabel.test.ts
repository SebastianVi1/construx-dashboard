import { describe, expect, it } from 'bun:test'
import { roleLabel } from '../../../features/permissions/roles'

describe('roleLabel', () => {
  const worker = { code: 'WORKER', name: 'Trabajador', names: { en: 'Worker', es: 'Trabajador' } }

  it('shows the server name for the current locale', () => {
    expect(roleLabel(worker, 'en')).toBe('Worker')
    expect(roleLabel(worker, 'es')).toBe('Trabajador')
  })

  it('falls back to the stored name when the server sends no names', () => {
    expect(roleLabel({ code: 'WORKER', name: 'Trabajador' }, 'en')).toBe('Trabajador')
    expect(roleLabel({ code: 'CUSTOM_ABCDEFGHIJ', name: 'Capataz' }, 'es')).toBe('Capataz')
  })
})
