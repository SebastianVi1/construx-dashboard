import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Form, useForm } from '../../components/form'
import { Modal } from '../../components/modal'
import { useLocale } from '../../i18n'
import { makeSiteSchema, type SiteValues } from './siteForm'
import { siteFields } from './siteDisplay'
import { addSite } from './siteSave'
import { siteErrorKind, type SiteErrorKind } from './sitesApi'

const blankValues: SiteValues = { name: '', address: '', startDate: '', expectedEndDate: '', status: '' }

/**
 * "Add site" dialog. On success it opens the new site so people can be added next.
 * The guided tour opens it with example `initialValues` and hears about a failed
 * save through `onFailed`; "Add site" opens it blank.
 */
export function CreateSiteDialog({
  organizationId,
  onClose,
  initialValues = blankValues,
  onFailed,
}: {
  organizationId: string
  onClose: () => void
  initialValues?: SiteValues
  onFailed?: () => void
}) {
  const { messages: m } = useLocale()
  const t = m.sites
  const navigate = useNavigate()
  const [errorKind, setErrorKind] = useState<SiteErrorKind>('generic')

  const form = useForm({
    initialValues,
    schema: makeSiteSchema(t.validation),
    onSubmit: async (values) => {
      try {
        const site = await addSite(organizationId, values)
        navigate(`/sites/${encodeURIComponent(site.id)}`)
      } catch (error) {
        setErrorKind(siteErrorKind(error))
        onFailed?.()
        throw error
      }
    },
    onInvalid: (errors) => {
      const first = ['name', 'address', 'startDate', 'expectedEndDate'].find((name) => errors[name])
      if (first) document.getElementById(`field-${first}`)?.focus()
    },
  })

  return (
    <Modal title={t.create.title} description={t.create.description} onClose={onClose}>
      <Form
        controller={form}
        fields={siteFields(t, { statusDefault: true })}
        submitLabel={t.create.submit}
        pendingLabel={t.create.pending}
        submitTour="site-create-save"
      >
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
