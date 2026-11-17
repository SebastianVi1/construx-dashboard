import { useState } from 'react'
import { Form, TEXT_LIMITS, useForm, type FieldConfig } from '../../components/form'
import { Modal } from '../../components/modal'
import { formatMessage, type Messages } from '../../i18n'
import {
  CATALOG_LIMITS,
  DEFAULT_OPTION,
  makeSupplierSchema,
  supplierCreateBody,
  supplierFormValues,
  supplierPatchBody,
} from './catalogForms'
import { catalogWriteErrorKind, createSupplier, updateSupplier, type CatalogWriteErrorKind, type Supplier } from './pricesApi'

type PricesMessages = Messages['prices']

function supplierFields(t: PricesMessages, imported: boolean): FieldConfig[] {
  const f = t.suppliers.field
  const fields: FieldConfig[] = [
    { name: 'name', label: f.name, maxLength: TEXT_LIMITS.supplierName, autoComplete: 'organization' },
    { name: 'branch', label: f.branch, maxLength: TEXT_LIMITS.supplierBranch },
    { name: 'code', label: f.code, maxLength: CATALOG_LIMITS.supplierCode, spellCheck: false },
    { name: 'rfc', label: f.rfc, maxLength: CATALOG_LIMITS.rfc, spellCheck: false },
    { name: 'contact', label: f.contact, maxLength: CATALOG_LIMITS.contact },
    { name: 'email', label: f.email, type: 'email', maxLength: CATALOG_LIMITS.email, autoComplete: 'off' },
    { name: 'phone', label: f.phone, type: 'tel', maxLength: CATALOG_LIMITS.phone },
    { name: 'mobile', label: f.mobile, type: 'tel', maxLength: CATALOG_LIMITS.phone },
    { name: 'fax', label: f.fax, type: 'tel', maxLength: CATALOG_LIMITS.phone },
    { name: 'website', label: f.website, type: 'url', maxLength: TEXT_LIMITS.supplierWebsite, placeholder: 'https://' },
    { name: 'address', label: f.address, maxLength: CATALOG_LIMITS.address },
    { name: 'neighborhood', label: f.neighborhood, maxLength: CATALOG_LIMITS.neighborhood },
    { name: 'city', label: f.city, maxLength: CATALOG_LIMITS.city },
    { name: 'state', label: f.state, maxLength: CATALOG_LIMITS.state },
    { name: 'postalCode', label: f.postalCode, maxLength: CATALOG_LIMITS.postalCode, inputMode: 'numeric' },
    { name: 'notes', label: f.notes, type: 'textarea', rows: 3, maxLength: CATALOG_LIMITS.notes },
    { name: 'isDefault', label: f.isDefault, type: 'checkboxes', options: [{ value: DEFAULT_OPTION, label: f.isDefaultOption }] },
  ]
  // The import owns an imported supplier's code: it is shown in the description instead.
  return imported ? fields.filter((field) => field.name !== 'code') : fields
}

/** Create a supplier, or edit one with all its contact fields. */
export function SupplierDialog({
  organizationId,
  supplier,
  t,
  onSaved,
  onClose,
}: {
  organizationId: string
  /** The supplier to edit; absent to create one. */
  supplier?: Supplier
  t: PricesMessages
  onSaved: (supplier: Supplier) => void
  onClose: () => void
}) {
  const [errorKind, setErrorKind] = useState<CatalogWriteErrorKind>('generic')
  const imported = supplier?.source === 'NEODATA_CONSTRUBASE'
  const fields = supplierFields(t, imported)

  const form = useForm({
    initialValues: supplierFormValues(supplier),
    schema: makeSupplierSchema(t.validation),
    onSubmit: async (values) => {
      try {
        const saved = supplier
          ? await updateSupplier(organizationId, supplier.id, supplierPatchBody(values, supplier))
          : await createSupplier(organizationId, supplierCreateBody(values))
        onSaved(saved)
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

  const description = imported && supplier?.code ? formatMessage(t.suppliers.importedCode, { code: supplier.code }) : undefined

  return (
    <Modal title={supplier ? t.suppliers.editTitle : t.suppliers.createTitle} description={description} onClose={onClose}>
      <Form
        controller={form}
        fields={fields}
        className="prices-dialog-form"
        submitLabel={supplier ? t.common.save : t.common.create}
        pendingLabel={supplier ? t.common.saving : t.common.creating}
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
