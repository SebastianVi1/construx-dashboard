import { describe, expect, it, mock } from 'bun:test'
import type { OnboardingAnswer, OnboardingState } from './onboardingApi'
import { PENDING_KEY, readPendingAnswer, saveAnswer, syncOnboarding } from './pending'
import { onboardingVisibility } from './visibility'

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
    has: (key: string) => data.has(key),
  }
}

const answer: OnboardingAnswer = { intent: 'RUN_COMPANY', businessType: 'GENERAL_CONTRACTOR' }
const empty: OnboardingState = { intent: null, businessType: null, updatedAt: null }
const stored: OnboardingState = { ...answer, updatedAt: '2026-10-26T10:00:00Z' }

describe('pending onboarding answer', () => {
  it('reads a valid pending answer', () => {
    const storage = memoryStorage({ [PENDING_KEY]: JSON.stringify(answer) })
    expect(readPendingAnswer(storage)).toEqual(answer)
  })

  it('treats a missing businessType as null', () => {
    const storage = memoryStorage({ [PENDING_KEY]: JSON.stringify({ intent: 'WORKER_OR_INVITED' }) })
    expect(readPendingAnswer(storage)).toEqual({ intent: 'WORKER_OR_INVITED', businessType: null })
  })

  it('ignores corrupt JSON and the legacy role-only shape', () => {
    expect(readPendingAnswer(memoryStorage({ [PENDING_KEY]: '{oops' }))).toBeNull()
    expect(readPendingAnswer(memoryStorage({ [PENDING_KEY]: JSON.stringify({ role: 'owner' }) }))).toBeNull()
    expect(readPendingAnswer(memoryStorage())).toBeNull()
  })
})

describe('syncOnboarding (first authenticated session)', () => {
  it('sends the pending answer with PUT, then drops the local copy', async () => {
    const storage = memoryStorage({ [PENDING_KEY]: JSON.stringify(answer) })
    const put = mock(async () => stored)
    const get = mock(async () => empty)

    expect(await syncOnboarding({ storage, putOnboarding: put, getOnboarding: get })).toEqual(stored)
    expect(put).toHaveBeenCalledWith(answer)
    expect(get).toHaveBeenCalledTimes(0)
    expect(storage.has(PENDING_KEY)).toBe(false)
  })

  it('reads the server answer when nothing is pending', async () => {
    const put = mock(async () => stored)
    const get = mock(async () => stored)

    expect(await syncOnboarding({ storage: memoryStorage(), putOnboarding: put, getOnboarding: get })).toEqual(stored)
    expect(put).toHaveBeenCalledTimes(0)
  })

  it('keeps the local copy when PUT fails and falls back to the server answer', async () => {
    const storage = memoryStorage({ [PENDING_KEY]: JSON.stringify(answer) })
    const put = mock(async (): Promise<OnboardingState> => {
      throw new Error('down')
    })
    const get = mock(async () => empty)

    expect(await syncOnboarding({ storage, putOnboarding: put, getOnboarding: get })).toEqual(empty)
    expect(storage.has(PENDING_KEY)).toBe(true)
  })
})

describe('saveAnswer', () => {
  it('stores the answer locally only while signed out', async () => {
    const storage = memoryStorage()
    const put = mock(async () => stored)

    expect(await saveAnswer(answer, { authenticated: false, storage, putOnboarding: put })).toBeNull()
    expect(put).toHaveBeenCalledTimes(0)
    expect(readPendingAnswer(storage)).toEqual(answer)
  })

  it('sends the answer when signed in and leaves no local copy', async () => {
    const storage = memoryStorage({ [PENDING_KEY]: JSON.stringify({ intent: 'WORKER_OR_INVITED' }) })
    const put = mock(async () => stored)

    expect(await saveAnswer(answer, { authenticated: true, storage, putOnboarding: put })).toEqual(stored)
    expect(put).toHaveBeenCalledWith(answer)
    expect(storage.has(PENDING_KEY)).toBe(false)
  })

  it('keeps the answer locally for a retry and rethrows when PUT fails', async () => {
    const storage = memoryStorage()
    const put = mock(async (): Promise<OnboardingState> => {
      throw new Error('down')
    })

    await expect(saveAnswer(answer, { authenticated: true, storage, putOnboarding: put })).rejects.toThrow('down')
    expect(readPendingAnswer(storage)).toEqual(answer)
  })
})

describe('onboardingVisibility', () => {
  const base = { isOpen: false, pathname: '/account', hasPending: false }

  it('opens the modal for a signed-in user whose server answer has no intent', () => {
    expect(onboardingVisibility({ ...base, auth: 'authenticated', remote: 'ready', intent: null })).toEqual({
      autoOpen: true,
      fab: true,
    })
  })

  it('shows nothing once the server returns an intent', () => {
    expect(
      onboardingVisibility({ ...base, auth: 'authenticated', remote: 'ready', intent: 'WORKER_OR_INVITED' }),
    ).toEqual({ autoOpen: false, fab: false })
  })

  it('waits for the server answer before deciding', () => {
    expect(onboardingVisibility({ ...base, auth: 'authenticated', remote: 'loading', intent: null })).toEqual({
      autoOpen: false,
      fab: false,
    })
    expect(onboardingVisibility({ ...base, auth: 'loading', remote: 'idle', intent: null })).toEqual({
      autoOpen: false,
      fab: false,
    })
  })

  it('does not offer the questions when the server answer could not be read', () => {
    expect(onboardingVisibility({ ...base, auth: 'authenticated', remote: 'error', intent: null })).toEqual({
      autoOpen: false,
      fab: false,
    })
  })

  it('offers the button, never an automatic modal, on the register page while signed out', () => {
    const guest = { ...base, auth: 'unauthenticated' as const, remote: 'idle' as const, intent: null }
    expect(onboardingVisibility({ ...guest, pathname: '/register' })).toEqual({ autoOpen: false, fab: true })
    expect(onboardingVisibility({ ...guest, pathname: '/register', hasPending: true })).toEqual({
      autoOpen: false,
      fab: false,
    })
    expect(onboardingVisibility({ ...guest, pathname: '/login' })).toEqual({ autoOpen: false, fab: false })
  })

  it('hides the button while the modal is open', () => {
    expect(
      onboardingVisibility({ ...base, isOpen: true, auth: 'authenticated', remote: 'ready', intent: null }).fab,
    ).toBe(false)
  })
})
