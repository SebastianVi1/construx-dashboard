/**
 * Realistic text lengths for the app's fields. Each one is at or below the backend's column limit, so a value
 * the form accepts is never rejected by the server; most are lower because nobody names a site in 160 characters.
 */
export const TEXT_LIMITS = {
  personName: 80,
  trade: 60,
  companyName: 100,
  siteName: 100,
  address: 200,
  phaseName: 100,
  taskName: 100,
  materialName: 120,
  brand: 60,
  supplierName: 100,
  supplierBranch: 80,
  supplierWebsite: 255,
  sku: 40,
  expenseDescription: 160,
  crewName: 60,
  equipmentType: 60,
  equipmentIdentifier: 40,
  folderName: 80,
  documentName: 120,
  zoneName: 60,
  zoneLevel: 40,
  reportTitle: 120,
  email: 254,
  longText: 500,
} as const

/** Digits before the dot the backend stores: numeric(14,2) for budgets and expenses, numeric(12,2) for prices. */
export const MONEY_DIGITS = {
  amount: 12,
  price: 10,
} as const
