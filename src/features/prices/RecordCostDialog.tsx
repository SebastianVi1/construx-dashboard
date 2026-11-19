import { useState } from 'react'
import { useRemoteData } from '../../components/data/useRemoteData'
import { Form, useForm, type FieldConfig } from '../../components/form'
import { Modal } from '../../components/modal'
import { Notice, SkeletonForm } from '../../components/page'
import { useCurrency } from '../../currency'
import { formatMessage, useLocale } from '../../i18n'
import { listSuppliers, recordResourceCost, type ResourceDetail } from './pricesApi'
import {
  RESOURCE_LIMITS,
  costBody,
  emptyCostValues,
  makeCostSchema,
  resourceWriteErrorKind,
  type ResourceWriteErrorKind,
} from './resourceForm'

type RecordCostDialogProps = {
  organizationId: string
  resource: ResourceDetail
  onRecorded: (detail: ResourceDetail) => void
  onClose: () => void
}

/** "Registrar costo": one new history entry, effective from the moment it is saved. */
export function RecordCostDialog({ organizationId, resource, onRecorded, onClose }: RecordCostDialogProps) {
  const { messages: m } = useLocale()
  const w = m.prices.write
  const money = useCurrency()
  const suppliers = useRemoteData(`${organizationId}:suppliers`, () => listSuppliers(organizationId))
  const [errorKind, setErrorKind] = useState<ResourceWriteErrorKind>('generic')

  const form = useForm({
    initialValues: { ...emptyCostValues, supplierId: resource.supplier?.id ?? '' },
    schema: makeCostSchema(w.validation, money),
    onSubmit: async (values) => {
      try {
        onRecorded(await recordResourceCost(organizationId, resource.id, costBody(values, money)))
      } catch (error) {
        setErrorKind(resourceWriteErrorKind(error))
        throw error
      }
    },
    onInvalid: (errors) => {
      const first = ['amount', 'supplierId', 'sku', 'note'].find((name) => errors[name])
      if (first) document.getElementById(`field-${first}`)?.focus()
    },
  })

  const supplierOptions = [
    { value: '', label: w.field.none },
    ...(suppliers.data ?? []).map((supplier) => ({
      value: supplier.id,
      label: supplier.branch ? `${supplier.name} · ${supplier.branch}` : supplier.name,
    })),
  ]
  // The Resource's own supplier stays selectable even if it was archived since; the server decides.
  if (resource.supplier && !supplierOptions.some((option) => option.value === resource.supplier?.id)) {
    supplierOptions.push({ value: resource.supplier.id, label: resource.supplier.name })
  }
  const fields: FieldConfig[] = [
    {
      name: 'amount',
      label: formatMessage(w.field.amount, { currency: money.currency }),
      type: 'money',
      placeholder: w.field.amountPlaceholder,
    },
    { name: 'supplierId', label: w.field.supplier, type: 'select', options: supplierOptions },
    { name: 'sku', label: w.field.sku, autoComplete: 'off', spellCheck: false, maxLength: RESOURCE_LIMITS.sku },
    { name: 'note', label: w.field.note, placeholder: w.field.notePlaceholder, autoComplete: 'off', maxLength: RESOURCE_LIMITS.note },
  ]

  return (
    <Modal title={formatMessage(w.recordTitle, { code: resource.code })} description={w.recordDescription} onClose={onClose}>
      {suppliers.data ? (
        <Form controller={form} fields={fields} submitLabel={w.record} pendingLabel={w.recording}>
          {form.submitError ? (
            <p className="form-error" role="alert">
              {w.error[errorKind]}
            </p>
          ) : null}
        </Form>
      ) : suppliers.status === 'error' ? (
        <Notice tone="error" action={{ label: m.prices.load.retry, onClick: suppliers.reload }}>
          {w.pickersError}
        </Notice>
      ) : (
        <SkeletonForm fields={4} />
      )}
      <div className="button-row button-row--end modal-actions">
        <button type="button" className="button" onClick={onClose}>
          {w.cancel}
        </button>
      </div>
    </Modal>
  )
}
