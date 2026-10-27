import type { RoleRef } from './can'

/**
 * Display name of a role: seeded roles are localized by their stable `code`;
 * custom roles keep the name stored on the server.
 */
export function roleLabel(role: RoleRef, labels: Record<string, string>): string {
  return Object.hasOwn(labels, role.code) ? labels[role.code] : role.name
}
