import { z } from 'zod'
import { deleteJson, getJson, sendJson } from '../auth/authApi'
import { organizationPath } from '../permissions/permissionsApi'
import { planSchema } from './plansApi'

export const planFolderSchema = z.object({ id: z.string(), name: z.string(), parentId: z.string().nullable() })
export type PlanFolder = z.infer<typeof planFolderSchema>
export const planLibrarySchema = z.object({
  folders: z.array(planFolderSchema),
  sites: z.array(z.object({ id: z.string(), name: z.string(), canManage: z.boolean() })),
  plans: z.array(planSchema),
  canManageFolders: z.boolean(),
})
export type PlanLibrary = z.infer<typeof planLibrarySchema>
export function getPlanLibrary(org: string) {
  return getJson(`${organizationPath(org)}/plan-library`, planLibrarySchema)
}
export function savePlanFolder(org: string, id: string | null, name: string, parentId: string | null) {
  const path = `${organizationPath(org)}/plan-folders${id ? `/${encodeURIComponent(id)}` : ''}`
  return sendJson(id ? 'patch' : 'post', path, { name, parentId }, id ? 200 : 201, planFolderSchema)
}
export function deletePlanFolder(org: string, id: string) {
  return deleteJson(`${organizationPath(org)}/plan-folders/${encodeURIComponent(id)}`)
}
export function movePlan(org: string, site: string, plan: string, folderId: string | null) {
  return sendJson('put', `${organizationPath(org)}/projects/${encodeURIComponent(site)}/plans/${encodeURIComponent(plan)}/folder`, { folderId }, 200, planSchema)
}
