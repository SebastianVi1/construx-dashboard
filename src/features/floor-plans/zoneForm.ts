import { z } from 'zod'
import { TEXT_LIMITS, type FieldConfig } from '../../components/form'
import type { Messages } from '../../i18n'
import { zoneStatusSchema, type ZoneStatus } from './zonesApi'

type ZonesMessages = Messages['floorPlans']['zones']

export type ZoneValues = { name: string; description: string; status: string }

/** A zone's name, optional description and status, the same when drawing a zone and when editing it. */
export function makeZoneSchema(messages: ZonesMessages['validation']) {
  return z.object({
    name: z.string().trim().min(1, messages.nameRequired).max(TEXT_LIMITS.zoneName, messages.nameMax),
    description: z.string().trim().max(TEXT_LIMITS.longText, messages.descriptionMax),
    status: zoneStatusSchema,
  })
}

export function zoneFields(t: ZonesMessages): FieldConfig[] {
  return [
    { name: 'name', label: t.nameLabel, placeholder: t.namePlaceholder, autoComplete: 'off', maxLength: TEXT_LIMITS.zoneName },
    {
      name: 'description',
      label: t.descriptionLabel,
      type: 'textarea',
      rows: 2,
      placeholder: t.descriptionPlaceholder,
      maxLength: TEXT_LIMITS.longText,
    },
    {
      name: 'status',
      label: t.statusLabel,
      type: 'select',
      options: zoneStatusSchema.options.map((status) => ({ value: status, label: t.status[status] })),
    },
  ]
}

/** The validated values as the API takes them: a blank description is null. */
export function zoneInput(values: ZoneValues) {
  return {
    name: values.name.trim(),
    description: values.description.trim() || null,
    status: values.status as ZoneStatus,
  }
}
