import { z } from 'zod'
import { siteStatuses, type Site, type SitePatch, type SiteStatus } from './sitesApi'

export type SiteValidationMessages = {
  nameRequired: string
  nameMax: string
  addressMax: string
  dateOrder: string
  dateKeep: string
}

export type SiteValues = {
  name: string
  address: string
  startDate: string
  expectedEndDate: string
  status: string
}

/**
 * Site form rules, mirroring the backend: name 1..160 after trimming, address
 * up to 255, and an expected end date not before the start date (ISO dates
 * compare as strings). When editing, a date that is already set cannot be
 * emptied, because PATCH treats a missing date as "unchanged".
 */
export function makeSiteSchema(messages: SiteValidationMessages, original?: Site) {
  return z
    .object({
      name: z.string().trim().min(1, messages.nameRequired).max(160, messages.nameMax),
      address: z.string().trim().max(255, messages.addressMax),
      startDate: z.string(),
      expectedEndDate: z.string(),
      status: z.union([z.literal(''), z.enum(siteStatuses)]),
    })
    .superRefine((values, context) => {
      if (original?.startDate && !values.startDate) {
        context.addIssue({ code: 'custom', path: ['startDate'], message: messages.dateKeep })
      }
      if (original?.expectedEndDate && !values.expectedEndDate) {
        context.addIssue({ code: 'custom', path: ['expectedEndDate'], message: messages.dateKeep })
      }
      if (values.startDate && values.expectedEndDate && values.expectedEndDate < values.startDate) {
        context.addIssue({ code: 'custom', path: ['expectedEndDate'], message: messages.dateOrder })
      }
    })
}

export function siteToValues(site: Site): SiteValues {
  return {
    name: site.name,
    address: site.address ?? '',
    startDate: site.startDate ?? '',
    expectedEndDate: site.expectedEndDate ?? '',
    status: site.status,
  }
}

/** The PATCH body for an edit: only changed fields; an emptied address is sent as `''`. */
export function buildSitePatch(site: Site, values: SiteValues): SitePatch {
  const patch: SitePatch = {}
  const name = values.name.trim()
  const address = values.address.trim()
  if (name !== site.name) patch.name = name
  if (address !== (site.address ?? '')) patch.address = address
  if (values.startDate && values.startDate !== site.startDate) patch.startDate = values.startDate
  if (values.expectedEndDate && values.expectedEndDate !== site.expectedEndDate) {
    patch.expectedEndDate = values.expectedEndDate
  }
  if (values.status && values.status !== site.status) patch.status = values.status as SiteStatus
  return patch
}
