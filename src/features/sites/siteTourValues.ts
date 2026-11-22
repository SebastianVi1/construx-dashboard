import type { Locale } from '../../i18n'
import { addMonths } from '../../lib/dates'
import { sitesMessages } from './messages'
import type { SiteValues } from './siteForm'

/**
 * Example values for the guided tour's "Create your first Site". The name and
 * address are the locale's `sites.tourExample` copy (fictional; the user can
 * change every value before saving). `today` is the user's local date as
 * YYYY-MM-DD (callers pass `localToday()` from `lib/dates.ts`, which already
 * applies the browser's time zone), so the builder is pure and takes no time
 * zone. The end date is three months out; the status stays on the dialog's
 * default option.
 */
export function siteTourValues(locale: Locale, today: string): SiteValues {
  const example = sitesMessages[locale].tourExample
  return {
    name: example.name,
    address: example.address,
    startDate: today,
    expectedEndDate: addMonths(today, 3),
    status: '',
  }
}
