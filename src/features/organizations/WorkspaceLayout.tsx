import { Suspense } from 'react'
import { Link, NavLink, Outlet } from 'react-router'
import { LoadingState, Notice } from '../../components/page'
import { LocaleSwitcher, useLocale } from '../../i18n'
import { PermissionsProvider, usePermissions } from '../permissions'
import { hasPermission } from '../permissions/landing'
import { useCurrentOrganization } from './organizations-context'
import './workspace.css'

/**
 * Frame of the company workspace: navigation beside the routed page. Sits
 * inside `OrganizationGate`, which already renders the company strip, and
 * loads the caller's permissions for the selected company.
 */
export function WorkspaceLayout() {
  const organization = useCurrentOrganization()

  return (
    <PermissionsProvider key={organization.id} organizationId={organization.id}>
      <WorkspaceShell />
    </PermissionsProvider>
  )
}

function WorkspaceShell() {
  const { messages: m } = useLocale()
  const t = m.workspace
  const { status, access, can, reload } = usePermissions()
  const seesOwnTasks = hasPermission(access, 'VIEW_ACTIVITY') || hasPermission(access, 'MANAGE_ACTIVITY')

  return (
    <div className="workspace">
      <nav className="workspace-nav" aria-label={t.navLabel}>
        <ul className="workspace-nav__list">
          <li>
            <NavLink className="workspace-nav__link" to="/sites">
              {t.sites}
            </NavLink>
          </li>
          {seesOwnTasks ? (
            <li>
              <NavLink className="workspace-nav__link" to="/tasks">
                {t.myTasks}
              </NavLink>
            </li>
          ) : null}
          {can('MANAGE_MEMBERS') ? (
            <li>
              <NavLink className="workspace-nav__link" to="/members">
                {t.members}
              </NavLink>
            </li>
          ) : null}
          <li>
            <Link className="workspace-nav__link" to="/account">
              {t.account}
            </Link>
          </li>
        </ul>
        <div className="workspace-nav__footer">
          <LocaleSwitcher />
        </div>
      </nav>
      <main className="workspace-main">
        {status === 'ready' ? (
          <Suspense
            fallback={
              <div className="page">
                <LoadingState label={t.loading} />
              </div>
            }
          >
            <Outlet />
          </Suspense>
        ) : status === 'error' ? (
          <div className="page">
            <Notice tone="error" action={{ label: t.retry, onClick: reload }}>
              {t.permissionsError}
            </Notice>
          </div>
        ) : (
          <div className="page">
            <LoadingState label={t.loading} />
          </div>
        )}
      </main>
    </div>
  )
}
