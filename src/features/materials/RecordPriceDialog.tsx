import { useState } from 'react'
import { useRemoteData } from '../../components/data/useRemoteData'
import { Form, useForm } from '../../components/form'
import { Modal } from '../../components/modal'
import { LoadingState, Notice } from '../../components/page'
import { useLocale } from '../../i18n'
import { priceFields } from './materialDisplay'
import { NEW_SUPPLIER, makePriceSchema, type PriceValues } from './materialForm'
import { localToday } from './priceRules'
import {
  createSupplier,
  listSuppliers,
  pricingErrorKind,
  recordPrice,
  type Material,
  type PriceObservation,
  type PricingErrorKind,
} from './pricingApi'

type RecordPriceDialogProps = {
  organizationId: string
  /** Pick from these materials, or record for `materialId` only. */
  materials?: Material[]
  materialId?: string
  onRecorded: (observation: PriceObservation) => void
  onClose: () => void
}

/**
 * Record one price. The supplier can be picked or created inline; a supplier
 * created here is kept selected, so retrying after a failed price does not try
 * to create it twice.
 */
export function RecordPriceDialog({ organizationId, materials, materialId = '', onRecorded, onClose }: RecordPriceDialogProps) {
  const { messages: m } = useLocale()
  const t = m.materials
  const suppliers = useRemoteData(`${organizationId}:suppliers`, () => listSuppliers(organizationId))
  const [errorKind, setErrorKind] = useState<PricingErrorKind>('generic')
  const today = localToday()

  const initialValues: PriceValues = {
    materialId,
    supplierId: '',
    supplierName: '',
    supplierBranch: '',
    supplierWebsite: '',
    price: '',
    observedOn: today,
    sku: '',
  }

  const form = useForm({
    initialValues,
    schema: makePriceSchema(t.validation, today),
    onSubmit: async (values) => {
      try {
        let supplierId = values.supplierId
        if (supplierId === NEW_SUPPLIER) {
          const supplier = await createSupplier(organizationId, {
            name: values.supplierName,
            branch: values.supplierBranch,
            website: values.supplierWebsite,
          })
          suppliers.update((current) => [...current, supplier].sort((a, b) => a.name.localeCompare(b.name)))
          form.onChange('supplierId', supplier.id)
          supplierId = supplier.id
        }
        onRecorded(await recordPrice(organizationId, { ...values, supplierId }))
      } catch (error) {
        setErrorKind(pricingErrorKind(error))
        throw error
      }
    },
    onInvalid: (errors) => {
      const order = ['materialId', 'supplierId', 'supplierName', 'supplierBranch', 'supplierWebsite', 'price', 'observedOn', 'sku']
      const first = order.find((name) => errors[name])
      if (first) document.getElementById(`field-${first}`)?.focus()
    },
  })

  return (
    <Modal title={t.record.title} description={t.record.description} onClose={onClose}>
      {materials && materials.length === 0 ? (
        <Notice>{t.record.noMaterials}</Notice>
      ) : suppliers.data ? (
        <Form
          controller={form}
          fields={priceFields(t, {
            materials,
            suppliers: suppliers.data,
            newSupplier: form.values.supplierId === NEW_SUPPLIER,
          })}
          submitLabel={t.record.submit}
          pendingLabel={t.record.pending}
        >
          {form.submitError ? (
            <p className="form-error" role="alert">
              {t.error[errorKind]}
            </p>
          ) : null}
        </Form>
      ) : suppliers.status === 'error' ? (
        <Notice tone="error" action={{ label: t.load.retry, onClick: suppliers.reload }}>
          {t.record.suppliersError}
        </Notice>
      ) : (
        <LoadingState label={t.record.suppliersLoading} />
      )}
      <div className="button-row button-row--end modal-actions">
        <button type="button" className="button" onClick={onClose}>
          {t.record.cancel}
        </button>
      </div>
    </Modal>
  )
}
