/**
 * Sign-in flows land on `/account`; a user with a company is sent on to the
 * sites list from there. Workspace links to the account page pass this state
 * so the page stays put when the user opens it on purpose.
 */
export const accountLinkState = { view: 'account' } as const

export function wantsAccountPage(state: unknown): boolean {
  return typeof state === 'object' && state !== null && (state as { view?: unknown }).view === 'account'
}
