import { useEffect, useState } from 'react'
import { useRemoteData } from '../../components/data/useRemoteData'
import { Form, useForm, type FieldConfig } from '../../components/form'
import { ConfirmDialog, Modal } from '../../components/modal'
import { BackLink, Notice, SkeletonTable } from '../../components/page'
import { formatMessage, useLocale, type Messages } from '../../i18n'
import { useCurrentOrganization } from '../organizations/organizations-context'
import { usePermissions } from '../permissions'
import { CATALOG_LIMITS, makeListItemSchema } from './catalogForms'
import {
  archiveFamily,
  archiveUnit,
  catalogWriteErrorKind,
  createFamily,
  createUnit,
  listFamilies,
  listUnits,
  updateFamily,
  updateUnit,
  type CatalogWriteErrorKind,
  type Family,
  type Unit,
} from './pricesApi'
import './prices.css'

type PricesMessages = Messages['prices']

/** One row of either list: a Unit shows its description, a Family its name. */
type ListRow = { id: string; code: string; text: string | null; source: Unit['source']; archivedAt: string | null; resourceCount: number }

type ListKind = 'unit' | 'family'

/** Units and Families management, reached from Prices. Reads need VIEW_PRICES, changes MANAGE_PRICES. */
export function CatalogListsPage() {
  const { messages: m } = useLocale()
  const t = m.prices
  const { can } = usePermissions()

  useEffect(() => {
    document.title = `${t.lists.title} | Construx`
  }, [t.lists.title])

  if (!can('VIEW_PRICES')) {
    return (
      <div className="page">
        <Notice>{m.workspace.forbidden}</Notice>
      </div>
    )
  }

  return (
    <div className="page">
      <BackLink to="/prices">{t.lists.back}</BackLink>
      <header className="page-header">
        <div className="page-header__text">
          <h1>{t.lists.title}</h1>
          <p>{t.lists.description}</p>
        </div>
      </header>
      <CatalogList kind="unit" t={t} canManage={can('MANAGE_PRICES')} />
      <CatalogList kind="family" t={t} canManage={can('MANAGE_PRICES')} />
    </div>
  )
}

type Dialog = { kind: 'create' } | { kind: 'edit'; row: ListRow } | { kind: 'archive'; row: ListRow }

function unitRow(unit: Unit): ListRow {
  return { ...unit, text: unit.description }
}

function familyRow(family: Family): ListRow {
  return { ...family, text: family.name }
}

function CatalogList({ kind, t, canManage }: { kind: ListKind; t: PricesMessages; canManage: boolean }) {
  const organization = useCurrentOrganization()
  const [includeArchived, setIncludeArchived] = useState(false)
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [archiveError, setArchiveError] = useState<string | null>(null)
  const l = t.lists
  const isUnit = kind === 'unit'

  const key = `${organization.id}:${kind}-list:${includeArchived}`
  const rows = useRemoteData(
    key,
    async () =>
      isUnit
        ? (await listUnits(organization.id, { includeArchived })).map(unitRow)
        : (await listFamilies(organization.id, { includeArchived })).map(familyRow),
    { remember: false },
  )

  function saved() {
    setDialog(null)
    rows.reload()
  }

  async function archive(row: ListRow) {
    setArchiveError(null)
    try {
      await (isUnit ? archiveUnit(organization.id, row.id) : archiveFamily(organization.id, row.id))
      saved()
    } catch (error) {
      setArchiveError(t.writeError[catalogWriteErrorKind(error)])
    }
  }

  const title = isUnit ? l.units : l.families
  const data = rows.data
  return (
    <section className="page-section" aria-label={title}>
      <div className="prices-list-header">
        <h2>{title}</h2>
        <label className="prices-filters__check">
          <input type="checkbox" checked={includeArchived} onChange={(event) => setIncludeArchived(event.target.checked)} />
          <span>{t.common.showArchived}</span>
        </label>
        {canManage ? (
          <button type="button" className="button button--primary button--small" onClick={() => setDialog({ kind: 'create' })}>
            {isUnit ? l.addUnit : l.addFamily}
          </button>
        ) : null}
      </div>

      {rows.status === 'error' && !data ? (
        <Notice tone="error" action={{ label: t.load.retry, onClick: rows.reload }}>
          {l.load}
        </Notice>
      ) : !data ? (
        <SkeletonTable columns={4} />
      ) : data.length === 0 ? (
        <div className="empty-state">
          <p>{isUnit ? l.unitsEmpty : l.familiesEmpty}</p>
        </div>
      ) : (
        <div className="table-scroll">
          <table className="data-table prices-table">
            <thead>
              <tr>
                <th scope="col">{l.column.code}</th>
                <th scope="col">{isUnit ? l.column.description : l.column.name}</th>
                <th scope="col">{l.column.source}</th>
                <th scope="col" className="prices-table__number">{t.common.resources}</th>
                {canManage ? <th scope="col"><span className="visually-hidden">{t.common.actions}</span></th> : null}
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.id}>
                  <td className="data-mono">
                    {row.code}
                    {row.archivedAt ? (
                      <span className="prices-badges">
                        <span className="badge">{t.common.archived}</span>
                      </span>
                    ) : null}
                  </td>
                  <td>{row.text ?? <span className="cell-muted">—</span>}</td>
                  <td>{t.source[row.source]}</td>
                  <td className="data-mono prices-table__number">{row.resourceCount}</td>
                  {canManage ? (
                    <td className="cell-actions">
                      <div className="button-row button-row--end">
                        <button
                          type="button"
                          className="button button--small"
                          aria-label={formatMessage(l.editLabel, { code: row.code })}
                          onClick={() => setDialog({ kind: 'edit', row })}
                        >
                          {t.common.edit}
                        </button>
                        {row.archivedAt ? null : (
                          <button
                            type="button"
                            className="button button--small button--danger"
                            aria-label={formatMessage(l.archiveLabel, { code: row.code })}
                            onClick={() => {
                              setArchiveError(null)
                              setDialog({ kind: 'archive', row })
                            }}
                          >
                            {t.common.archive}
                          </button>
                        )}
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {dialog?.kind === 'create' || dialog?.kind === 'edit' ? (
        <ListItemDialog
          kind={kind}
          organizationId={organization.id}
          row={dialog.kind === 'edit' ? dialog.row : undefined}
          t={t}
          onSaved={saved}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog?.kind === 'archive' ? (
        <ConfirmDialog
          title={isUnit ? l.archiveUnitTitle : l.archiveFamilyTitle}
          body={formatMessage(l.archiveBody, { code: dialog.row.code })}
          confirmLabel={t.common.archive}
          pendingLabel={t.common.archiving}
          cancelLabel={t.common.cancel}
          error={archiveError}
          onConfirm={() => archive(dialog.row)}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </section>
  )
}

/** Create a Unit or Family, or change its description or name; the code is set once. */
function ListItemDialog({
  kind,
  organizationId,
  row,
  t,
  onSaved,
  onClose,
}: {
  kind: ListKind
  organizationId: string
  row?: ListRow
  t: PricesMessages
  onSaved: () => void
  onClose: () => void
}) {
  const [errorKind, setErrorKind] = useState<CatalogWriteErrorKind>('generic')
  const l = t.lists
  const isUnit = kind === 'unit'
  const fields: FieldConfig[] = [
    ...(row
      ? []
      : [{
          name: 'code',
          label: l.column.code,
          maxLength: isUnit ? CATALOG_LIMITS.unitCode : CATALOG_LIMITS.familyCode,
          hint: l.codeHint,
          spellCheck: false,
        }]),
    {
      name: 'text',
      label: isUnit ? l.column.description : l.column.name,
      maxLength: isUnit ? CATALOG_LIMITS.unitDescription : CATALOG_LIMITS.familyName,
    },
  ]
  const form = useForm({
    initialValues: { code: row?.code ?? '', text: row?.text ?? '' },
    schema: makeListItemSchema(kind, t.validation),
    onSubmit: async ({ code, text }) => {
      try {
        if (isUnit) {
          if (row) await updateUnit(organizationId, row.id, { description: text })
          else await createUnit(organizationId, { code, description: text || undefined })
        } else if (row) {
          await updateFamily(organizationId, row.id, { name: text })
        } else {
          await createFamily(organizationId, { code, name: text })
        }
        onSaved()
      } catch (error) {
        setErrorKind(catalogWriteErrorKind(error))
        throw error
      }
    },
    onInvalid: (errors) => {
      const first = fields.find((field) => errors[field.name])
      if (first) document.getElementById(`field-${first.name}`)?.focus()
    },
  })

  const title = row
    ? formatMessage(isUnit ? l.editUnitTitle : l.editFamilyTitle, { code: row.code })
    : isUnit
      ? l.createUnitTitle
      : l.createFamilyTitle

  return (
    <Modal title={title} onClose={onClose}>
      <Form
        controller={form}
        fields={fields}
        submitLabel={row ? t.common.save : t.common.create}
        pendingLabel={row ? t.common.saving : t.common.creating}
      >
        {form.submitError ? (
          <p className="form-error" role="alert">
            {t.writeError[errorKind]}
          </p>
        ) : null}
      </Form>
      <div className="button-row button-row--end modal-actions">
        <button type="button" className="button" onClick={onClose}>
          {t.common.cancel}
        </button>
      </div>
    </Modal>
  )
}
