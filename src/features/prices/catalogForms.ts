import { z } from 'zod'
import { selectedOptionValues } from '../../components/form/optionValues'
import { TEXT_LIMITS } from '../../components/form'
import type { Supplier, SupplierBody } from './pricesApi'

/** Field lengths of Units, Families and Suppliers, at or below the backend's columns (docs/pricing.md §1.2-§1.4). */
export const CATALOG_LIMITS = {
  unitCode: 20,
  unitDescription: 120,
  familyCode: 40,
  familyName: 160,
  supplierCode: 40,
  rfc: 13,
  address: 255,
  neighborhood: 120,
  city: 160,
  state: 80,
  postalCode: 10,
  phone: 40,
  email: 160,
  contact: 160,
  notes: 500,
} as const

export type CatalogValidationMessages = {
  codeRequired: string
  codeMax: string
  nameRequired: string
  nameMax: string
  textMax: string
  websiteInvalid: string
  emailInvalid: string
  rfcInvalid: string
}

/** Value of the single "default supplier" checkbox. */
export const DEFAULT_OPTION = 'default'

/** Every optional text field of a supplier, in form order. */
export const supplierTextFields = [
  'branch',
  'website',
  'code',
  'rfc',
  'contact',
  'email',
  'phone',
  'mobile',
  'fax',
  'address',
  'neighborhood',
  'city',
  'state',
  'postalCode',
  'notes',
] as const

type SupplierTextField = (typeof supplierTextFields)[number]

export type SupplierFormValues = { name: string; isDefault: string } & Record<SupplierTextField, string>

function isWebUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname.length > 0
  } catch {
    return false
  }
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

function optional(max: number, message: string) {
  return z.string().trim().max(max, message)
}

/** Supplier rules, mirroring the backend: a name, an http(s) website, a valid email and an RFC of up to 13 characters. */
export function makeSupplierSchema(messages: CatalogValidationMessages) {
  return z.object({
    name: z.string().trim().min(1, messages.nameRequired).max(TEXT_LIMITS.supplierName, messages.nameMax),
    branch: optional(TEXT_LIMITS.supplierBranch, messages.textMax),
    website: z
      .string()
      .trim()
      .refine((value) => !value || (value.length <= TEXT_LIMITS.supplierWebsite && isWebUrl(value)), messages.websiteInvalid),
    code: optional(CATALOG_LIMITS.supplierCode, messages.codeMax),
    rfc: optional(CATALOG_LIMITS.rfc, messages.rfcInvalid),
    contact: optional(CATALOG_LIMITS.contact, messages.textMax),
    email: z
      .string()
      .trim()
      .refine((value) => !value || (value.length <= CATALOG_LIMITS.email && EMAIL.test(value)), messages.emailInvalid),
    phone: optional(CATALOG_LIMITS.phone, messages.textMax),
    mobile: optional(CATALOG_LIMITS.phone, messages.textMax),
    fax: optional(CATALOG_LIMITS.phone, messages.textMax),
    address: optional(CATALOG_LIMITS.address, messages.textMax),
    neighborhood: optional(CATALOG_LIMITS.neighborhood, messages.textMax),
    city: optional(CATALOG_LIMITS.city, messages.textMax),
    state: optional(CATALOG_LIMITS.state, messages.textMax),
    postalCode: optional(CATALOG_LIMITS.postalCode, messages.textMax),
    notes: optional(CATALOG_LIMITS.notes, messages.textMax),
    isDefault: z.string(),
  })
}

/**
 * A Unit (code up to 20, optional description) or a Family (code up to 40, required name). `text` is the
 * description or the name, so one dialog serves both lists.
 */
export function makeListItemSchema(kind: 'unit' | 'family', messages: CatalogValidationMessages) {
  const unit = kind === 'unit'
  return z.object({
    code: z
      .string()
      .trim()
      .min(1, messages.codeRequired)
      .max(unit ? CATALOG_LIMITS.unitCode : CATALOG_LIMITS.familyCode, messages.codeMax),
    text: unit
      ? optional(CATALOG_LIMITS.unitDescription, messages.textMax)
      : z.string().trim().min(1, messages.nameRequired).max(CATALOG_LIMITS.familyName, messages.nameMax),
  })
}

/** Form values for a new supplier, or for editing a stored one. */
export function supplierFormValues(supplier?: Supplier): SupplierFormValues {
  const values = { name: supplier?.name ?? '', isDefault: JSON.stringify(supplier?.isDefault ? [DEFAULT_OPTION] : []) }
  const text = Object.fromEntries(supplierTextFields.map((field) => [field, supplier?.[field] ?? ''])) as Record<
    SupplierTextField,
    string
  >
  return { ...values, ...text }
}

function isDefaultChecked(values: SupplierFormValues): boolean {
  return selectedOptionValues(values.isDefault).includes(DEFAULT_OPTION)
}

/** `POST /suppliers` body: trimmed, blank fields left out. */
export function supplierCreateBody(values: SupplierFormValues): SupplierBody & { name: string } {
  const body: SupplierBody & { name: string } = { name: values.name.trim() }
  for (const field of supplierTextFields) {
    const value = values[field].trim()
    if (value) body[field] = value
  }
  body.isDefault = isDefaultChecked(values)
  return body
}

/**
 * `PATCH /suppliers/{id}` body with only what changed; a cleared field is sent as `''`. The code of an
 * imported supplier is never sent, since the backend answers `IMPORTED_FIELD`.
 */
export function supplierPatchBody(values: SupplierFormValues, original: Supplier): SupplierBody {
  const body: SupplierBody = {}
  const name = values.name.trim()
  if (name !== original.name) body.name = name
  for (const field of supplierTextFields) {
    if (field === 'code' && original.source === 'NEODATA_CONSTRUBASE') continue
    const value = values[field].trim()
    if (value !== (original[field] ?? '')) body[field] = value
  }
  const isDefault = isDefaultChecked(values)
  if (isDefault !== original.isDefault) body.isDefault = isDefault
  return body
}
