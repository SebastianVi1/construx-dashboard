import type { Locale } from '../../i18n/locale'
import type { RoleRef } from './can'

/**
 * Display name of a role in the current language. The server sends `names`
 * on every role summary (roles contract §5.11); the stored `name` is the
 * fallback for an older backend.
 */
export function roleLabel(role: RoleRef, locale: Locale): string {
  return role.names?.[locale] ?? role.name
}
