import { useId } from 'react'
import { NavLink } from 'react-router'
import { ChevronDownIcon, FolderIcon, SpreadsheetIcon } from '../../components/icons'
import { useLocale } from '../../i18n'
import { folderHref } from './excelTree'
import { treeRows } from './excelTreeRows'
import { ExcelTreeView } from './ExcelTreeView'
import { useExcelLibrary, useExpandedFolders } from './useExcelLibrary'
import { useExcelOwner, useExcelStore } from './useExcelStore'
import './excel.css'

/** Stored with the open folders: whether the whole tree under the Excel entry is shown. */
const NAV_OPEN = 'library'

/**
 * The company's folders and workbooks under the Excel entry of the side navigation, for
 * jumping straight to one. Shown only where the full side navigation is; moving and the other
 * actions stay on the library page.
 */
export function ExcelNavTree() {
  const { messages: m } = useLocale()
  const t = m.excel
  const owner = useExcelOwner()
  const { store } = useExcelStore()
  const { library } = useExcelLibrary(store, owner.organizationId, t)
  const { expanded, toggle } = useExpandedFolders(owner.organizationId, 'nav')
  const treeId = useId()
  const open = expanded.has(NAV_OPEN)
  if (!library || (library.folders.length === 0 && library.workbooks.length === 0)) return null

  return (
    <div className="excel-nav">
      <button
        type="button"
        className="excel-nav__switch"
        aria-expanded={open}
        aria-controls={treeId}
        aria-label={open ? t.hideNavTree : t.showNavTree}
        onClick={() => toggle(NAV_OPEN)}
      >
        <ChevronDownIcon />
      </button>
      {open ? (
        <div id={treeId}>
          <ExcelTreeView
            t={t}
            rows={treeRows(library, null, expanded)}
            className="excel-nav-tree"
            label={t.navTree}
            onToggle={toggle}
            renderRow={(row) =>
              row.kind === 'folder' ? (
                <NavLink className="excel-nav-tree__link" to={folderHref(row.folder.id)} end title={row.folder.name}>
                  <FolderIcon className="excel-nav-tree__icon" />
                  <span className="excel-nav-tree__name">{row.folder.name}</span>
                </NavLink>
              ) : (
                <NavLink className="excel-nav-tree__link" to={`/excel/${row.workbook.id}`} end title={row.workbook.name}>
                  <SpreadsheetIcon className="excel-nav-tree__icon" />
                  <span className="excel-nav-tree__name">{row.workbook.name}</span>
                </NavLink>
              )
            }
          />
        </div>
      ) : null}
    </div>
  )
}
