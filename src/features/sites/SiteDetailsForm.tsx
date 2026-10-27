import { useState } from 'react'
import { Form, useForm } from '../../components/form'
import { Notice } from '../../components/page'
import { useLocale } from '../../i18n'
import { buildSitePatch, makeSiteSchema, siteToValues } from './siteForm'
import { siteFields } from './siteDisplay'
import { siteErrorKind, updateSite, type Site, type SiteErrorKind } from './sitesApi'

type SiteDetailsFormProps = {
  organizationId: string
  site: Site
  /** Called with the saved site. Remount the form (new `key`) to start from it. */
  onSaved: (site: Site) => void
}

/** Edit a site's details with PATCH; only changed fields are sent. */
export function SiteDetailsForm({ organizationId, site, onSaved }: SiteDetailsFormProps) {
  const { messages: m } = useLocale()
  const t = m.sites
  const [errorKind, setErrorKind] = useState<SiteErrorKind>('generic')
  const [unchanged, setUnchanged] = useState(false)

  const form = useForm({
    initialValues: siteToValues(site),
    schema: makeSiteSchema(t.validation, site),
    onSubmit: async (values) => {
      const patch = buildSitePatch(site, values)
      if (Object.keys(patch).length === 0) {
        setUnchanged(true)
        return
      }
      try {
        onSaved(await updateSite(organizationId, site.id, patch))
      } catch (error) {
        setErrorKind(siteErrorKind(error))
        throw error
      }
    },
    onInvalid: (errors) => {
      const first = ['name', 'address', 'startDate', 'expectedEndDate'].find((name) => errors[name])
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
      fields={siteFields(t, { statusDefault: false })}
      submitLabel={t.detail.save}
      pendingLabel={t.detail.saving}
    >
      {form.submitError ? (
        <p className="form-error" role="alert">
          {t.error[errorKind]}
        </p>
      ) : unchanged ? (
        <Notice>{t.detail.noChanges}</Notice>
      ) : null}
    </Form>
  )
}
