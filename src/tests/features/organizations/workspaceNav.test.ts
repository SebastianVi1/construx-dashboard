import { describe, expect, it } from 'bun:test'
import { peopleChildren, peoplePageRedirect, sectionForPath, workspaceNavItems } from '../../../features/organizations/workspaceNav'

describe('workspaceNavItems', () => {
  it('always lists sites first and always includes documents', () => {
    expect(workspaceNavItems({ seesOwnTasks: false, seesPrices: false, seesBudget: false, managesMembers: false, managesRoles: false }).map((item) => item.key)).toEqual(['sites', 'documents'])
  })

  it('adds my tasks and people only when the role allows them', () => {
    expect(
      workspaceNavItems({ seesOwnTasks: true, seesPrices: false, seesBudget: false, managesMembers: true, managesRoles: true }).map((item) => item.to),
    ).toEqual(['/sites', '/tasks', '/documents', '/members'])
    expect(
      workspaceNavItems({ seesOwnTasks: false, seesPrices: false, seesBudget: false, managesMembers: true, managesRoles: true }).map((item) => item.key),
    ).toEqual(['sites', 'documents', 'people'])
  })

  it('places prices after my tasks and before people when the role sees prices', () => {
    expect(
      workspaceNavItems({ seesOwnTasks: true, seesPrices: true, seesBudget: false, managesMembers: true, managesRoles: true }).map((item) => item.to),
    ).toEqual(['/sites', '/tasks', '/prices', '/documents', '/members'])
    expect(
      workspaceNavItems({ seesOwnTasks: false, seesPrices: true, seesBudget: false, managesMembers: false, managesRoles: false }).map((item) => item.key),
    ).toEqual(['sites', 'prices', 'documents'])
  })

  it('places excel after prices and before people when the role sees the budget', () => {
    expect(
      workspaceNavItems({ seesOwnTasks: true, seesPrices: true, seesBudget: true, managesMembers: true, managesRoles: true }).map((item) => item.to),
    ).toEqual(['/sites', '/tasks', '/prices', '/excel', '/documents', '/members'])
    expect(
      workspaceNavItems({ seesOwnTasks: false, seesPrices: false, seesBudget: true, managesMembers: false, managesRoles: false }).map((item) => item.key),
    ).toEqual(['sites', 'excel', 'documents'])
  })
})

describe('people group', () => {
  const base = { seesOwnTasks: false, seesPrices: false, seesBudget: false }
  const people = (input: { managesMembers: boolean; managesRoles: boolean }) =>
    workspaceNavItems({ ...base, ...input }).find((item) => item.key === 'people')

  it('peopleGroupShowsWithEitherPermissionAndOnlyAllowedChildren', () => {
    expect(people({ managesMembers: true, managesRoles: true })).toEqual({
      key: 'people',
      to: '/members',
      children: [
        { key: 'members', to: '/members' },
        { key: 'roles', to: '/members/roles' },
      ],
    })
    // MANAGE_MEMBERS alone may still read the roles (contract §3).
    expect(people({ managesMembers: true, managesRoles: false })?.children.map((child) => child.key)).toEqual([
      'members',
      'roles',
    ])
    // MANAGE_ROLES alone: roles only, and the group opens on it.
    expect(people({ managesMembers: false, managesRoles: true })).toEqual({
      key: 'people',
      to: '/members/roles',
      children: [{ key: 'roles', to: '/members/roles' }],
    })
  })

  it('workerSeesNoPeopleGroup', () => {
    expect(people({ managesMembers: false, managesRoles: false })).toBeUndefined()
  })

  it('peopleChildren lists the sub-pages a role may open', () => {
    expect(peopleChildren({ managesMembers: false, managesRoles: false })).toEqual([])
    expect(peopleChildren({ managesMembers: true, managesRoles: false }).map((child) => child.to)).toEqual([
      '/members',
      '/members/roles',
    ])
  })
})

describe('peoplePageRedirect', () => {
  it('lets in whoever may open the page', () => {
    expect(peoplePageRedirect('members', { managesMembers: true, managesRoles: false })).toBeNull()
    expect(peoplePageRedirect('roles', { managesMembers: true, managesRoles: false })).toBeNull()
    expect(peoplePageRedirect('roles', { managesMembers: false, managesRoles: true })).toBeNull()
  })

  it('sends a roles-only manager from members to roles', () => {
    expect(peoplePageRedirect('members', { managesMembers: false, managesRoles: true })).toBe('/members/roles')
  })

  it('sends anyone else away from both pages', () => {
    expect(peoplePageRedirect('members', { managesMembers: false, managesRoles: false })).toBe('away')
    expect(peoplePageRedirect('roles', { managesMembers: false, managesRoles: false })).toBe('away')
  })
})

describe('sectionForPath', () => {
  it('sectionForPathMapsRolesUnderPeople', () => {
    expect(sectionForPath('/members/')).toEqual({ key: 'people', to: '/members', isRoot: true })
    expect(sectionForPath('/members/roles')).toEqual({ key: 'people', to: '/members/roles', isRoot: true })
    expect(sectionForPath('/members/roles/WORKER')).toEqual({ key: 'people', to: '/members/roles', isRoot: false })
    expect(sectionForPath('/membersx')).toBeNull()
  })

  it('maps a section root to itself', () => {
    expect(sectionForPath('/sites')).toEqual({ key: 'sites', to: '/sites', isRoot: true })
    expect(sectionForPath('/tasks')).toEqual({ key: 'myTasks', to: '/tasks', isRoot: true })
    expect(sectionForPath('/prices')).toEqual({ key: 'prices', to: '/prices', isRoot: true })
    expect(sectionForPath('/account')).toEqual({ key: 'account', to: '/account', isRoot: true })
  })

  it('keeps a nested page under its section', () => {
    expect(sectionForPath('/sites/42')).toEqual({ key: 'sites', to: '/sites', isRoot: false })
  })

  it('maps /excel/:id to the excel section', () => {
    expect(sectionForPath('/excel')).toEqual({ key: 'excel', to: '/excel', isRoot: true })
    expect(sectionForPath('/excel/abc')).toEqual({ key: 'excel', to: '/excel', isRoot: false })
  })

  it('does not match a path that only shares a prefix', () => {
    expect(sectionForPath('/sitesmap')).toBeNull()
    expect(sectionForPath('/')).toBeNull()
  })
})
