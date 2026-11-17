import { z } from 'zod'
import { TEXT_LIMITS } from '../../components/form'
import { PESOS, type MoneyConversion } from '../../currency'
import { amountIssue } from '../sites/budgetRules'

export type EquipmentValidationMessages = {
  typeRequired: string
  typeMax: string
  identifierRequired: string
  identifierMax: string
  dailyCostInvalid: string
  dailyCostDecimals: string
  dailyCostMax: string
}

export type EquipmentValues = { type: string; identifier: string; dailyCost: string }

const costMessage = {
  required: 'dailyCostInvalid',
  invalid: 'dailyCostInvalid',
  decimals: 'dailyCostDecimals',
  max: 'dailyCostMax',
} as const

/** A type and identifier, and an optional daily cost of 0 or more typed in the active currency. */
export function makeEquipmentSchema(messages: EquipmentValidationMessages, money: MoneyConversion = PESOS) {
  return z.object({
    type: z.string().trim().min(1, messages.typeRequired).max(TEXT_LIMITS.equipmentType, messages.typeMax),
    identifier: z
      .string()
      .trim()
      .min(1, messages.identifierRequired)
      .max(TEXT_LIMITS.equipmentIdentifier, messages.identifierMax),
    dailyCost: z.string().superRefine((raw, context) => {
      if (!raw.trim()) return
      const issue = amountIssue(raw, { allowZero: true, money })
      if (issue) context.addIssue({ code: 'custom', message: messages[costMessage[issue]] })
    }),
  })
}

/** The backend stores the daily cost in centavos: "3500.50" typed in pesos is 350050. */
export function dailyCostCents(raw: string, money: MoneyConversion = PESOS): number | null {
  return raw.trim() ? Math.round(money.toMxn(Number(raw.trim())) * 100) : null
}

/** Hours of the working day an hourly Equipment rate is charged for (docs/pricing.md §6.6). */
const HOURS_PER_DAY = 8n

/** `round(hourlyCost × 8 × 100)` computed exactly from the two-decimal string; null while the rate has no cost. */
export function dailyCostCentsFromRate(hourlyCost: string | null | undefined): number | null {
  const value = hourlyCost?.trim()
  if (!value || !/^\d+(\.\d{1,2})?$/.test(value)) return null
  const [whole, fraction = ''] = value.split('.')
  return Number(BigInt(whole + fraction.padEnd(2, '0')) * HOURS_PER_DAY)
}

/** The daily cost field after picking a rate: a typed value wins, an empty one takes eight hours of the rate. */
export function prefilledDailyCost(
  current: string,
  hourlyCost: string | null | undefined,
  money: MoneyConversion = PESOS,
): string {
  if (current.trim()) return current
  const cents = dailyCostCentsFromRate(hourlyCost)
  return cents === null ? current.trim() : money.fromMxn(cents / 100).toFixed(2)
}
