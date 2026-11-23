import type { Locale } from '../../i18n'
import type { RoleNames } from '../permissions/can'

/** A person's role on a plan, as the floor-plan endpoints send it. */
export type PersonRole = { roleName: string | null; roleNames?: RoleNames | null }

/**
 * The role in the viewer's language (roles contract §5.11), falling back to the
 * stored name from an older backend; null when the person holds no role.
 */
export function personRoleLabel(person: PersonRole, locale: Locale): string | null {
  if (person.roleName === null) return null
  return person.roleNames?.[locale] ?? person.roleName
}
