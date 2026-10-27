import { useState } from 'react'
import { Field, Form, useForm, type FieldConfig } from '../../components/form'
import { ConfirmDialog, Modal } from '../../components/modal'
import { useLocale } from '../../i18n'
import { formatPhone } from './phone'
import { PhoneField } from './PhoneField'
import { profileErrorKind, updateProfile, type Profile, type ProfileUpdate } from './profileApi'
import { buildProfileUpdate, makeProfileSchema, profileChanges, profileFormValues } from './profileForm'

type EditProfileDialogProps = {
  profile: Profile
  onSaved: (profile: Profile) => void
  onClose: () => void
}

/**
 * Edit the caller's name, phone and trade. A valid form first shows the changes
 * for confirmation; only confirming sends `PUT /api/profile`. Going back keeps
 * what was typed, because the form state lives here.
 */
export function EditProfileDialog({ profile, onSaved, onClose }: EditProfileDialogProps) {
  const { messages: m } = useLocale()
  const t = m.profile.edit
  const [pending, setPending] = useState<ProfileUpdate | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const form = useForm({
    initialValues: profileFormValues(profile),
    schema: makeProfileSchema(t.validation),
    onSubmit: async (values) => {
      const update = buildProfileUpdate(values)
      if (profileChanges(profile, update).length === 0) {
        onClose()
        return
      }
      setSaveError(null)
      setPending(update)
    },
    onInvalid: (errors) => {
      const first = ['fullName', 'phoneNumber', 'trade'].find((name) => errors[name])
      if (first) document.getElementById(`field-${first}`)?.focus()
    },
  })

  async function save(update: ProfileUpdate) {
    try {
      onSaved(await updateProfile(update))
    } catch (error) {
      setSaveError(t.error[profileErrorKind(error)])
    }
  }

  if (pending) {
    const labels = { fullName: m.profile.fullName, phoneNumber: m.profile.phone, trade: m.profile.trade }
    return (
      <ConfirmDialog
        title={t.confirm.title}
        body={t.confirm.body}
        confirmLabel={t.confirm.submit}
        pendingLabel={t.pending}
        cancelLabel={t.confirm.back}
        confirmTone="primary"
        error={saveError}
        onConfirm={() => save(pending)}
        onClose={() => setPending(null)}
      >
        <dl className="profile-changes">
          {profileChanges(profile, pending).map((change) => (
            <div key={change.field} className="profile-changes__row">
              <dt>{labels[change.field]}</dt>
              <dd>
                <span className="profile-changes__from" data-empty={change.from ? undefined : true}>
                  {readable(change.field, change.from) || m.profile.notSet}
                </span>
                <span aria-hidden="true">→</span>
                <span className="visually-hidden">{t.confirm.to}</span>
                <span data-empty={change.to ? undefined : true}>{readable(change.field, change.to) || m.profile.notSet}</span>
              </dd>
            </div>
          ))}
        </dl>
      </ConfirmDialog>
    )
  }

  const fields: FieldConfig[] = [{ name: 'fullName', label: m.profile.fullName, autoComplete: 'name' }]
  const trade: FieldConfig = { name: 'trade', label: m.profile.trade, placeholder: t.tradePlaceholder, hint: t.tradeHint }

  return (
    <Modal title={t.title} description={t.description} onClose={onClose}>
      <Form controller={form} fields={fields} submitLabel={t.submit}>
        <PhoneField
          name="phoneNumber"
          label={m.profile.phone}
          value={form.values.phoneNumber ?? ''}
          hint={t.phoneHint}
          error={form.errors.phoneNumber}
          valid={form.valid.phoneNumber}
          disabled={form.isSubmitting}
          onChange={(value) => form.onChange('phoneNumber', value)}
          onBlur={() => form.onBlur('phoneNumber')}
        />
        <Field
          config={trade}
          value={form.values.trade ?? ''}
          error={form.errors.trade}
          valid={form.valid.trade}
          disabled={form.isSubmitting}
          onChange={(value) => form.onChange('trade', value)}
          onBlur={() => form.onBlur('trade')}
        />
      </Form>
      <div className="button-row button-row--end modal-actions">
        <button type="button" className="button" onClick={onClose}>
          {t.cancel}
        </button>
      </div>
    </Modal>
  )
}

function readable(field: string, value: string): string {
  return field === 'phoneNumber' ? (formatPhone(value) ?? '') : value
}
