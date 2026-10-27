import { useRemoteData } from '../../components/data/useRemoteData'
import { useAuth } from '../auth/auth-context'
import { getProfile } from './profileApi'

/** The signed-in person's profile, loaded once per account. */
export function useMyProfile() {
  const { user } = useAuth()
  return useRemoteData(user ? `profile:${user.id}` : null, getProfile)
}
