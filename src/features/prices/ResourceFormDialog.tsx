import { useState } from 'react'
import { useRemoteData } from '../../components/data/useRemoteData'
import { Form, useForm, type FieldConfig, type FieldOption } from '../../components/form'
import { Modal } from '../../components/modal'
import { Notice, SkeletonForm } from '../../components/page'
import { useCurrency, type Currency } from '../../currency'
import { formatMessage, useLocale, type Messages } from '../../i18n'
import {
  createResource,
  listFamilies,
  listSuppliers,
  listUnits,
  updateResource,
  type Family,
  type ResourceDetail,
  type ResourceType,
  type Supplier,
  type Unit,
} from './pricesApi'
import { RealWagePreview } from './LaborWageDialog'
import {
  RESOURCE_LIMITS,
  createLaborBody,
  createResourceBody,
  emptyLaborValues,
  emptyResourceValues,
  laborFields,
  makeLaborSchema,
  makeResourceSchema,
  resourcePatchBody,
  resourceValuesFrom,
  resourceWriteErrorKind,
  type ResourceWriteErrorKind,
} from './resourceForm'

type WriteMessages = Messages['prices']['write']

type ResourceFormDialogProps = {
  organizationId: string
  /** Create a new simple Material, Equipment rate or Labor category, or edit `resource` (any type). */
  type: CreatableType
  resource?: ResourceDetail
  onSaved: (detail: ResourceDetail) => void
  onClose: () => void
}

export type CreatableType = 'MATERIAL' | 'EQUIPMENT' | 'LABOR'

type Pickers = { units: Unit[]; families: Family[]; suppliers: Supplier[] }

/** Keeps the current choice listed even when it was archived since, so editing other fields does not lose it. */
function withCurrent(options: FieldOption[], current: { id: string; label: string } | null): FieldOption[] {
  if (!current || options.some((option) => option.value === current.id)) return options
  return [...options, { value: current.id, label: current.label }]
}

function resourceFields(
  w: WriteMessages,
  pickers: Pickers,
  { type, resource, currency }: { type: ResourceType; resource?: ResourceDetail; currency: Currency },
): FieldConfig[] {
  const fields: FieldConfig[] = []
  if (!resource) {
    fields.push({
      name: 'code',
      label: w.field.code,
      placeholder: w.field.codePlaceholder,
      hint: w.field.codeHint,
      autoComplete: 'off',
      spellCheck: false,
      maxLength: RESOURCE_LIMITS.code,
    })
  }
  fields.push(
    { name: 'name', label: w.field.name, placeholder: w.field.namePlaceholder, autoComplete: 'off', maxLength: RESOURCE_LIMITS.name },
    {
      name: 'unitId',
      label: w.field.unit,
      type: 'select',
      options: withCurrent(
        [
          { value: '', label: w.field.unitPlaceholder },
          ...pickers.units.map((unit) => ({ value: unit.id, label: unit.description ? `${unit.code} · ${unit.description}` : unit.code })),
        ],
        resource ? { id: resource.unit.id, label: resource.unit.code } : null,
      ),
    },
    {
      name: 'familyId',
      label: w.field.family,
      type: 'select',
      options: withCurrent(
        [
          { value: '', label: w.field.none },
          ...pickers.families.map((family) => ({ value: family.id, label: `${family.code} · ${family.name}` })),
        ],
        resource?.family ? { id: resource.family.id, label: `${resource.family.code} · ${resource.family.name}` } : null,
      ),
    },
    {
      name: 'supplierId',
      label: w.field.supplier,
      type: 'select',
      options: withCurrent(
        [
          { value: '', label: w.field.none },
          ...pickers.suppliers.map((supplier) => ({
            value: supplier.id,
            label: supplier.branch ? `${supplier.name} · ${supplier.branch}` : supplier.name,
          })),
        ],
        resource?.supplier ? { id: resource.supplier.id, label: resource.supplier.name } : null,
      ),
    },
  )
  if (type === 'MATERIAL') {
    fields.push({ name: 'brand', label: w.field.brand, autoComplete: 'off', maxLength: RESOURCE_LIMITS.brand })
  }
  fields.push({ name: 'description', label: w.field.description, type: 'textarea', rows: 3 })
  if (!resource && type === 'LABOR') {
    fields.push(...laborFields(w, currency))
  } else if (!resource) {
    fields.push({ name: 'cost', label: formatMessage(w.field.cost, { currency }), type: 'money', placeholder: w.field.amountPlaceholder })
  }
  return fields
}

/** "Nuevo insumo" / "Nuevo equipo" / "Nueva categoría", or the edit form of an existing Resource (only changed fields are sent). */
export function ResourceFormDialog({ organizationId, type, resource, onSaved, onClose }: ResourceFormDialogProps) {
  const { messages: m } = useLocale()
  const w = m.prices.write
  const units = useRemoteData(`${organizationId}:units`, () => listUnits(organizationId))
  const families = useRemoteData(`${organizationId}:families`, () => listFamilies(organizationId))
  const suppliers = useRemoteData(`${organizationId}:suppliers`, () => listSuppliers(organizationId))

  const title = resource ? formatMessage(w.editTitle, { code: resource.code }) : w.createTitle[type]
  const description = resource ? w.editDescription : type === 'LABOR' ? w.createLaborDescription : w.createDescription
  const failed = [units, families, suppliers].find((data) => data.status === 'error')

  return (
    <Modal title={title} description={description} onClose={onClose}>
      {units.data && families.data && suppliers.data ? (
        !resource && units.data.length === 0 ? (
          <Notice>{w.noUnits}</Notice>
        ) : (
          <ResourceForm
            organizationId={organizationId}
            type={resource?.type ?? type}
            resource={resource}
            pickers={{ units: units.data, families: families.data, suppliers: suppliers.data }}
            onSaved={onSaved}
          />
        )
      ) : failed ? (
        <Notice
          tone="error"
          action={{
            label: m.prices.load.retry,
            onClick: () => [units, families, suppliers].forEach((data) => data.status === 'error' && data.reload()),
          }}
        >
          {w.pickersError}
        </Notice>
      ) : (
        <SkeletonForm fields={resource ? 6 : 8} />
      )}
      <div className="button-row button-row--end modal-actions">
        <button type="button" className="button" onClick={onClose}>
          {w.cancel}
        </button>
      </div>
    </Modal>
  )
}

type ResourceFormProps = {
  organizationId: string
  type: ResourceType
  resource?: ResourceDetail
  pickers: Pickers
  onSaved: (detail: ResourceDetail) => void
}

function ResourceForm({ organizationId, type, resource, pickers, onSaved }: ResourceFormProps) {
  const { messages: m } = useLocale()
  const w = m.prices.write
  const money = useCurrency()
  const [errorKind, setErrorKind] = useState<ResourceWriteErrorKind>('generic')
  const [unchanged, setUnchanged] = useState(false)

  // A new Labor category takes its wage instead of a cost.
  const laborCreate = !resource && type === 'LABOR'
  const schema = makeResourceSchema(w.validation, { withCost: !resource && !laborCreate, money })
  const form = useForm({
    initialValues: resource ? resourceValuesFrom(resource) : laborCreate ? { ...emptyResourceValues, ...emptyLaborValues } : emptyResourceValues,
    schema: laborCreate ? schema.extend(makeLaborSchema(w.validation, money).shape) : schema,
    onSubmit: async (values) => {
      try {
        if (resource) {
          const patch = resourcePatchBody(resource, values)
          if (Object.keys(patch).length === 0) {
            setUnchanged(true)
            return
          }
          onSaved(await updateResource(organizationId, resource.id, patch))
        } else if (laborCreate) {
          onSaved(await createResource(organizationId, createLaborBody(values, { ...emptyLaborValues, ...values }, money)))
        } else if (type === 'MATERIAL' || type === 'EQUIPMENT') {
          onSaved(await createResource(organizationId, createResourceBody(type, values, money)))
        }
      } catch (error) {
        setErrorKind(resourceWriteErrorKind(error))
        throw error
      }
    },
    onInvalid: (errors) => {
      const first = [
        'code',
        'name',
        'unitId',
        'familyId',
        'supplierId',
        'brand',
        'description',
        'cost',
        'nominalWage',
        'fsr',
        'perDiem',
        'mealsLodging',
        'funeralExpenses',
        'otherBenefits',
      ].find((name) => errors[name])
      if (first) document.getElementById(`field-${first}`)?.focus()
    },
  })

  return (
    <Form
      controller={{
        ...form,
        onChange: (name, value) => {
          setUnchanged(false)
          form.onChange(name, value)
        },
      }}
      fields={resourceFields(w, pickers, { type, resource, currency: money.currency })}
      submitLabel={resource ? w.save : w.create}
      pendingLabel={resource ? w.saving : w.creating}
    >
      {laborCreate ? <RealWagePreview values={{ ...emptyLaborValues, ...form.values }} w={w} /> : null}
      {form.submitError ? (
        <p className="form-error" role="alert">
          {w.error[errorKind]}
        </p>
      ) : unchanged ? (
        <Notice>{w.noChanges}</Notice>
      ) : null}
    </Form>
  )
}
