import { useEffect, useState } from 'react'
import { useRemoteData } from '../../components/data/useRemoteData'
import { ConfirmDialog } from '../../components/modal'
import { Notice, SkeletonTable } from '../../components/page'
import { formatMessage, type Messages } from '../../i18n'
import { useCurrentOrganization } from '../organizations/organizations-context'
import { usePermissions } from '../permissions'
import { SupplierDialog } from './SupplierDialog'
import { archiveSupplier, catalogWriteErrorKind, listSuppliers, pricesErrorKind, type Supplier } from './pricesApi'

type PricesMessages = Messages['prices']

type Dialog = { kind: 'create' } | { kind: 'edit'; supplier: Supplier } | { kind: 'archive'; supplier: Supplier }

/** The Proveedores tab: search, resource counts, and create, edit and archive for MANAGE_PRICES. */
export function SuppliersTab({ t }: { t: PricesMessages }) {
  const organization = useCurrentOrganization()
  const { can } = usePermissions()
  const canManage = can('MANAGE_PRICES')
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [includeArchived, setIncludeArchived] = useState(false)
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [archiveError, setArchiveError] = useState<string | null>(null)

  // Search after the person pauses typing, so each keystroke is not a request.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 300)
    return () => clearTimeout(timer)
  }, [search])

  const key = `${organization.id}:suppliers:${JSON.stringify({ query, includeArchived })}`
  const suppliers = useRemoteData(key, () => listSuppliers(organization.id, { query, includeArchived }), { remember: false })
  const s = t.suppliers

  function saved() {
    setDialog(null)
    suppliers.reload()
  }

  async function archive(supplier: Supplier) {
    setArchiveError(null)
    try {
      await archiveSupplier(organization.id, supplier.id)
      saved()
    } catch (error) {
      setArchiveError(t.writeError[catalogWriteErrorKind(error)])
    }
  }

  const rows = suppliers.data
  return (
    <section className="page-section" aria-label={s.title}>
      <div className="prices-filters" role="group" aria-label={t.filters.label}>
        <label className="prices-filters__field prices-filters__field--wide">
          <span>{s.search}</span>
          <input
            type="search"
            className="prices-input"
            placeholder={s.searchPlaceholder}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <label className="prices-filters__check">
          <input type="checkbox" checked={includeArchived} onChange={(event) => setIncludeArchived(event.target.checked)} />
          <span>{t.common.showArchived}</span>
        </label>
        {canManage ? (
          <button type="button" className="button button--primary prices-filters__action" onClick={() => setDialog({ kind: 'create' })}>
            {s.add}
          </button>
        ) : null}
      </div>

      {suppliers.status === 'error' && !rows ? (
        <Notice tone="error" action={{ label: t.load.retry, onClick: suppliers.reload }}>
          {t.load[pricesErrorKind(suppliers.error)]}
        </Notice>
      ) : !rows ? (
        <SkeletonTable columns={6} />
      ) : rows.length === 0 ? (
        <div className="empty-state">
          <p>{query ? s.noResults : s.empty}</p>
        </div>
      ) : (
        <div className="table-scroll">
          <table className="data-table prices-table">
            <thead>
              <tr>
                <th scope="col">{s.column.name}</th>
                <th scope="col">{s.column.code}</th>
                <th scope="col">{s.column.contact}</th>
                <th scope="col">{s.column.phone}</th>
                <th scope="col">{s.column.email}</th>
                <th scope="col">{s.column.city}</th>
                <th scope="col" className="prices-table__number">{t.common.resources}</th>
                {canManage ? <th scope="col"><span className="visually-hidden">{t.common.actions}</span></th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((supplier) => (
                <SupplierRow
                  key={supplier.id}
                  supplier={supplier}
                  canManage={canManage}
                  t={t}
                  onEdit={() => setDialog({ kind: 'edit', supplier })}
                  onArchive={() => {
                    setArchiveError(null)
                    setDialog({ kind: 'archive', supplier })
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {dialog?.kind === 'create' ? (
        <SupplierDialog organizationId={organization.id} t={t} onSaved={saved} onClose={() => setDialog(null)} />
      ) : null}
      {dialog?.kind === 'edit' ? (
        <SupplierDialog organizationId={organization.id} supplier={dialog.supplier} t={t} onSaved={saved} onClose={() => setDialog(null)} />
      ) : null}
      {dialog?.kind === 'archive' ? (
        <ConfirmDialog
          title={s.archiveTitle}
          body={formatMessage(s.archiveBody, { name: dialog.supplier.name })}
          confirmLabel={t.common.archive}
          pendingLabel={t.common.archiving}
          cancelLabel={t.common.cancel}
          error={archiveError}
          onConfirm={() => archive(dialog.supplier)}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </section>
  )
}

function SupplierRow({
  supplier,
  canManage,
  t,
  onEdit,
  onArchive,
}: {
  supplier: Supplier
  canManage: boolean
  t: PricesMessages
  onEdit: () => void
  onArchive: () => void
}) {
  const s = t.suppliers
  const muted = <span className="cell-muted">—</span>
  return (
    <tr>
      <td>
        {supplier.name}
        {supplier.branch ? <span className="cell-muted"> · {supplier.branch}</span> : null}
        {supplier.isDefault || supplier.archivedAt || supplier.source === 'NEODATA_CONSTRUBASE' ? (
          <span className="prices-badges">
            {supplier.isDefault ? <span className="badge" data-tone="success">{s.defaultBadge}</span> : null}
            {supplier.source === 'NEODATA_CONSTRUBASE' ? <span className="badge">{s.importedBadge}</span> : null}
            {supplier.archivedAt ? <span className="badge">{t.common.archived}</span> : null}
          </span>
        ) : null}
      </td>
      <td className="data-mono">{supplier.code ?? muted}</td>
      <td>{supplier.contact ?? muted}</td>
      <td className="data-mono">{supplier.phone ?? supplier.mobile ?? muted}</td>
      <td>{supplier.email ?? muted}</td>
      <td>{supplier.city ?? muted}</td>
      <td className="data-mono prices-table__number">{supplier.resourceCount}</td>
      {canManage ? (
        <td className="cell-actions">
          <div className="button-row button-row--end">
            <button type="button" className="button button--small" aria-label={formatMessage(s.editLabel, { name: supplier.name })} onClick={onEdit}>
              {t.common.edit}
            </button>
            {supplier.archivedAt ? null : (
              <button
                type="button"
                className="button button--small button--danger"
                aria-label={formatMessage(s.archiveLabel, { name: supplier.name })}
                onClick={onArchive}
              >
                {t.common.archive}
              </button>
            )}
          </div>
        </td>
      ) : null}
    </tr>
  )
}
