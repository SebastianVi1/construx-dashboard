import { useState } from 'react'
import { Form, TEXT_LIMITS, useForm, type FieldConfig } from '../../components/form'
import { formatMessage, useLocale } from '../../i18n'
import { roleLabel } from '../permissions'
import type { Site } from '../sites/sitesApi'
import { sendInvitation } from './inviteSave'
import {
  invitableRoles,
  inviteErrorKind,
  makeInviteSchema,
  type Invitation,
  type InviteErrorKind,
} from './membersApi'
import type { RoleSummary } from '../roles/rolesApi'

type InviteFormProps = {
  organizationId: string
  roles: RoleSummary[]
  /** Sites the invitation may grant; null hides the site field (no MANAGE_PROJECT). */
  sites: Site[] | null
  onInvited: (invitation: Invitation, message: string) => void
}

/** Invite by email and role, optionally onto a site. Remount (new `key`) to clear it. */
export function InviteForm({ organizationId, roles, sites, onInvited }: InviteFormProps) {
  const { messages: m, locale } = useLocale()
  const t = m.members
  const [errorKind, setErrorKind] = useState<InviteErrorKind>('generic')

  const form = useForm({
    initialValues: { email: '', roleCode: '', projectId: '' },
    schema: makeInviteSchema(t.validation),
    onSubmit: async (values) => {
      try {
        const invitation = await sendInvitation(organizationId, values)
        onInvited(invitation, formatMessage(t.invite.sent, { email: invitation.email }))
      } catch (error) {
        setErrorKind(inviteErrorKind(error))
        throw error
      }
    },
    onInvalid: (errors) => {
      const first = ['email', 'roleCode'].find((name) => errors[name])
      if (first) document.getElementById(`field-${first}`)?.focus()
    },
  })

  const fields: FieldConfig[] = [
    {
      name: 'email',
      label: t.invite.email,
      type: 'email',
      placeholder: t.invite.emailPlaceholder,
      autoComplete: 'off',
      maxLength: TEXT_LIMITS.email,
      inputMode: 'email',
      spellCheck: false,
    },
    {
      name: 'roleCode',
      label: t.invite.role,
      type: 'select',
      options: [
        { value: '', label: t.invite.rolePlaceholder },
        ...invitableRoles(roles).map((role) => ({ value: role.code, label: roleLabel(role, locale) })),
      ],
    },
  ]
  if (sites) {
    fields.push({
      name: 'projectId',
      label: t.invite.site,
      type: 'select',
      hint: t.invite.siteHint,
      options: [{ value: '', label: t.invite.siteNone }, ...sites.map((site) => ({ value: site.id, label: site.name }))],
    })
  }

  return (
    <Form controller={form} fields={fields} submitLabel={t.invite.submit} pendingLabel={t.invite.pending}>
      {form.submitError ? (
        <p className="form-error" role="alert">
          {t.error[errorKind]}
        </p>
      ) : null}
    </Form>
  )
}
