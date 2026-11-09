import { useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { AVATAR_TYPES, avatarErrorKind, avatarFileProblem, removeAvatar, uploadAvatar, type AvatarErrorKind, type Profile } from './profileApi'
import { publishProfile } from './useMyProfile'

/** Change or remove the profile photo; the bytes go straight to storage through a presigned URL. */
export function AvatarPicker({ profile }: { profile: Profile }) {
  const { messages: m } = useLocale()
  const t = m.profile.photo
  const input = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<'idle' | 'uploading' | 'removing'>('idle')
  const [error, setError] = useState<AvatarErrorKind | null>(null)
  const busy = state !== 'idle'

  async function choose(file: File | undefined) {
    if (!file) return
    const problem = avatarFileProblem(file)
    if (problem) {
      setError(problem)
      return
    }
    setError(null)
    setState('uploading')
    try {
      publishProfile(await uploadAvatar(file))
    } catch (caught) {
      setError(avatarErrorKind(caught))
    } finally {
      setState('idle')
    }
  }

  async function remove() {
    setError(null)
    setState('removing')
    try {
      await removeAvatar()
      publishProfile({ ...profile, avatarUrl: null })
    } catch (caught) {
      setError(avatarErrorKind(caught))
    } finally {
      setState('idle')
    }
  }

  return (
    <div className="avatar-picker">
      <input
        ref={input}
        className="avatar-picker__input"
        type="file"
        accept={AVATAR_TYPES.join(',')}
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          void choose(file)
        }}
      />
      <div className="avatar-picker__actions">
        <button type="button" className="button button--small" disabled={busy} onClick={() => input.current?.click()}>
          {state === 'uploading' ? t.uploading : profile.avatarUrl ? t.change : t.add}
        </button>
        {profile.avatarUrl ? (
          <button type="button" className="button button--small" disabled={busy} onClick={() => void remove()}>
            {state === 'removing' ? t.removing : t.remove}
          </button>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="form-error avatar-picker__error">
          {t.errors[error]}
        </p>
      ) : (
        <p className="avatar-picker__hint">{t.hint}</p>
      )}
    </div>
  )
}
