import { useId } from 'react'
import { Link } from 'react-router'
import { useLocale } from '../../i18n'
import { useOrganizations } from './organizations-context'

/**
 * The slim, persistent strip naming the selected company (design.md
 * "signature"). With several companies the name becomes a native select.
 */
export function OrganizationContextStrip() {
  const { organizations, current, select } = useOrganizations()
  const { messages: m } = useLocale()
  const selectId = useId()

  if (!current) return null

  return (
    <nav className="org-strip" aria-label={m.organizations.context.label}>
      <div className="org-strip__scope">
        {organizations.length > 1 ? (
          <>
            <label className="org-strip__label" htmlFor={selectId}>
              {m.organizations.context.label}
            </label>
            <span className="org-strip__select-wrap">
              <select
                id={selectId}
                className="org-strip__select"
                value={current.id}
                title={m.organizations.context.switch}
                onChange={(event) => select(event.target.value)}
              >
                {organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
              </select>
            </span>
          </>
        ) : (
          <>
            <span className="org-strip__label">{m.organizations.context.label}</span>
            <span className="org-strip__name">{current.name}</span>
          </>
        )}
        {current.myRole ? <span className="org-strip__role">{current.myRole.name}</span> : null}
      </div>
      <Link className="org-strip__new" to="/organizations/new">
        {m.organizations.context.newCompany}
      </Link>
    </nav>
  )
}
