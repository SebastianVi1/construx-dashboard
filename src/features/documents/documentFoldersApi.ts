import { z } from 'zod'
import { deleteJson, getJson, sendJson, uploadPresigned } from '../../lib/http'
import { sitePath } from '../../lib/apiPaths'

function basePath(org: string, site: string) {
  return `${sitePath(org, site)}/document-folders`
}

export const documentFolderSchema = z.object({
  id: z.string(),
  nameEn: z.string(),
  nameEs: z.string(),
  standard: z.boolean(),
  requiresPermission: z.string().nullable(),
  position: z.number().int(),
  entryCount: z.number().int(),
})
export type DocumentFolder = z.infer<typeof documentFolderSchema>

export const documentEntrySchema = z.object({
  id: z.string(),
  folderId: z.string(),
  fileName: z.string(),
  fileSize: z.number().int().nullable(),
  fileType: z.string().nullable(),
  sourceFeature: z.string(),
  createdAt: z.string(),
  downloadUrl: z.string(),
  downloadUrlExpiresAt: z.string(),
})
export type DocumentEntry = z.infer<typeof documentEntrySchema>

export const uploadUrlResponseSchema = z.object({
  entryId: z.string(),
  uploadUrl: z.string(),
  headers: z.record(z.string(), z.string()),
  expiresAt: z.string(),
  s3Key: z.string(),
})
export type UploadUrlResponse = z.infer<typeof uploadUrlResponseSchema>

export function getDocumentFolders(org: string, site: string) {
  return getJson(basePath(org, site), z.array(documentFolderSchema))
}

export function createDocumentFolder(org: string, site: string, nameEn: string, nameEs: string) {
  return sendJson('post', basePath(org, site), { nameEn, nameEs }, 201, documentFolderSchema)
}

export function deleteDocumentFolder(org: string, site: string, folderId: string) {
  return deleteJson(`${basePath(org, site)}/${encodeURIComponent(folderId)}`)
}

export function getDocumentEntries(org: string, site: string, folderId: string) {
  return getJson(
    // The entries carry presigned download links, so the answer must not come from a cache.
    `${basePath(org, site)}/${encodeURIComponent(folderId)}/entries?fresh=${Date.now()}`,
    z.array(documentEntrySchema),
  )
}

export function requestUploadUrl(
  org: string,
  site: string,
  folderId: string,
  fileName: string,
  contentType: string,
  sizeBytes: number,
) {
  return sendJson(
    'post',
    `${basePath(org, site)}/${encodeURIComponent(folderId)}/entries/upload-url`,
    { fileName, contentType, sizeBytes },
    200,
    uploadUrlResponseSchema,
  )
}

export function confirmUpload(
  org: string,
  site: string,
  folderId: string,
  entryId: string,
  s3Key: string,
  fileName: string,
  fileSize: number | null,
  fileType: string | null,
) {
  return sendJson(
    'post',
    `${basePath(org, site)}/${encodeURIComponent(folderId)}/entries`,
    { entryId, s3Key, fileName, fileSize, fileType, sourceFeature: 'manual' },
    201,
    documentEntrySchema,
  )
}

/**
 * Upload a file into a folder: get a presigned URL, PUT the file to storage,
 * then confirm the entry. A failed storage PUT throws before the confirm, so
 * no entry is created for a file that was never stored.
 */
export async function uploadDocumentFile(org: string, site: string, folderId: string, file: File) {
  const contentType = file.type || 'application/octet-stream'
  const ticket = await requestUploadUrl(org, site, folderId, file.name, contentType, file.size)
  await uploadPresigned(ticket.uploadUrl, file, { 'Content-Type': contentType, ...ticket.headers })
  return confirmUpload(org, site, folderId, ticket.entryId, ticket.s3Key, file.name, file.size, file.type || null)
}

export function deleteDocumentEntry(org: string, site: string, folderId: string, entryId: string) {
  return deleteJson(
    `${basePath(org, site)}/${encodeURIComponent(folderId)}/entries/${encodeURIComponent(entryId)}`,
  )
}

export const documentSearchHitSchema = z.object({
  entryId: z.string(),
  fileName: z.string(),
  folderId: z.string(),
  folderNameEn: z.string(),
  folderNameEs: z.string(),
})
export type DocumentSearchHit = z.infer<typeof documentSearchHitSchema>

export function searchDocuments(org: string, site: string, q: string) {
  return getJson(
    `${basePath(org, site)}/search?q=${encodeURIComponent(q)}`,
    z.array(documentSearchHitSchema),
  )
}
