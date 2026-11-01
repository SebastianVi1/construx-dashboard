import { useState } from 'react'
import { NavLink, useParams } from 'react-router'
import { ChevronDownIcon, FolderIcon } from '../../components/icons'
import { formatMessage, useLocale } from '../../i18n'
import { usePlanLibrary } from './planLibraryContext'
import { folderPath, folderRows, planFolderHref } from './planTree'
import './plans.css'

export function PlansNavTree() {
  const { data } = usePlanLibrary()
  const { messages: m } = useLocale()
  const { folderId = null } = useParams()
  // Explicit user toggles; without one, the ancestors of the active folder are open so deep links show where we are.
  const [toggles, setToggles] = useState<Map<string, boolean>>(new Map())
  const activePath = new Set(folderPath(data?.folders ?? [], folderId).map(folder => folder.id))
  const isOpen = (id: string) => toggles.get(id) ?? activePath.has(id)
  const toggle = (id: string) => setToggles(current => {
    const next = new Map(current)
    next.set(id, !isOpen(id))
    return next
  })

  if (!data?.folders.length) return null
  const expanded = new Set(data.folders.filter(folder => isOpen(folder.id)).map(folder => folder.id))
  return <ul className="plans-nav-tree" aria-label={m.plans.library.folders}>
    {folderRows(data.folders, expanded).map(({ folder, level, hasChildren }) => <li key={folder.id} style={{ paddingInlineStart: `${level * 12}px` }}>
      <button className="plans-nav-tree__toggle" type="button" disabled={!hasChildren} aria-expanded={expanded.has(folder.id)}
        aria-label={formatMessage(expanded.has(folder.id) ? m.excel.collapseFolder : m.excel.expandFolder, { name: folder.name })}
        onClick={() => toggle(folder.id)}>
        <ChevronDownIcon />
      </button>
      <NavLink to={planFolderHref(folder.id)} title={folder.name}><FolderIcon /><span>{folder.name}</span></NavLink>
    </li>)}
  </ul>
}
