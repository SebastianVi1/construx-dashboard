import { useEffect, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/auth-context'
import { OrganizationsContext, type OrganizationsStatus } from './organizations-context'
import { listOrganizations, type Organization } from './organizationsApi'
import { readSelectedId, resolveSelectedOrganization, writeSelectedId } from './selection'

type Loaded = { userKey: string; request: number; organizations: Organization[] | null }

/**
 * Holds the signed-in user's organizations and the selected one. The list is
 * fetched per user and per reload; results for another user or an older
 * request are ignored, so a sign-out never shows stale company data.
 * Must sit inside `AuthProvider`.
 */
export function OrganizationsProvider({ children }: { children: ReactNode }) {
  const { status: auth, user } = useAuth()
  const userKey = auth === 'authenticated' && user ? String(user.id) : null

  const [request, setRequest] = useState(0)
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [chosen, setChosen] = useState<{ userKey: string; id: string } | null>(null)

  useEffect(() => {
    if (!userKey) return
    let active = true
    listOrganizations().then(
      (organizations) => {
        if (active) setLoaded({ userKey, request, organizations })
      },
      () => {
        if (active) setLoaded({ userKey, request, organizations: null })
      },
    )
    return () => {
      active = false
    }
  }, [userKey, request])

  const fresh = userKey && loaded?.userKey === userKey && loaded.request === request ? loaded : null
  const status: OrganizationsStatus = !userKey ? 'idle' : !fresh ? 'loading' : fresh.organizations ? 'ready' : 'error'
  const organizations = fresh?.organizations ?? []

  const storedId = !userKey
    ? null
    : chosen?.userKey === userKey
      ? chosen.id
      : readSelectedId(localStorage, userKey)
  const current = resolveSelectedOrganization(organizations, storedId)

  function select(organizationId: string) {
    if (!userKey) return
    setChosen({ userKey, id: organizationId })
    writeSelectedId(localStorage, userKey, organizationId)
  }

  function add(organization: Organization) {
    if (!userKey) return
    setLoaded((previous) => {
      const base = previous?.userKey === userKey && previous.organizations ? previous.organizations : []
      return { userKey, request, organizations: [...base.filter((item) => item.id !== organization.id), organization] }
    })
    select(organization.id)
  }

  return (
    <OrganizationsContext.Provider
      value={{
        status,
        organizations,
        current,
        select,
        add,
        reload: () => setRequest((value) => value + 1),
      }}
    >
      {children}
    </OrganizationsContext.Provider>
  )
}
