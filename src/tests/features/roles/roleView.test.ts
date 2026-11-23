import { describe, expect, it } from 'bun:test'
import type { PermissionCatalog } from '../../../features/roles/rolesApi'
import { messages } from '../../../i18n/messages'
import { invitationCountLabel, memberCountLabel, permissionGroups, readOnlyReason, roleErrorMessage } from '../../../features/roles/roleView'
import { ApiError } from '../../../lib/http'
import { permissionCatalog } from '../../support/permissionCatalog'

describe('readOnlyReason', () => {
  const role = (code: string, kind: 'OWNER' | 'BUILT_IN' | 'CUSTOM', editable: boolean) => ({ code, kind, editable })

  it('is null when the server says the caller may edit the role', () => {
    expect(readOnlyReason(role('WORKER', 'BUILT_IN', true), 'ADMINISTRATOR')).toBeNull()
  })

  it('names the Owner role as locked, whoever is looking', () => {
    expect(readOnlyReason(role('OWNER', 'OWNER', false), 'OWNER')).toBe('ownerLocked')
    expect(readOnlyReason(role('OWNER', 'OWNER', false), 'ADMINISTRATOR')).toBe('ownerLocked')
  })

  it("names the caller's own role", () => {
    // An Administrator looking at Administrator (contract §9.4).
    expect(readOnlyReason(role('ADMINISTRATOR', 'BUILT_IN', false), 'ADMINISTRATOR')).toBe('ownRole')
  })

  it('otherwise the role holds permissions the caller lacks', () => {
    // An Administrator looking at Finance (contract §9.3).
    expect(readOnlyReason(role('FINANCE', 'BUILT_IN', false), 'ADMINISTRATOR')).toBe('aboveCaller')
    expect(readOnlyReason(role('CUSTOM_ABCDEFGHIJ', 'CUSTOM', false), null)).toBe('aboveCaller')
  })
})

describe('permissionGroups', () => {
  const action = (code: string, group: string) => ({
    action: code,
    group,
    names: { en: code, es: code },
    descriptions: { en: '', es: '' },
    scopes: ['PROJECT' as const, 'ORGANIZATION' as const],
    requires: [],
  })
  const catalog: PermissionCatalog = {
    groups: [
      { key: 'COMPANY', names: { en: 'Company', es: 'Empresa' } },
      { key: 'SITES', names: { en: 'Sites', es: 'Obras' } },
      { key: 'PLANS', names: { en: 'Plans', es: 'Planos' } },
    ],
    actions: [
      action('MANAGE_MEMBERS', 'COMPANY'),
      action('VIEW_PROJECT', 'SITES'),
      action('MANAGE_PROJECT', 'SITES'),
      action('VIEW_PLAN', 'PLANS'),
    ],
  }

  it('lists every catalog action under its group in catalog order, with the scope held or null', () => {
    const groups = permissionGroups(catalog, [
      { action: 'VIEW_PLAN', scope: 'ORGANIZATION' },
      { action: 'VIEW_PROJECT', scope: 'PROJECT' },
    ])

    expect(groups.map((group) => [group.key, group.rows.map((row) => [row.action.action, row.scope])])).toEqual([
      ['COMPANY', [['MANAGE_MEMBERS', null]]],
      [
        'SITES',
        [
          ['VIEW_PROJECT', 'PROJECT'],
          ['MANAGE_PROJECT', null],
        ],
      ],
      ['PLANS', [['VIEW_PLAN', 'ORGANIZATION']]],
    ])
  })

  it('leaves out a group with no actions and ignores grants the catalog does not know', () => {
    const groups = permissionGroups(
      { groups: [...catalog.groups, { key: 'EMPTY', names: { en: 'E', es: 'E' } }], actions: catalog.actions },
      [{ action: 'FROM_A_NEWER_BACKEND', scope: 'ORGANIZATION' }],
    )

    expect(groups.map((group) => group.key)).toEqual(['COMPANY', 'SITES', 'PLANS'])
    expect(groups.flatMap((group) => group.rows).every((row) => row.scope === null)).toBe(true)
  })
})

describe('count labels', () => {
  it('says how many members hold the role, in each language', () => {
    expect([0, 1, 12].map((count) => memberCountLabel(count, messages.en))).toEqual(['No members', '1 member', '12 members'])
    expect(memberCountLabel(12, messages.es)).toBe('12 miembros')
  })

  it('mentions pending invitations only when there are some', () => {
    expect(invitationCountLabel(0, messages.en)).toBeNull()
    expect(invitationCountLabel(1, messages.en)).toBe('1 pending invitation')
    expect(invitationCountLabel(3, messages.es)).toBe('3 invitaciones pendientes')
  })
})

describe('roleErrorMessage', () => {
  const en = messages.en
  const es = messages.es

  it('names the missing requirement from the catalog, in the current language', () => {
    const error = new ApiError(400, undefined, 'ROLE_DEPENDENCY_MISSING', { action: 'MANAGE_PLAN', requires: 'VIEW_PLAN' })

    expect(roleErrorMessage(error, en, permissionCatalog, 'en')).toBe('“Edit plans” needs “View plans”. Turn it on and save again.')
    expect(roleErrorMessage(error, es, permissionCatalog, 'es')).toBe('“Editar planos” necesita “Ver planos”. Actívalo y guarda de nuevo.')
  })

  it('falls back to a general sentence when the actions are not named or not in the catalog', () => {
    const bare = new ApiError(400, undefined, 'ROLE_DEPENDENCY_MISSING')
    const unknown = new ApiError(400, undefined, 'ROLE_DEPENDENCY_MISSING', { action: 'NEW_THING', requires: 'VIEW_PLAN' })

    expect(roleErrorMessage(bare, en, permissionCatalog, 'en')).toBe(en.roles.errors.roleDependencyMissingGeneral)
    expect(roleErrorMessage(unknown, en, null, 'en')).toBe(en.roles.errors.roleDependencyMissingGeneral)
  })

  it('uses the rule message for other role codes and the status otherwise', () => {
    expect(roleErrorMessage(new ApiError(403, undefined, 'ROLE_ABOVE_CALLER'), en, null, 'en')).toBe(en.roles.errors.roleAboveCaller)
    expect(roleErrorMessage(new ApiError(403), en, null, 'en')).toBe(en.roles.errors.forbidden)
    expect(roleErrorMessage(new Error('boom'), en, null, 'en')).toBe(en.roles.errors.generic)
  })
})
