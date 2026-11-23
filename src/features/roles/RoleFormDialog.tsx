import { useState } from 'react'
import { useNavigate } from 'react-router'
import { z } from 'zod'
import { Form, useForm, type FieldConfig } from '../../components/form'
import { Modal } from '../../components/modal'
import { formatMessage, useLocale } from '../../i18n'
import { TEXT_LIMITS } from '../../components/form/limits'
import { writeSessionValue } from '../../lib/sessionCache'
import { roleLabel } from '../permissions'
import { copyName } from './customRoles'
import { createRole, getRole, type RoleSummary } from './rolesApi'
import { roleKey, rolesChanged, summaryOf, withRole } from './rolesCache'
import { roleErrorMessage } from './roleView'

type Props = {
  organizationId: string
  /** The role to copy; absent for a blank "New role". */
  source?: RoleSummary
  onClose: () => void
}

/**
 * "New role" and "Duplicate" (roles contract §5.3, §8.2): a name and an
 * optional description. Submitting creates the role right away: a blank role
 * with no permissions, a copy with the source's current permissions. The new
 * role's page opens next, where the Permissions editor finishes the job.
 */
export function RoleFormDialog({ organizationId, source, onClose }: Props) {
  const { messages: m, locale } = useLocale()
  const t = m.roles.create
  const d = m.roles.details
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const sourceName = source ? roleLabel(source, locale) : null

  const form = useForm({
    initialValues: { name: sourceName ? copyName(sourceName, t.copySuffix) : '', description: '' },
    schema: z.object({
      name: z.string().trim().min(1, d.required).max(TEXT_LIMITS.roleName, d.nameTooLong),
      description: z.string().trim().max(TEXT_LIMITS.roleDescription, d.descriptionTooLong),
    }),
    onSubmit: async (values) => {
      setError(null)
      try {
        // The source is read again so the copy holds its permissions as they are now.
        const permissions = source ? (await getRole(organizationId, source.code)).permissions : []
        const created = await createRole(organizationId, { name: values.name, description: values.description, permissions })
        writeSessionValue(roleKey(organizationId, created.code), created)
        rolesChanged(organizationId, (roles) => withRole(roles, summaryOf(created)))
        navigate(`/members/roles/${encodeURIComponent(created.code)}`)
      } catch (failure) {
        setError(roleErrorMessage(failure, m, null, locale))
        throw failure
      }
    },
    onInvalid: (errors) => {
      const first = ['name', 'description'].find((name) => errors[name])
      if (first) document.getElementById(`field-${first}`)?.focus()
    },
  })

  const fields: FieldConfig[] = [
    { name: 'name', label: d.name, autoComplete: 'off', maxLength: TEXT_LIMITS.roleName },
    { name: 'description', label: d.description, type: 'textarea', hint: d.descriptionHint, rows: 3, maxLength: TEXT_LIMITS.roleDescription },
  ]

  return (
    <Modal
      title={sourceName ? formatMessage(t.duplicateTitle, { role: sourceName }) : t.title}
      description={source ? t.duplicateDescription : t.description}
      onClose={onClose}
    >
      <Form
        controller={form}
        fields={fields}
        submitLabel={t.submit}
        pendingLabel={t.pending}
        actionsClassName="button-row button-row--end modal-actions"
        submitClassName="button button--primary"
        beforeSubmit={
          <button type="button" className="button" onClick={onClose} disabled={form.isSubmitting}>
            {t.cancel}
          </button>
        }
      >
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
      </Form>
    </Modal>
  )
}
