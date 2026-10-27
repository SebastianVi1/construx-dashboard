import type { AuthStatus } from '../auth/auth-context'
import type { Intent } from './onboardingApi'

/** Load state of `GET /api/onboarding` for the current session. */
export type RemoteStatus = 'idle' | 'loading' | 'ready' | 'error'

type VisibilityInput = {
  auth: AuthStatus
  remote: RemoteStatus
  /** Intent known from the server for this session. */
  intent: Intent | null
  /** A locally kept answer is waiting for the first authenticated session. */
  hasPending: boolean
  pathname: string
  isOpen: boolean
}

/**
 * Decide whether the onboarding modal opens by itself and whether the
 * reopen button shows. Signed in, only a server answer without an intent
 * counts as unanswered. Signed out, the questions are offered on the
 * register page only and are never opened automatically.
 */
export function onboardingVisibility(input: VisibilityInput): { autoOpen: boolean; fab: boolean } {
  if (input.auth === 'authenticated') {
    const unanswered = input.remote === 'ready' && input.intent === null
    return { autoOpen: unanswered, fab: unanswered && !input.isOpen }
  }
  if (input.auth === 'unauthenticated') {
    const offered = input.pathname === '/register' && !input.hasPending
    return { autoOpen: false, fab: offered && !input.isOpen }
  }
  return { autoOpen: false, fab: false }
}
