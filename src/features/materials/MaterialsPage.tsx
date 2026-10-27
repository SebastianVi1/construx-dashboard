import { useEffect } from 'react'
import { Notice } from '../../components/page'
import { useLocale } from '../../i18n'
import { usePermissions } from '../permissions'

/** Material prices of the company. Empty until prices can be recorded. */
export function MaterialsPage() {
  const { messages: m } = useLocale()
  const t = m.materials
  const { can } = usePermissions()

  useEffect(() => {
    document.title = `${t.title} | Construx`
  }, [t.title])

  if (!can('VIEW_PRICES')) {
    return (
      <div className="page">
        <Notice>{m.workspace.forbidden}</Notice>
      </div>
    )
  }

  return (
    <div className="page">
      <header className="page-header">
        <div className="page-header__text">
          <h1>{t.title}</h1>
          <p>{t.description}</p>
        </div>
      </header>

      <section className="page-section" aria-label={t.title}>
        <div className="empty-state">
          <h2>{t.emptyTitle}</h2>
          <p>{t.empty}</p>
        </div>
      </section>
    </div>
  )
}
