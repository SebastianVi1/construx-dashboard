import { describe, expect, it } from 'bun:test'
import { folderPath, folderRows, plansInFolder } from '../../../features/plans/planTree'
import { planLibrarySchema } from '../../../features/plans/planLibraryApi'
import { sectionForPath, workspaceNavItems } from '../../../features/organizations/workspaceNav'

const folders = [{ id: 'a', parentId: null, name: 'Structure' }, { id: 'b', parentId: 'a', name: 'Floor' }]
describe('shared plans library', () => {
  it('opens Plans independently without changing existing navigation', () => {
    expect(workspaceNavItems({ seesOwnTasks: true, seesPrices: true, seesBudget: true, managesMembers: true, seesPlans: true }).map(x => x.to))
      .toEqual(['/sites', '/tasks', '/materials', '/excel', '/plans', '/members'])
    expect(sectionForPath('/plans/folders/a')).toEqual({ key: 'plans', to: '/plans', isRoot: false })
  })
  it('expands nested folders and keeps plans associated with their site', () => {
    expect(folderRows(folders, new Set()).map(x => x.folder.id)).toEqual(['a'])
    expect(folderRows(folders, new Set(['a'])).map(x => [x.folder.id, x.level])).toEqual([['a', 0], ['b', 1]])
    expect(folderPath(folders, 'b').map(x => x.name)).toEqual(['Structure', 'Floor'])
    const plans = [{ id: 'p', folderId: 'b', projectId: 'site' }, { id: 'q', folderId: null, projectId: 'other' }]
    expect(plansInFolder(plans, 'b')).toEqual([plans[0]!])
    expect(plansInFolder(plans, null)).toEqual([plans[1]!])
  })
  it('accepts the server library and rejects missing permission metadata', () => {
    expect(planLibrarySchema.parse({ folders, sites: [{ id: 'site', name: 'Tower', canManage: false }], plans: [], canManageFolders: false }).folders).toEqual(folders)
    expect(planLibrarySchema.safeParse({ folders, sites: [], plans: [] }).success).toBe(false)
  })
})
