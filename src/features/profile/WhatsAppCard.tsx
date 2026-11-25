import { useEffect, useEffectEvent, useState } from 'react'
import { encode } from 'uqr'
import { useRemoteData } from '../../components/data/useRemoteData'
import { Notice, SkeletonBlock, SkeletonRegion } from '../../components/page'
import { formatDateTime, formatMessage, useLocale } from '../../i18n'
import { locales } from '../../i18n/locale'
import { GuideHelpButton } from '../guide'
import {
  changeWhatsAppLanguage,
  createLinkCode,
  getWhatsAppStatus,
  unlinkWhatsApp,
  whatsappErrorKind,
  type LinkCode,
  type WhatsAppErrorKind,
  type WhatsAppLanguage,
  type WhatsAppStatus,
} from './whatsappApi'
import {
  checkWhatsAppLink,
  formatCountdown,
  LINK_POLL_MS,
  linkProgress,
  maskNumber,
  qrPath,
  secondsLeft,
} from './whatsappLink'

const unlinkedStatus = (status: WhatsAppStatus): WhatsAppStatus => ({
  ...status,
  linked: false,
  number: null,
  language: null,
  linkedAt: null,
})

/**
 * The profile's WhatsApp card. Not linked: "Link WhatsApp" shows a one-time code, its countdown, an
 * "Open WhatsApp" link and a QR of it, and polls every 3 seconds until linked or expired. Linked: the
 * masked number, the bot language and Unlink.
 */
export function WhatsAppCard({ organizationId }: { organizationId: string }) {
  const { messages: m, locale } = useLocale()
  const t = m.profile.whatsapp
  const status = useRemoteData('profile:whatsapp', getWhatsAppStatus, { remember: false })
  const [code, setCode] = useState<LinkCode | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [busy, setBusy] = useState<'code' | 'language' | 'unlink' | null>(null)
  const [error, setError] = useState<WhatsAppErrorKind | null>(null)
  const [confirming, setConfirming] = useState(false)
  const update = status.update
  const progress = code && status.data ? linkProgress(status.data, code.expiresAt, now) : null

  // The card re-renders every second for the countdown; the poll reads the latest state through this event.
  const polled = useEffectEvent((next: WhatsAppStatus) => {
    update(() => next)
    if (next.linked) setCode(null)
  })

  useEffect(() => {
    if (progress !== 'waiting') return
    const tick = setInterval(() => setNow(Date.now()), 1000)
    const poll = setInterval(() => {
      checkWhatsAppLink(organizationId)
        .then((next) => polled(next))
        .catch(() => {})
    }, LINK_POLL_MS)
    return () => {
      clearInterval(tick)
      clearInterval(poll)
    }
  }, [progress, organizationId])

  function run<T>(kind: 'code' | 'language' | 'unlink', action: () => Promise<T>, done: (result: T) => void) {
    setBusy(kind)
    setError(null)
    action()
      .then(done)
      .catch((failure: unknown) => {
        const reason = whatsappErrorKind(failure)
        if (reason === 'notLinked') update(unlinkedStatus)
        setError(reason)
      })
      .finally(() => setBusy(null))
  }

  function startLinking() {
    run('code', () => createLinkCode(locale), (created) => {
      setNow(Date.now())
      setCode(created)
    })
  }

  function changeLanguage(language: WhatsAppLanguage) {
    run('language', () => changeWhatsAppLanguage(language), (next) => update(() => next))
  }

  function unlink() {
    run('unlink', unlinkWhatsApp, () => {
      setConfirming(false)
      update(unlinkedStatus)
    })
  }

  return (
    <section className="page-section" aria-labelledby="profile-whatsapp">
      <div className="page-section__header">
        <div>
          <h2 id="profile-whatsapp">{t.title}</h2>
          <p>{t.description}</p>
        </div>
        <GuideHelpButton page="profile" />
      </div>
      {status.status === 'error' && !status.data ? (
        <Notice tone="error" action={{ label: m.workspace.retry, onClick: status.reload }}>
          {t.loadError}
        </Notice>
      ) : !status.data ? (
        <SkeletonRegion>
          <div className="security-card" aria-hidden="true">
            <SkeletonBlock width={40} height={40} />
            <div className="security-card__body">
              <SkeletonBlock width={160} height={20} />
              <SkeletonBlock width="70%" />
            </div>
          </div>
        </SkeletonRegion>
      ) : (
        <div className="security-card whatsapp-card" data-tour="whatsapp-link">
          <div className="security-card__icon" aria-hidden="true">
            <ChatIcon />
          </div>
          <div className="security-card__body">
            {status.data.linked ? (
              <>
                <h3 className="security-card__title">{t.linkedTo}</h3>
                <p className="whatsapp-card__number">{maskNumber(status.data.number ?? '')}</p>
                {status.data.linkedAt ? (
                  <p className="security-card__description">
                    {formatMessage(t.linkedAt, { date: formatDateTime(status.data.linkedAt, locale) })}
                  </p>
                ) : null}
                <label className="whatsapp-card__language">
                  <span>{t.language}</span>
                  <select
                    value={status.data.language ?? locale}
                    disabled={busy !== null}
                    onChange={(event) => changeLanguage(event.target.value as WhatsAppLanguage)}
                  >
                    {locales.map((language) => (
                      <option key={language} value={language}>{t.languages[language]}</option>
                    ))}
                  </select>
                </label>
                {confirming ? (
                  <div className="whatsapp-card__confirm" role="group" aria-label={t.unlink}>
                    <p>{t.confirmUnlink}</p>
                    <div className="button-row whatsapp-card__actions">
                      <button type="button" className="button button--danger" disabled={busy !== null} onClick={unlink}>
                        {busy === 'unlink' ? t.unlinking : t.confirmUnlinkAction}
                      </button>
                      <button type="button" className="button" disabled={busy !== null} onClick={() => setConfirming(false)}>
                        {t.keep}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button type="button" className="button security-card__action" disabled={busy !== null}
                    onClick={() => setConfirming(true)}>
                    {t.unlink}
                  </button>
                )}
                <p className="whatsapp-card__hint">{t.stopHint}</p>
              </>
            ) : code && progress ? (
              <LinkCodePanel
                code={code}
                expired={progress === 'expired'}
                seconds={secondsLeft(code.expiresAt, now)}
                busy={busy === 'code'}
                onNewCode={startLinking}
                onCancel={() => setCode(null)}
              />
            ) : (
              <>
                <h3 className="security-card__title">{t.notLinked}</h3>
                <button type="button" className="button button--primary security-card__action"
                  disabled={busy !== null} aria-busy={busy === 'code'} onClick={startLinking}>
                  {busy === 'code' ? t.linking : t.link}
                </button>
              </>
            )}
            {error ? <p role="alert" className="form-error security-card__error">{t.errors[error]}</p> : null}
          </div>
        </div>
      )}
    </section>
  )
}

function LinkCodePanel({ code, expired, seconds, busy, onNewCode, onCancel }: {
  code: LinkCode
  expired: boolean
  seconds: number
  busy: boolean
  onNewCode: () => void
  onCancel: () => void
}) {
  const { messages: m } = useLocale()
  const t = m.profile.whatsapp
  if (expired) {
    return (
      <>
        <p className="security-card__title" role="status">{t.expired}</p>
        <div className="button-row whatsapp-card__actions">
          <button type="button" className="button button--primary" disabled={busy} onClick={onNewCode}>
            {busy ? t.linking : t.newCode}
          </button>
          <button type="button" className="button" onClick={onCancel}>{t.cancel}</button>
        </div>
      </>
    )
  }
  const qr = encode(code.waMeUrl, { border: 1 })
  return (
    <div className="whatsapp-card__code">
      <div className="whatsapp-card__code-main">
        <p className="security-card__description">
          {code.construxNumber ? formatMessage(t.sendCode, { number: code.construxNumber }) : t.sendCodeNoNumber}
        </p>
        <p className="whatsapp-card__value">{code.code}</p>
        <p className="whatsapp-card__countdown">
          {formatMessage(t.expiresIn, { time: formatCountdown(seconds) })}
          <span aria-live="polite"> · {t.waiting}</span>
        </p>
        <div className="button-row whatsapp-card__actions">
          <a className="button button--primary" href={code.waMeUrl} target="_blank" rel="noreferrer">
            {t.open}
          </a>
          <button type="button" className="button" onClick={onCancel}>{t.cancel}</button>
        </div>
      </div>
      <figure className="whatsapp-card__qr">
        <svg viewBox={`0 0 ${qr.size} ${qr.size}`} role="img" aria-label={t.qrLabel} shapeRendering="crispEdges">
          <rect className="whatsapp-card__qr-light" width={qr.size} height={qr.size} />
          <path className="whatsapp-card__qr-dark" d={qrPath(qr.data)} />
        </svg>
        <figcaption>{t.qr}</figcaption>
      </figure>
    </div>
  )
}

function ChatIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 2.75a7.25 7.25 0 0 0-6.3 10.83L2.75 17.25l3.77-.93A7.25 7.25 0 1 0 10 2.75Z"
        stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M7.25 8.25h5.5M7.25 11.25h3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}
