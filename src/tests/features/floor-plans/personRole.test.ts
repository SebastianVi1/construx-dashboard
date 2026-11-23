import { describe, expect, it } from 'bun:test'
import { personRoleLabel } from '../../../features/floor-plans/personRole'

describe('personRoleLabel', () => {
  it("shows the role in the viewer's language", () => {
    const person = { roleName: 'Trabajador', roleNames: { en: 'Worker', es: 'Trabajador' } }

    expect(personRoleLabel(person, 'en')).toBe('Worker')
    expect(personRoleLabel(person, 'es')).toBe('Trabajador')
  })

  it('falls back to the stored name when the server sent no names, and is null without a role', () => {
    expect(personRoleLabel({ roleName: 'Capataz' }, 'en')).toBe('Capataz')
    expect(personRoleLabel({ roleName: null, roleNames: null }, 'en')).toBeNull()
  })
})
