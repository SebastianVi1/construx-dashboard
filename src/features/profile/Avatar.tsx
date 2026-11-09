import { useState } from 'react'
import { formatMessage, useLocale } from '../../i18n'
import { displayName, initials } from './profileDisplay'

/**
 * Profile photo, or initials on a blueprint tile; decorative when a visible name sits beside it.
 * Without an email (people lists that never carry one) an unnamed person shows "?".
 */
export function Avatar({
  fullName,
  email = '?',
  avatarUrl = null,
  size = 'small',
  decorative = false,
}: {
  fullName: string | null
  email?: string
  avatarUrl?: string | null
  size?: 'small' | 'large'
  decorative?: boolean
}) {
  const { messages: m } = useLocale()
  const label = formatMessage(m.profile.avatarLabel, { name: displayName(fullName, email) })
  // An expired or broken URL falls back to initials instead of a broken image.
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const photo = avatarUrl && avatarUrl !== failedUrl ? avatarUrl : null

  return (
    <span
      className="avatar"
      data-size={size}
      data-photo={photo ? true : undefined}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative ? true : undefined}
    >
      {photo ? (
        <img className="avatar__photo" src={photo} alt="" onError={() => setFailedUrl(photo)} />
      ) : (
        initials(fullName, email)
      )}
    </span>
  )
}
