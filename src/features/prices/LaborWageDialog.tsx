import { useState } from 'react'
import { Form, useForm } from '../../components/form'
import { Modal } from '../../components/modal'
import { Notice } from '../../components/page'
import { useCurrency } from '../../currency'
import { formatMessage, useLocale, type Messages } from '../../i18n'
import { updateResource, type ResourceDetail } from './pricesApi'
import {
  benefitFields,
  emptyLaborValues,
  laborFields,
  laborPatchBody,
  laborValuesFrom,
  makeLaborSchema,
  realWagePreview,
  resourceWriteErrorKind,
  type LaborValues,
  type ResourceWriteErrorKind,
} from './resourceForm'

type WriteMessages = Messages['prices']['write']

/** "Real wage: $605.50" while the wage and FSR are typed, in the picked currency. */
export function RealWagePreview({ values, w }: { values: LaborValues; w: WriteMessages }) {
  const { money, toMxn } = useCurrency()
  const preview = realWagePreview(values)
  if (preview === null) return null
  const amount = money(toMxn(Number(preview)))
  return <p className="cell-muted">{formatMessage(w.realWagePreview, { amount })}</p>
}

type LaborWageDialogProps = {
  organizationId: string
  resource: ResourceDetail
  onSaved: (detail: ResourceDetail) => void
  onClose: () => void
}

/**
 * "Cambiar salario": edits the nominal wage, FSR and daily benefits of a simple Labor category. A new real wage
 * becomes a history entry and every analysis using it is recalculated by the server.
 */
export function LaborWageDialog({ organizationId, resource, onSaved, onClose }: LaborWageDialogProps) {
  const { messages: m } = useLocale()
  const w = m.prices.write
  const money = useCurrency()
  const [errorKind, setErrorKind] = useState<ResourceWriteErrorKind>('generic')
  const [unchanged, setUnchanged] = useState(false)
  const initial = laborValuesFrom(resource)
  // Stored amounts are pesos; show them in the picked currency so they read the same as the money fields.
  const shown: LaborValues =
    money.currency === 'MXN'
      ? initial
      : {
          ...initial,
          nominalWage: toShown(initial.nominalWage),
          perDiem: toShown(initial.perDiem),
          mealsLodging: toShown(initial.mealsLodging),
          funeralExpenses: toShown(initial.funeralExpenses),
          otherBenefits: toShown(initial.otherBenefits),
        }

  function toShown(pesos: string): string {
    return pesos === '' ? '' : money.fromMxn(Number(pesos)).toFixed(2)
  }

  const form = useForm({
    initialValues: shown,
    schema: makeLaborSchema(w.validation, money),
    onSubmit: async (values) => {
      try {
        const patch = laborPatchBody(resource, values, money, shown)
        if (Object.keys(patch).length === 0) {
          setUnchanged(true)
          return
        }
        onSaved(await updateResource(organizationId, resource.id, patch))
      } catch (error) {
        setErrorKind(resourceWriteErrorKind(error))
        throw error
      }
    },
    onInvalid: (errors) => {
      const first = ['nominalWage', 'fsr', ...benefitFields].find((name) => errors[name])
      if (first) document.getElementById(`field-${first}`)?.focus()
    },
  })

  return (
    <Modal title={formatMessage(w.wageTitle, { code: resource.code })} description={w.wageDescription} onClose={onClose}>
      <Form
        controller={{
          ...form,
          onChange: (name, value) => {
            setUnchanged(false)
            form.onChange(name, value)
          },
        }}
        fields={laborFields(w, money.currency)}
        submitLabel={w.save}
        pendingLabel={w.saving}
      >
        <RealWagePreview values={{ ...emptyLaborValues, ...form.values }} w={w} />
        {form.submitError ? (
          <p className="form-error" role="alert">
            {w.error[errorKind]}
          </p>
        ) : unchanged ? (
          <Notice>{w.noChanges}</Notice>
        ) : null}
      </Form>
      <div className="button-row button-row--end modal-actions">
        <button type="button" className="button" onClick={onClose}>
          {w.cancel}
        </button>
      </div>
    </Modal>
  )
}
