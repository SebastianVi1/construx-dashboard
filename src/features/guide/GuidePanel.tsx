import { useId } from 'react'
import { CheckIcon } from '../../components/icons'
import { Modal } from '../../components/modal'
import { formatMessage, useLocale } from '../../i18n'
import type { GuideStepEntry } from './catalog'
import { useGuide } from './guide-context'
import { GuideShowMe } from './GuideShowMe'
import { stepStatus, type GuideSection } from './selection'
import './guide.css'

/** The checklist: one heading per section, a row per step, the counter and "Hide guide". */
export function GuidePanel() {
  const { sections, count, dismissed, close, hide, show } = useGuide()
  const { messages: m } = useLocale()
  const t = m.guide

  return (
    <Modal variant="dock" title={t.title} description={t.description} onClose={close} closeLabel={t.close}>
      <div className="guide-panel">
        <div className="guide-meter">
          <p className="guide-meter__label">{formatMessage(t.progress, { done: count.done, total: count.total })}</p>
          <ol className="guide-meter__track" aria-hidden="true">
            {Array.from({ length: count.total }, (_, index) => (
              <li key={index} className="guide-meter__tick" data-done={index < count.done} />
            ))}
          </ol>
        </div>

        {count.complete ? (
          <div className="guide-complete" role="status">
            <CheckIcon className="guide-complete__icon" />
            <div>
              <p className="guide-complete__title">{t.complete.title}</p>
              <p className="guide-complete__body">{t.complete.body}</p>
            </div>
          </div>
        ) : null}

        {sections.map((section) => (
          <GuideSectionList key={section.id} section={section} nextId={count.next?.id ?? null} />
        ))}

        <div className="guide-panel__footer">
          {dismissed ? (
            <button type="button" className="guide-panel__link" onClick={show}>
              {t.show}
            </button>
          ) : (
            <>
              <button type="button" className="guide-panel__link" onClick={hide}>
                {t.hide}
              </button>
              <p className="guide-panel__hint">{t.hideHint}</p>
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}

function GuideSectionList({ section, nextId }: { section: GuideSection; nextId: string | null }) {
  const { messages: m } = useLocale()
  const headingId = useId()

  return (
    <section className="guide-section" aria-labelledby={headingId}>
      <h3 id={headingId} className="guide-section__title">
        {m.guide.sections[section.titleKey]}
      </h3>
      <ol className="guide-steps">
        {section.steps.map((step) => (
          <GuideStepRow key={step.id} step={step} isNext={step.id === nextId} />
        ))}
      </ol>
    </section>
  )
}

function GuideStepRow({ step, isNext }: { step: GuideStepEntry; isNext: boolean }) {
  const { progress, skip } = useGuide()
  const { messages: m } = useLocale()
  const t = m.guide
  const text = t.steps[step.textKey]
  const status = stepStatus(progress, step.id)

  return (
    <li className="guide-step" data-status={status?.toLowerCase() ?? 'open'} data-next={isNext || undefined}>
      <span className="guide-step__mark" aria-hidden="true">
        {status === 'COMPLETED' ? <CheckIcon width="14" height="14" strokeWidth="2.5" /> : null}
      </span>
      <div className="guide-step__text">
        <p className="guide-step__title">{text.title}</p>
        {status === null ? (
          <p className="guide-step__body">{text.body}</p>
        ) : (
          <p className="guide-step__state">{status === 'COMPLETED' ? t.done : t.skipped}</p>
        )}
        <GuideShowMe step={step} done={status !== null} />
      </div>
      {status === null ? (
        <button
          type="button"
          className="button button--small guide-step__skip"
          aria-label={formatMessage(t.skipLabel, { step: text.title })}
          onClick={() => skip(step.id)}
        >
          {t.skip}
        </button>
      ) : null}
    </li>
  )
}
