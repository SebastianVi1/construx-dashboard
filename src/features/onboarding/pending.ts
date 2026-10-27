import { z } from 'zod'
import {
  businessTypeSchema,
  intentSchema,
  type OnboardingAnswer,
  type OnboardingState,
} from './onboardingApi'

/**
 * Answer given before the first authenticated session (registration needs
 * email verification, so there is no session yet). It lives here only until
 * `PUT /api/onboarding` succeeds, then it is dropped.
 */
export const PENDING_KEY = 'construx.onboarding'

type ReadableStorage = Pick<Storage, 'getItem'>
type WritableStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const pendingSchema = z.object({
  intent: intentSchema,
  businessType: businessTypeSchema.nullable().optional().transform((value) => value ?? null),
})

/** The locally kept answer, or null when absent, corrupt, or in the old role-only shape. */
export function readPendingAnswer(storage: ReadableStorage): OnboardingAnswer | null {
  try {
    const raw = storage.getItem(PENDING_KEY)
    if (!raw) return null
    const parsed = pendingSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

function writePendingAnswer(storage: WritableStorage, answer: OnboardingAnswer): void {
  try {
    storage.setItem(PENDING_KEY, JSON.stringify(answer))
  } catch {
    // Storage may be full or disabled; the answer is a hint, so carry on.
  }
}

function clearPendingAnswer(storage: WritableStorage): void {
  try {
    storage.removeItem(PENDING_KEY)
  } catch {
    // Ignore unavailable storage.
  }
}

type SyncDeps = {
  storage: WritableStorage
  getOnboarding: () => Promise<OnboardingState>
  putOnboarding: (answer: OnboardingAnswer) => Promise<OnboardingState>
}

/**
 * Run once per authenticated session. A pending local answer is sent with PUT
 * and then dropped; if that fails the local copy stays for the next session
 * and the server answer is read instead.
 */
export async function syncOnboarding({ storage, getOnboarding, putOnboarding }: SyncDeps): Promise<OnboardingState> {
  const pending = readPendingAnswer(storage)
  if (pending) {
    try {
      const saved = await putOnboarding(pending)
      clearPendingAnswer(storage)
      return saved
    } catch {
      // Keep the local copy and fall through to the server answer.
    }
  }
  return getOnboarding()
}

type SaveDeps = {
  authenticated: boolean
  storage: WritableStorage
  putOnboarding: (answer: OnboardingAnswer) => Promise<OnboardingState>
}

/**
 * Persist an answer from the modal. Signed out: keep it locally and resolve
 * null. Signed in: PUT it and drop any local copy; on failure keep it locally
 * so the next session retries, and rethrow.
 */
export async function saveAnswer(
  answer: OnboardingAnswer,
  { authenticated, storage, putOnboarding }: SaveDeps,
): Promise<OnboardingState | null> {
  if (!authenticated) {
    writePendingAnswer(storage, answer)
    return null
  }
  try {
    const saved = await putOnboarding(answer)
    clearPendingAnswer(storage)
    return saved
  } catch (error) {
    writePendingAnswer(storage, answer)
    throw error
  }
}
