import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Form, useForm, type FieldConfig } from '../../components/form'
import { useLocale } from '../../i18n'
import { AuthLayout } from '../auth/AuthLayout'
import { useOrganizations } from './organizations-context'
import { createOrganization } from './organizationsApi'
import { createErrorKind, makeOrganizationSchema, type CreateErrorKind } from './schemas'

/** Found a company with `POST /api/organizations`; the creator becomes its owner. */
export function CreateOrganizationPage() {
  const { messages: m } = useLocale()
  const t = m.organizations.create
  const { add } = useOrganizations()
  const navigate = useNavigate()
  const [errorKind, setErrorKind] = useState<CreateErrorKind>('generic')

  useEffect(() => {
    document.title = `${t.title} | Construx`
  }, [t.title])

  const form = useForm({
    initialValues: { name: '' },
    schema: makeOrganizationSchema(m.organizations.validation),
    onSubmit: async ({ name }) => {
      try {
        add(await createOrganization(name))
      } catch (error) {
        setErrorKind(createErrorKind(error))
        throw error
      }
      navigate('/sites', { replace: true })
    },
    onInvalid: () => document.getElementById('field-name')?.focus(),
  })

  const fields: FieldConfig[] = [
    {
      name: 'name',
      label: t.nameLabel,
      placeholder: t.namePlaceholder,
      autoComplete: 'organization',
      hint: t.nameHint,
    },
  ]

  return (
    <AuthLayout title={t.title} description={t.description}>
      <Form controller={form} fields={fields} submitLabel={t.submit} pendingLabel={t.pending}>
        {form.submitError ? (
          <p className="form-error" role="alert">
            {m.organizations.error[errorKind]}
          </p>
        ) : null}
      </Form>
      <p className="auth-switch">
        <Link to="/account">{t.back}</Link>
      </p>
    </AuthLayout>
  )
}
