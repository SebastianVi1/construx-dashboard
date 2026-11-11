import type { CSSProperties, ReactNode } from 'react'
import { useLocale } from '../../i18n/locale-context'
import { skeletonRowCount } from './skeletonSize'
import './page.css'

/** Decorative geometry; compose it inside the same layout as the loaded content. */
export function SkeletonBlock({ width, height = 14, className = '' }: {
  width?: CSSProperties['width']
  height?: CSSProperties['height']
  className?: string
}) {
  return <span className={`skeleton-block skeleton-shape ${className}`} style={{ width, height }} aria-hidden="true" />
}

/** A loading region adds no sizing, borders, or padding of its own. */
export function SkeletonRegion({ children, className, label }: {
  children: ReactNode
  className?: string
  label?: string
}) {
  const { messages } = useLocale()
  return <div className={className} role="status" aria-busy="true" aria-label={label ?? messages.workspace.loading}>{children}</div>
}

export function SkeletonTable({ columns = 4, rows, compact = false, label }: {
  columns?: number
  rows?: number
  compact?: boolean
  label?: string
}) {
  // A data-rich screen fills the table: the placeholder keeps that shape even when the answer is short.
  const rowCount = rows ?? (compact ? skeletonRowCount({ rowHeight: 46, reserved: 520, min: 4, max: 9 }) : skeletonRowCount())
  return <SkeletonRegion className={`table-scroll skeleton-screen${compact ? ' skeleton-screen--compact' : ''}`} label={label}>
    <table className={`data-table${compact ? ' data-table--compact' : ''}`} aria-hidden="true">
      <thead><tr>{Array.from({ length: columns }, (_, column) => <th key={column}><SkeletonBlock width="65%" /></th>)}</tr></thead>
      <tbody>{Array.from({ length: rowCount }, (_, row) => <tr key={row}>
        {Array.from({ length: columns }, (_, column) => <td key={column}><SkeletonBlock width={column === 0 ? '80%' : '60%'} /></td>)}
      </tr>)}</tbody>
    </table>
  </SkeletonRegion>
}

export function SkeletonForm({ fields = 4 }: { fields?: number }) {
  return <SkeletonRegion className="skeleton-fields">
    {Array.from({ length: fields }, (_, field) => <div className="skeleton-field" key={field}>
      <SkeletonBlock width="35%" height={21} /><SkeletonBlock height={46} />
    </div>)}
    <SkeletonBlock width={128} height={44} />
  </SkeletonRegion>
}

export function SkeletonRows({ rows, avatar = false }: { rows?: number; avatar?: boolean }) {
  const rowCount = rows ?? skeletonRowCount({ rowHeight: 72, reserved: 420, min: 4, max: 10 })
  return <SkeletonRegion className="skeleton-rows skeleton-screen">
    {Array.from({ length: rowCount }, (_, row) => <div className="skeleton-row" key={row}>
      {avatar ? <SkeletonBlock width={40} height={40} className="skeleton-avatar" /> : null}
      <div className="skeleton-row__body"><SkeletonBlock width="60%" /><SkeletonBlock width="40%" /></div>
      <SkeletonBlock width={64} height={24} />
    </div>)}
  </SkeletonRegion>
}
