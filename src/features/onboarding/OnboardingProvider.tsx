import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useAuth } from '../auth/auth-context'
import { OnboardingContext } from './onboarding-context'
import { OnboardingFab } from './OnboardingFab'
import { OnboardingModal } from './OnboardingModal'
import { getOnboarding, putOnboarding, type OnboardingAnswer, type OnboardingState } from './onboardingApi'
import { readPendingAnswer, saveAnswer, syncOnboarding } from './pending'
import { onboardingVisibility, type RemoteStatus } from './visibility'

type Remote = { userKey: string; state: OnboardingState | null }

/**
 * Owns the onboarding intent for the whole app. Signed out, an answer given on
 * the register page is kept in localStorage; on the first authenticated session
 * it is sent with `PUT /api/onboarding` and dropped. Signed in, the server
 * answer decides: the modal opens by itself only while it has no intent.
 * Must sit inside `AuthProvider` and the router.
 */
export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { status: auth, user } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const userKey = auth === 'authenticated' && user ? String(user.id) : null

  const [remote, setRemote] = useState<Remote | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [dismissedFor, setDismissedFor] = useState<string | null>(null)
  const syncedFor = useRef<string | null>(null)

  useEffect(() => {
    if (!userKey) {
      syncedFor.current = null
      return
    }
    // Once per signed-in user: the hand-off PUT must not run twice (StrictMode).
    if (syncedFor.current === userKey) return
    syncedFor.current = userKey

    syncOnboarding({ storage: localStorage, getOnboarding, putOnboarding }).then(
      (state) => setRemote({ userKey, state }),
      () => setRemote({ userKey, state: null }),
    )
  }, [userKey])

  const current = userKey && remote?.userKey === userKey ? remote : null
  const remoteStatus: RemoteStatus = !userKey ? 'idle' : !current ? 'loading' : current.state ? 'ready' : 'error'
  const pending = userKey ? null : readPendingAnswer(localStorage)
  const intent = userKey ? (current?.state?.intent ?? null) : (pending?.intent ?? null)
  const businessType = userKey ? (current?.state?.businessType ?? null) : (pending?.businessType ?? null)

  const visibility = onboardingVisibility({
    auth,
    remote: remoteStatus,
    intent,
    hasPending: pending !== null,
    pathname,
    isOpen,
  })
  const dismissed = userKey !== null && dismissedFor === userKey
  const showModal = isOpen || (visibility.autoOpen && !dismissed)

  function close() {
    setIsOpen(false)
    setDismissedFor(userKey)
  }

  async function submit(answer: OnboardingAnswer) {
    const saved = await saveAnswer(answer, {
      authenticated: userKey !== null,
      storage: localStorage,
      putOnboarding,
    })
    if (userKey && saved) setRemote({ userKey, state: saved })
    close()
    if (userKey && answer.intent === 'RUN_COMPANY') navigate('/organizations/new')
  }

  return (
    <OnboardingContext.Provider
      value={{
        intent,
        businessType,
        status: remoteStatus,
        isOpen: showModal,
        submit,
        open: () => setIsOpen(true),
        close,
      }}
    >
      {children}
      <OnboardingFab visible={visibility.fab && !showModal} />
      {showModal ? <OnboardingModal /> : null}
    </OnboardingContext.Provider>
  )
}
