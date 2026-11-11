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
