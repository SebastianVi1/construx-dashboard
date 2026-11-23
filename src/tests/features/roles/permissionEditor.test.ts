import { describe, expect, it } from 'bun:test'
import { diffGrants, fromGrants, isEmpty, optionLocked, scopeOptions, setScope, toGrants } from '../../../features/roles/permissionEditor'
import { permissionCatalog as catalog } from '../../support/permissionCatalog'

describe('setScope: switching on or raising', () => {
  it('enablingManagePlanTurnsOnViewPlanAndViewProject', () => {
    const result = setScope(catalog, {}, 'MANAGE_PLAN', 'PROJECT')

    expect(result.grants).toEqual({ MANAGE_PLAN: 'PROJECT', VIEW_PLAN: 'PROJECT', VIEW_PROJECT: 'PROJECT' })
    expect(result.turnedOn.sort()).toEqual(['VIEW_PLAN', 'VIEW_PROJECT'])
    expect(result.raised).toEqual([])
    expect(result.lowered).toEqual([])
    expect(result.turnedOff).toEqual([])
  })
})

describe('setScope: own tasks and raising', () => {
  it('enablingOwnTaskEditGivesViewProjectAtProject', () => {
    const result = setScope(catalog, {}, 'MANAGE_ACTIVITY', 'OWN')

    // Own tasks still need the sites they are on: VIEW_PROJECT never goes below Assigned sites.
    expect(result.grants).toEqual({ MANAGE_ACTIVITY: 'OWN', VIEW_ACTIVITY: 'OWN', VIEW_PROJECT: 'PROJECT' })
    expect(result.turnedOn.sort()).toEqual(['VIEW_ACTIVITY', 'VIEW_PROJECT'])
  })

  it('raising an action raises the requirements already on, and lists them apart', () => {
    const worker = fromGrants([
      { action: 'VIEW_PROJECT', scope: 'PROJECT' },
      { action: 'VIEW_PLAN', scope: 'PROJECT' },
    ])

    const result = setScope(catalog, worker, 'MANAGE_PLAN', 'ORGANIZATION')

    expect(result.grants).toEqual({ VIEW_PROJECT: 'ORGANIZATION', VIEW_PLAN: 'ORGANIZATION', MANAGE_PLAN: 'ORGANIZATION' })
    expect(result.turnedOn).toEqual([])
    expect(result.raised.sort()).toEqual(['VIEW_PLAN', 'VIEW_PROJECT'])
  })

  it('leaves requirements that already reach far enough alone', () => {
    const result = setScope(catalog, { VIEW_PRICES: 'ORGANIZATION' }, 'MANAGE_PRICES', 'ORGANIZATION')

    expect(result.grants).toEqual({ VIEW_PRICES: 'ORGANIZATION', MANAGE_PRICES: 'ORGANIZATION' })
    expect(result.turnedOn).toEqual([])
    expect(result.raised).toEqual([])
  })
})

describe('setScope: switching off or lowering', () => {
  // Member as shipped (contract §6.1 / seeded-roles.properties).
  const member = fromGrants([
    { action: 'VIEW_PROJECT', scope: 'ORGANIZATION' },
    { action: 'VIEW_GOAL', scope: 'ORGANIZATION' },
    { action: 'MANAGE_GOAL', scope: 'ORGANIZATION' },
    { action: 'VIEW_ACTIVITY', scope: 'ORGANIZATION' },
    { action: 'MANAGE_ACTIVITY', scope: 'ORGANIZATION' },
    { action: 'ASSIGN_ACTIVITY', scope: 'ORGANIZATION' },
    { action: 'VIEW_PRICES', scope: 'ORGANIZATION' },
    { action: 'VIEW_PLAN', scope: 'PROJECT' },
    { action: 'MANAGE_PLAN', scope: 'PROJECT' },
  ])

  it('loweringARequirementLowersDependentsToTheNewCeiling', () => {
    const result = setScope(catalog, member, 'VIEW_PROJECT', 'PROJECT')

    expect(result.grants).toEqual({
      ...member,
      VIEW_PROJECT: 'PROJECT',
      VIEW_GOAL: 'PROJECT',
      MANAGE_GOAL: 'PROJECT',
      VIEW_ACTIVITY: 'PROJECT',
      MANAGE_ACTIVITY: 'PROJECT',
      ASSIGN_ACTIVITY: 'PROJECT',
    })
    // Dependents are lowered, not switched off; those already at Assigned sites are untouched.
    expect(result.lowered.sort()).toEqual(['ASSIGN_ACTIVITY', 'MANAGE_ACTIVITY', 'MANAGE_GOAL', 'VIEW_ACTIVITY', 'VIEW_GOAL'])
    expect(result.turnedOff).toEqual([])
  })

  it('disablingViewProjectTurnsOffEverySiteAction', () => {
    const result = setScope(catalog, member, 'VIEW_PROJECT', null)

    expect(result.grants).toEqual({
      VIEW_PROJECT: null,
      VIEW_GOAL: null,
      MANAGE_GOAL: null,
      VIEW_ACTIVITY: null,
      MANAGE_ACTIVITY: null,
      ASSIGN_ACTIVITY: null,
      VIEW_PRICES: 'ORGANIZATION',
      VIEW_PLAN: null,
      MANAGE_PLAN: null,
    })
    expect(result.turnedOff.sort()).toEqual([
      'ASSIGN_ACTIVITY',
      'MANAGE_ACTIVITY',
      'MANAGE_GOAL',
      'MANAGE_PLAN',
      'VIEW_ACTIVITY',
      'VIEW_GOAL',
      'VIEW_PLAN',
    ])
    expect(result.lowered).toEqual([])
  })

  it('lowering task viewing to own tasks lowers task editing to own tasks but switches off assigning', () => {
    const result = setScope(catalog, member, 'VIEW_ACTIVITY', 'OWN')

    expect(result.grants.MANAGE_ACTIVITY).toBe('OWN')
    // Assigning has no Own tasks scope, so nothing narrower is left.
    expect(result.grants.ASSIGN_ACTIVITY).toBeNull()
    expect(result.lowered).toEqual(['MANAGE_ACTIVITY'])
    expect(result.turnedOff).toEqual(['ASSIGN_ACTIVITY'])
  })

  it('switching off a dependent leaves its requirements alone', () => {
    const result = setScope(catalog, member, 'MANAGE_PLAN', null)

    expect(result.grants).toEqual({ ...member, MANAGE_PLAN: null })
    expect(result.lowered).toEqual([])
    expect(result.turnedOff).toEqual([])
  })
})

describe('diff, empty and grant lists', () => {
  it('diffListsChangesForRestorePreview', () => {
    // Member without "Edit plans" and with prices widened, against its defaults.
    const current = fromGrants([
      { action: 'VIEW_PROJECT', scope: 'ORGANIZATION' },
      { action: 'VIEW_PRICES', scope: 'ORGANIZATION' },
      { action: 'MANAGE_PRICES', scope: 'ORGANIZATION' },
      { action: 'VIEW_PLAN', scope: 'PROJECT' },
    ])
    const defaults = fromGrants([
      { action: 'VIEW_PROJECT', scope: 'ORGANIZATION' },
      { action: 'VIEW_PRICES', scope: 'ORGANIZATION' },
      { action: 'VIEW_PLAN', scope: 'PROJECT' },
      { action: 'MANAGE_PLAN', scope: 'PROJECT' },
    ])

    expect(diffGrants(current, defaults, catalog)).toEqual([
      { action: 'MANAGE_PRICES', from: 'ORGANIZATION', to: null },
      { action: 'MANAGE_PLAN', from: null, to: 'PROJECT' },
    ])
  })

  it('treats a missing action and None alike, and lists changes in catalog order', () => {
    expect(diffGrants({ VIEW_PLAN: null }, {}, catalog)).toEqual([])
    expect(
      diffGrants({ VIEW_PLAN: 'PROJECT', VIEW_PROJECT: 'PROJECT' }, { VIEW_PLAN: 'ORGANIZATION', VIEW_PROJECT: 'ORGANIZATION' }, catalog),
    ).toEqual([
      { action: 'VIEW_PROJECT', from: 'PROJECT', to: 'ORGANIZATION' },
      { action: 'VIEW_PLAN', from: 'PROJECT', to: 'ORGANIZATION' },
    ])
  })

  it('isEmpty: a role with every action at None has no permissions', () => {
    expect(isEmpty({})).toBe(true)
    expect(isEmpty({ VIEW_PLAN: null, VIEW_PROJECT: null })).toBe(true)
    expect(isEmpty({ VIEW_PLAN: null, VIEW_PRICES: 'ORGANIZATION' })).toBe(false)
  })

  it('toGrants sends only the actions that are on, and round-trips with fromGrants', () => {
    const list = [
      { action: 'VIEW_PROJECT', scope: 'PROJECT' as const },
      { action: 'VIEW_PLAN', scope: 'PROJECT' as const },
    ]

    expect(toGrants({ ...fromGrants(list), MANAGE_PLAN: null })).toEqual(list)
  })
})

describe('scopeOptions', () => {
  const action = (code: string) => catalog.actions.find((entry) => entry.action === code)!

  it('offers None plus the scopes the catalog allows, narrowest first', () => {
    expect(scopeOptions(action('VIEW_ACTIVITY'), null).map((option) => option.scope)).toEqual([null, 'OWN', 'PROJECT', 'ORGANIZATION'])
    expect(scopeOptions(action('VIEW_PRICES'), null).map((option) => option.scope)).toEqual([null, 'ORGANIZATION'])
  })

  it('marks scopes wider than the caller holds as out of reach, never None', () => {
    // An Administrator holds no budget editing and plans at Whole company.
    const administrator = { VIEW_PLAN: 'ORGANIZATION' as const, VIEW_PROJECT: 'PROJECT' as const }

    expect(scopeOptions(action('MANAGE_BUDGET'), administrator)).toEqual([
      { scope: null, withinCaller: true },
      { scope: 'ORGANIZATION', withinCaller: false },
    ])
    expect(scopeOptions(action('VIEW_PROJECT'), administrator)).toEqual([
      { scope: null, withinCaller: true },
      { scope: 'PROJECT', withinCaller: true },
      { scope: 'ORGANIZATION', withinCaller: false },
    ])
  })
})

describe('optionLocked', () => {
  it('locks every option while a save or restore is in flight, so no edit is made that the answer would wipe', () => {
    expect(optionLocked({ scope: 'PROJECT', withinCaller: true }, null, true)).toBe(true)
    expect(optionLocked({ scope: null, withinCaller: true }, 'PROJECT', true)).toBe(true)
  })

  it('otherwise locks only a scope wider than the caller, unless the role already holds it', () => {
    expect(optionLocked({ scope: 'PROJECT', withinCaller: true }, null, false)).toBe(false)
    expect(optionLocked({ scope: 'ORGANIZATION', withinCaller: false }, 'PROJECT', false)).toBe(true)
    expect(optionLocked({ scope: 'ORGANIZATION', withinCaller: false }, 'ORGANIZATION', false)).toBe(false)
  })
})
