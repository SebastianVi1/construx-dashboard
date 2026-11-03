import { useLocale } from '../../i18n'

export function DocumentsPage() {
  const { messages: m } = useLocale()
  return (
    <div className="page">
      <h1>{m.workspace.documents}</h1>
    </div>
  )
}
