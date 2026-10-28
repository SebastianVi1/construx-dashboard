import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Form, useForm } from '../../components/form'
import { Modal } from '../../components/modal'
import { useLocale } from '../../i18n'
import { materialFields } from './materialDisplay'
import { makeMaterialSchema } from './materialForm'
import { createMaterial, pricingErrorKind, type MaterialCategory, type MaterialUnit, type PricingErrorKind } from './pricingApi'

/** "Add material" dialog. On success it opens the material so a first price can be recorded. */
export function CreateMaterialDialog({ organizationId, onClose }: { organizationId: string; onClose: () => void }) {
  const { messages: m } = useLocale()
  const t = m.materials
  const navigate = useNavigate()
  const [errorKind, setErrorKind] = useState<PricingErrorKind>('generic')

  const form = useForm({
    initialValues: { name: '', unit: '', category: '', brand: '' },
    schema: makeMaterialSchema(t.validation),
    onSubmit: async (values) => {
      try {
        const material = await createMaterial(organizationId, {
          name: values.name,
          unit: values.unit as MaterialUnit,
          category: values.category as MaterialCategory,
          brand: values.brand,
        })
        navigate(`/materials/${encodeURIComponent(material.id)}`)
      } catch (error) {
        setErrorKind(pricingErrorKind(error))
        throw error
      }
    },
    onInvalid: (errors) => {
      const first = ['name', 'unit', 'category', 'brand'].find((name) => errors[name])
      if (first) document.getElementById(`field-${first}`)?.focus()
    },
  })

  return (
    <Modal title={t.create.title} description={t.create.description} onClose={onClose}>
      <Form controller={form} fields={materialFields(t)} submitLabel={t.create.submit} pendingLabel={t.create.pending}>
        {form.submitError ? (
          <p className="form-error" role="alert">
            {t.error[errorKind]}
          </p>
        ) : null}
      </Form>
      <div className="button-row button-row--end modal-actions">
        <button type="button" className="button" onClick={onClose}>
          {t.create.cancel}
        </button>
      </div>
    </Modal>
  )
}
