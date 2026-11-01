import { z } from 'zod'
import { Form, useForm, type FieldConfig } from '../../components/form'
import { Modal } from '../../components/modal'
import { useLocale } from '../../i18n'

/** Uses the shared form boundary for folder edits, moves and site selection. */
export function PlanLibraryForm({ title, fields, initialValues, onSave, onClose, nameRequired = false }: {
  title: string
  fields: FieldConfig[]
  initialValues: Record<string, string>
  onSave: (values: Record<string, string>) => Promise<void>
  onClose: () => void
  nameRequired?: boolean
}) {
  const { messages: m } = useLocale()
  const t = m.plans.library
  const schema = z.record(z.string(), z.string()).superRefine((values, ctx) => {
    if (nameRequired && (!values.name?.trim() || values.name.trim().length > 120)) {
      ctx.addIssue({ code: 'custom', path: ['name'], message: t.invalidName })
    }
  })
  const form = useForm({ initialValues, schema, onSubmit: onSave })
  return <Modal title={title} onClose={form.isSubmitting ? () => {} : onClose}>
    <Form controller={form} fields={fields} submitLabel={t.save} pendingLabel={t.saving}>
      {form.submitError ? <p className="form-error" role="alert">{t.failed}</p> : null}
      <button className="button" type="button" disabled={form.isSubmitting} onClick={onClose}>{m.plans.dialog.cancel}</button>
    </Form>
  </Modal>
}
