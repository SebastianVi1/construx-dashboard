import { lazy, Suspense, useEffect, useRef, type MouseEvent } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { MaterialsIcon, SitesIcon, SpreadsheetIcon, TasksIcon, TeamIcon } from '../../components/icons'
import { LoadingState, Notice } from '../../components/page'
import { useLocale } from '../../i18n'
import { PermissionsProvider, usePermissions } from '../permissions'
import { seesWorkbooks } from '../excel/excelAccess'
import { hasPermission } from '../permissions/landing'
import { useCurrentOrganization } from './organizations-context'
import { WorkspaceHeader } from './WorkspaceHeader'
import { workspaceNavItems, type WorkspaceNavItem } from './workspaceNav'
import './workspace.css'

const MAIN_ID = 'workspace-main'

// Loaded apart so the workspace does not ship the Excel code to people who never see it.
const ExcelNavTree = lazy(() => import('../excel/ExcelNavTree').then((module) => ({ default: module.ExcelNavTree })))

const navIcons: Record<WorkspaceNavItem['key'], typeof SitesIcon> = {
  sites: SitesIcon,
  myTasks: TasksIcon,
  materials: MaterialsIcon,
  excel: SpreadsheetIcon,
  members: TeamIcon,
}

/**
 * Frame of the company workspace: header across the top, navigation beside
 * the routed page (a bottom tab bar on phones). Sits inside `OrganizationGate`.
 * The header stays mounted across a company switch; everything below it
 * reloads the caller's permissions for the selected company.
 */
export function WorkspaceLayout() {
  const organization = useCurrentOrganization()
  const { messages: m } = useLocale()

  const skipToMain = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    document.getElementById(MAIN_ID)?.focus()
  }

  return (
    <div className="workspace">
      <a className="skip-link" href={`#${MAIN_ID}`} onClick={skipToMain}>
        {m.workspace.skipToContent}
      </a>
      <WorkspaceHeader />
      <PermissionsProvider key={organization.id} organizationId={organization.id}>
        <WorkspaceBody />
      </PermissionsProvider>
    </div>
  )
}

function WorkspaceBody() {
  const { messages: m } = useLocale()
  const t = m.workspace
  const { status, access, can, reload } = usePermissions()
  const { pathname } = useLocation()
  const mainRef = useRef<HTMLElement>(null)
  const lastPath = useRef(pathname)

  // Move focus to the new page so keyboard and screen reader users land on it.
  useEffect(() => {
    if (lastPath.current === pathname) return
    lastPath.current = pathname
    mainRef.current?.focus()
  }, [pathname])

  const items = workspaceNavItems({
    seesOwnTasks: hasPermission(access, 'VIEW_ACTIVITY') || hasPermission(access, 'MANAGE_ACTIVITY'),
    seesPrices: can('VIEW_PRICES'),
    seesBudget: seesWorkbooks(access),
    managesMembers: can('MANAGE_MEMBERS'),
  })

  const links = (prefix: 'workspace-nav' | 'workspace-tabbar') =>
    items.map((item) => {
      const Icon = navIcons[item.key]
      return (
        <li key={item.key} className={`${prefix}__item`}>
          <NavLink className={`${prefix}__link`} to={item.to}>
            <Icon className={`${prefix}__icon`} />
            <span className={`${prefix}__label`}>{t[item.key]}</span>
          </NavLink>
          {item.key === 'excel' && prefix === 'workspace-nav' ? (
            <Suspense fallback={null}>
              <ExcelNavTree />
            </Suspense>
          ) : null}
        </li>
      )
    })

  return (
    <>
      <nav className="workspace-nav" aria-label={t.navLabel}>
        <ul className="workspace-nav__list">{links('workspace-nav')}</ul>
      </nav>
      <main id={MAIN_ID} ref={mainRef} tabIndex={-1} className="workspace-main">
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
      <nav className="workspace-tabbar" aria-label={t.navLabel}>
        <ul className="workspace-tabbar__list">{links('workspace-tabbar')}</ul>
      </nav>
    </>
  )
}
