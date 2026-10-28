import { Link, useLocation } from 'react-router'
import symbol from '../../assets/logo/symbol.svg'
import symbolOnDark from '../../assets/logo/symbol-on-dark.svg'
import { useLocale } from '../../i18n'
import { useTheme } from '../../theme'
import { AccountMenu } from '../profile'
import { CompanySwitcher } from './CompanySwitcher'
import { sectionForPath } from './workspaceNav'

/** Top bar of the workspace: brand, company switcher, where you are, and the account menu. */
export function WorkspaceHeader() {
  const { messages: m } = useLocale()
  const { theme } = useTheme()
  const t = m.workspace
  const { pathname } = useLocation()
  const section = sectionForPath(pathname)
  const sectionLabel = section ? (section.key === 'account' ? m.profile.title : t[section.key]) : null

  return (
    <header className="workspace-header">
      <Link className="workspace-header__brand" to="/" aria-label={m.auth.brandHome}>
        <img src={theme === 'dark' ? symbolOnDark : symbol} alt="" width="28" height="28" />
      </Link>
      <CompanySwitcher />
      {section && sectionLabel ? (
        <nav className="workspace-breadcrumb" aria-label={t.breadcrumb}>
          <ol>
            <li>
              {section.isRoot ? (
                <span aria-current="page">{sectionLabel}</span>
              ) : (
                <Link to={section.to}>{sectionLabel}</Link>
              )}
            </li>
          </ol>
        </nav>
      ) : null}
      <div className="workspace-header__end">
        <AccountMenu />
      </div>
    </header>
  )
}
