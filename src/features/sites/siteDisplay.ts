import type { FieldConfig } from '../../components/form'
import { formatMessage, intlLocales, type Locale, type Messages } from '../../i18n'
import { formatDate } from '../home/format'
import { siteStatuses, type Site } from './sitesApi'

/** A calendar date (YYYY-MM-DD) in the user's locale. */
export function dateText(isoDate: string, locale: Locale): string {
  return formatDate(isoDate, intlLocales[locale])
}

/** "Nov 1, 2026 to May 30, 2027", or a one-sided label, or "Not scheduled". */
export function scheduleText(site: Pick<Site, 'startDate' | 'expectedEndDate'>, t: Messages['sites'], locale: Locale) {
  const intl = intlLocales[locale]
  const start = site.startDate ? formatDate(site.startDate, intl) : null
  const end = site.expectedEndDate ? formatDate(site.expectedEndDate, intl) : null
  if (start && end) return formatMessage(t.range, { start, end })
  if (start) return formatMessage(t.startsOn, { date: start })
  if (end) return formatMessage(t.endsOn, { date: end })
  return t.notScheduled
}

/** Field config shared by the create dialog and the edit form. */
export function siteFields(t: Messages['sites'], options: { statusDefault: boolean }): FieldConfig[] {
  const statusOptions = siteStatuses
    .filter((status) => !options.statusDefault || status !== 'ARCHIVED')
    .map((status) => ({ value: status, label: t.status[status] }))
  return [
    { name: 'name', label: t.field.name, placeholder: t.field.namePlaceholder, autoComplete: 'off' },
    { name: 'address', label: t.field.address, placeholder: t.field.addressPlaceholder, autoComplete: 'street-address' },
    { name: 'startDate', label: t.field.startDate, type: 'date' },
    { name: 'expectedEndDate', label: t.field.expectedEndDate, type: 'date' },
    {
      name: 'status',
      label: t.field.status,
      type: 'select',
      options: options.statusDefault ? [{ value: '', label: t.field.statusDefault }, ...statusOptions] : statusOptions,
    },
  ]
}
