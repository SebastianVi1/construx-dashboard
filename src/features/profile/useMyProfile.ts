import { useEffect, useEffectEvent } from 'react'
import { useRemoteData } from '../../components/data/useRemoteData'
import { useAuth } from '../auth/auth-context'
import { getProfile, type Profile } from './profileApi'

const listeners = new Set<(profile: Profile) => void>()

/** Share a saved profile with every mounted `useMyProfile` (page, header avatar, menu). */
export function publishProfile(profile: Profile): void {
  for (const listener of listeners) listener(profile)
}

/** The signed-in person's profile, loaded once per account. */
export function useMyProfile() {
  const { user } = useAuth()
  // Immediate: the header avatar is chrome, so it must not start a screen's
  // placeholder window before the page below mounts.
  const profile = useRemoteData(user ? `profile:${user.id}` : null, getProfile, { immediate: true })
  const replace = useEffectEvent((saved: Profile) => profile.update(() => saved))

  useEffect(() => {
    const listener = (saved: Profile) => replace(saved)
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [])

  return profile
}
