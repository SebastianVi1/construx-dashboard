import { useState } from 'react'
import { Modal } from './Modal'
import type { Question } from './question'

type QuestionModalProps = {
  question: Question
  submitLabel: string
  onSubmit: (optionId: string) => void
  onClose: () => void
  /** Optional second button next to submit, e.g. "Skip" for an optional question. */
  secondaryAction?: { label: string; onClick: () => void }
  /** Disables the controls while the caller saves the answer. */
  busy?: boolean
  /** Submit label while `busy`. Falls back to `submitLabel`. */
  busyLabel?: string
  /** Failure message shown above the actions. */
  error?: string
}

/**
 * Config-driven single-select question. It renders whatever `question` the
 * caller passes — the component never hardcodes the content — and reports the
 * chosen option id via `onSubmit`. Give it a `key` per question so the
 * selection resets between questions.
 */
export function QuestionModal({
  question,
  submitLabel,
  onSubmit,
  onClose,
  secondaryAction,
  busy = false,
  busyLabel,
  error,
}: QuestionModalProps) {
  const [selected, setSelected] = useState<string | null>(null)

  return (
    <Modal title={question.title} description={question.description} onClose={onClose}>
      <form
        className="question-modal"
        aria-busy={busy}
        onSubmit={(event) => {
          event.preventDefault()
          if (selected && !busy) onSubmit(selected)
        }}
      >
        <div className="question-modal__options" role="radiogroup" aria-label={question.title}>
          {question.options.map((option) => (
            <label key={option.id} className="question-modal__option">
              <input
                type="radio"
                name={question.id}
                value={option.id}
                checked={selected === option.id}
                disabled={busy}
                onChange={() => setSelected(option.id)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>

        {error ? (
          <p className="question-modal__error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="question-modal__actions">
          {secondaryAction ? (
            <button
              type="button"
              className="question-modal__secondary"
              disabled={busy}
              onClick={secondaryAction.onClick}
            >
              {secondaryAction.label}
            </button>
          ) : null}
          <button type="submit" className="question-modal__submit" disabled={!selected || busy}>
            {busy && busyLabel ? busyLabel : submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  )
}
