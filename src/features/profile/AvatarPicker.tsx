import { useRef, useState } from 'react'
import { CameraIcon } from '../../components/icons'
import { Modal } from '../../components/modal'
import { useLocale } from '../../i18n'
import { Avatar } from './Avatar'
import { AVATAR_TYPES, avatarErrorKind, avatarFileProblem, removeAvatar, uploadAvatar, type AvatarErrorKind, type Profile } from './profileApi'
import { publishProfile } from './useMyProfile'

/** How long the portrait must be held before the photo opens enlarged instead of the file picker. */
const HOLD_MS = 450

/**
 * The profile portrait as its own button: picking a file compresses it and sends it straight to
 * storage through a presigned URL. A camera badge keeps the action visible on touch screens. Failures
 * go to `onError` so the page can show them at full width instead of squeezing them under the circle.
 * Holding the portrait (when there is a photo), or the View button, opens it enlarged in a modal.
 */
export function AvatarPicker({
  profile,
  email,
  onError,
}: {
  profile: Profile
  email: string
  onError: (error: AvatarErrorKind | null) => void
}) {
  const { messages: m } = useLocale()
  const t = m.profile.photo
  const input = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<'idle' | 'uploading' | 'removing'>('idle')
  const [previewing, setPreviewing] = useState(false)
  const holdTimer = useRef<number | null>(null)
  // Set when a hold opened the preview, so the click that ends the press does not open the picker.
  const held = useRef(false)
  const busy = state !== 'idle'
  const actionLabel = profile.avatarUrl ? t.change : t.add

  async function choose(file: File | undefined) {
    if (!file) return
    const problem = avatarFileProblem(file)
    if (problem) {
      onError(problem)
      return
    }
    onError(null)
    setState('uploading')
    try {
      publishProfile(await uploadAvatar(file))
    } catch (caught) {
      onError(avatarErrorKind(caught))
    } finally {
      setState('idle')
    }
  }

  function startHold() {
    held.current = false
    if (!profile.avatarUrl) return
    holdTimer.current = window.setTimeout(() => {
      holdTimer.current = null
      held.current = true
      setPreviewing(true)
    }, HOLD_MS)
  }

  function cancelHold() {
    if (holdTimer.current !== null) window.clearTimeout(holdTimer.current)
    holdTimer.current = null
  }

  async function remove() {
    onError(null)
    setState('removing')
    try {
      await removeAvatar()
      publishProfile({ ...profile, avatarUrl: null })
    } catch (caught) {
      onError(avatarErrorKind(caught))
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
      <button
        type="button"
        className="avatar-picker__portrait"
        data-busy={state === 'uploading' ? true : undefined}
        disabled={busy}
        aria-label={state === 'uploading' ? t.uploading : actionLabel}
        onPointerDown={startHold}
        onPointerUp={cancelHold}
        onPointerLeave={cancelHold}
        onPointerCancel={cancelHold}
        // A long press on touch would otherwise open the browser's image menu over the preview.
        onContextMenu={(event) => {
          if (profile.avatarUrl) event.preventDefault()
        }}
        onClick={() => {
          if (held.current) {
            held.current = false
            return
          }
          input.current?.click()
        }}
      >
        <Avatar fullName={profile.fullName} email={email} avatarUrl={profile.avatarUrl} size="large" decorative />
        <span className="avatar-picker__veil" aria-hidden>
          {state === 'uploading' ? (
            <span className="avatar-picker__spinner" />
          ) : (
            <>
              <CameraIcon className="avatar-picker__veil-icon" />
              <span>{actionLabel}</span>
            </>
          )}
        </span>
        <span className="avatar-picker__badge" aria-hidden>
          <CameraIcon />
        </span>
      </button>
      {profile.avatarUrl ? (
        <div className="avatar-picker__actions">
          {/* Holding the portrait is pointer-only; this keeps the preview reachable from the keyboard. */}
          <button type="button" className="button button--small" disabled={busy} onClick={() => setPreviewing(true)}>
            {t.view}
          </button>
          <button type="button" className="button button--small" disabled={busy} onClick={() => void remove()} aria-busy={state === 'removing'}>
            {state === 'removing' ? t.removing : t.remove}
          </button>
        </div>
      ) : null}
      {previewing && profile.avatarUrl ? (
        <Modal title={t.preview} onClose={() => setPreviewing(false)}>
          <img className="avatar-preview__photo" src={profile.avatarUrl} alt={t.preview} />
          <div className="button-row button-row--end modal-actions">
            <button type="button" className="button" onClick={() => setPreviewing(false)}>
              {t.close}
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  )
}
