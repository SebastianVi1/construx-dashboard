import { useState } from 'react'
import { Form, useForm } from '../../components/form'
import { Modal } from '../../components/modal'
import { useLocale } from '../../i18n'
import { budgetAmount, budgetText, budgetToInput, makeBudgetSchema } from './budgetRules'
import { setSiteBudget, siteErrorKind, type Site, type SiteErrorKind } from './sitesApi'

type SiteBudgetProps = {
  organizationId: string
  site: Site
  /** MANAGE_BUDGET: shows the set/edit button. Render this section only with VIEW_BUDGET. */
  canManage: boolean
  onSaved: (site: Site, notice: string) => void
}

/** The site's allocated budget, with a dialog to set, change or remove it. */
export function SiteBudget({ organizationId, site, canManage, onSaved }: SiteBudgetProps) {
  const { messages: m, locale } = useLocale()
  const t = m.sites.budget
  const [open, setOpen] = useState(false)
  const budget = site.allocatedBudget

  return (
    <section className="page-section" aria-labelledby="site-budget-heading">
      <div className="page-section__header">
        <h2 id="site-budget-heading">{t.title}</h2>
        {canManage ? (
          <button type="button" className="button" onClick={() => setOpen(true)}>
            {budget === null ? t.set : t.edit}
          </button>
        ) : null}
      </div>
      {budget === null ? (
        <p>{t.notSet}</p>
      ) : (
        <dl className="site-facts">
          <div>
            <dt>{t.allocated}</dt>
            <dd className="data-mono">{budgetText(budget, locale)}</dd>
          </div>
        </dl>
      )}
      {open ? (
        <BudgetDialog
          organizationId={organizationId}
          site={site}
          onClose={() => setOpen(false)}
          onSaved={(updated, notice) => {
            setOpen(false)
            onSaved(updated, notice)
          }}
        />
      ) : null}
    </section>
  )
}

type BudgetDialogProps = {
  organizationId: string
  site: Site
  onClose: () => void
  onSaved: (site: Site, notice: string) => void
}

function BudgetDialog({ organizationId, site, onClose, onSaved }: BudgetDialogProps) {
  const { messages: m } = useLocale()
  const t = m.sites.budget
  const [errorKind, setErrorKind] = useState<SiteErrorKind | null>(null)
  const [removing, setRemoving] = useState(false)

  const form = useForm({
    initialValues: { amount: budgetToInput(site.allocatedBudget) },
    schema: makeBudgetSchema(t.validation),
    onSubmit: async (values) => {
      setErrorKind(null)
      try {
        onSaved(await setSiteBudget(organizationId, site.id, budgetAmount(values.amount)), t.saved)
      } catch (error) {
        setErrorKind(siteErrorKind(error))
        throw error
      }
    },
    onInvalid: () => document.getElementById('field-amount')?.focus(),
  })

  async function remove() {
    if (removing) return
    setRemoving(true)
    setErrorKind(null)
    try {
      onSaved(await setSiteBudget(organizationId, site.id, null), t.removed)
    } catch (error) {
      setErrorKind(siteErrorKind(error))
      setRemoving(false)
    }
  }

  const busy = removing || form.isSubmitting

  return (
    <Modal title={t.dialogTitle} description={t.dialogBody} onClose={onClose}>
      <Form
        controller={form}
        fields={[{ name: 'amount', label: t.amount, placeholder: t.amountPlaceholder, inputMode: 'decimal', autoComplete: 'off' }]}
        submitLabel={t.save}
        pendingLabel={t.saving}
      >
        {errorKind ? (
          <p className="form-error" role="alert">
            {t.error[errorKind]}
          </p>
        ) : null}
      </Form>
      <div className="button-row button-row--end modal-actions">
        {site.allocatedBudget !== null ? (
          <button type="button" className="button button--danger" onClick={() => void remove()} disabled={busy}>
            {removing ? t.removing : t.remove}
          </button>
        ) : null}
        <button type="button" className="button" onClick={onClose} disabled={busy}>
          {t.cancel}
        </button>
      </div>
    </Modal>
  )
}
