import { formatMessage, useLocale } from '../../i18n'
import { displayName, initials } from './profileDisplay'

/** Initials on a blueprint tile; decorative when a visible name sits beside it. */
export function Avatar({
  fullName,
  email,
  size = 'small',
  decorative = false,
}: {
  fullName: string | null
  email: string
  size?: 'small' | 'large'
  decorative?: boolean
}) {
  const { messages: m } = useLocale()
  const label = formatMessage(m.profile.avatarLabel, { name: displayName(fullName, email) })

  return (
    <span
      className="avatar"
      data-size={size}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative ? true : undefined}
    >
      {initials(fullName, email)}
    </span>
  )
}
