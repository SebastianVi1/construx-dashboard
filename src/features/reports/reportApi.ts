import { z } from 'zod'
import { getJson, sendJson } from '../../lib/http'
import { sitePath } from '../../lib/apiPaths'

export const reportStatuses = ['PENDING', 'READY', 'FAILED'] as const
export type ReportStatus = (typeof reportStatuses)[number]

export const reportSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  status: z.enum(reportStatuses),
  generatedByName: z.string().nullable(),
  createdAt: z.string(),
  completedAt: z.string().nullable(),
  sizeBytes: z.number().nullable(),
  pdfBase64: z.string().nullable().optional(),
})

export type SiteReport = z.infer<typeof reportSchema>

const downloadUrlSchema = z.object({ downloadUrl: z.string().min(1) })

function reportsPath(organizationId: string, siteId: string): string {
  return `${sitePath(organizationId, siteId)}/reports`
}

export function listReports(organizationId: string, siteId: string): Promise<SiteReport[]> {
  return getJson(reportsPath(organizationId, siteId), z.array(reportSchema))
}

export function generateReport(organizationId: string, siteId: string, title: string): Promise<SiteReport> {
  return sendJson('post', reportsPath(organizationId, siteId), { title }, 201, reportSchema)
}

export function getDownloadUrl(organizationId: string, siteId: string, reportId: string): Promise<string> {
  return getJson(
    `${reportsPath(organizationId, siteId)}/${encodeURIComponent(reportId)}/download`,
    downloadUrlSchema,
  ).then((r) => r.downloadUrl)
}
