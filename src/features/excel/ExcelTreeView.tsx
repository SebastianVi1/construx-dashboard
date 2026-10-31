import type { CSSProperties, HTMLAttributes, ReactNode } from 'react'
import { ChevronDownIcon } from '../../components/icons'
import { formatMessage, type Messages } from '../../i18n'
import type { TreeWorkbook } from './excelModel'
import type { TreeRow } from './excelTreeRows'

/**
 * A folder tree as an indented list: each folder has an arrow button that shows or hides its
 * content right under it. `renderRow` draws the rest of the line; `rowProps` adds attributes
 * such as drag handlers to it.
 */
export function ExcelTreeView<W extends TreeWorkbook>({
  t,
  rows,
  className,
  label,
  onToggle,
  renderRow,
  rowProps,
}: {
  t: Messages['excel']
  rows: TreeRow<W>[]
  /** The list's class; rows get `<className>__item` and the arrow `<className>__toggle`; `--tree-level` sets the indent. */
  className: string
  label: string
  onToggle: (folderId: string) => void
  renderRow: (row: TreeRow<W>) => ReactNode
  rowProps?: (row: TreeRow<W>) => HTMLAttributes<HTMLElement> & Record<`data-${string}`, unknown>
}) {
  return (
    <ul className={className} aria-label={label}>
      {rows.map((row) => {
        const id = row.kind === 'folder' ? row.folder.id : row.workbook.id
        return (
          <li
            key={`${row.kind}:${id}`}
            className={`${className}__item`}
            data-kind={row.kind}
            style={{ '--tree-level': row.level } as CSSProperties}
            {...rowProps?.(row)}
          >
            {row.kind === 'folder' ? (
              <button
                type="button"
                className={`${className}__toggle`}
                aria-expanded={row.expanded}
                aria-label={formatMessage(row.expanded ? t.collapseFolder : t.expandFolder, { name: row.folder.name })}
                data-empty={!row.hasChildren || undefined}
                disabled={!row.hasChildren}
                onClick={() => onToggle(row.folder.id)}
              >
                <ChevronDownIcon />
              </button>
            ) : (
              <span className={`${className}__toggle`} aria-hidden="true" data-empty />
            )}
            {renderRow(row)}
          </li>
        )
      })}
    </ul>
  )
}
