import { useState } from 'react'
import { Modal } from './Modal'
import type { Question } from './question'

type QuestionModalProps = {
  question: Question
  submitLabel: string
  onSubmit: (optionId: string) => void
  onClose: () => void
}

/**
 * Config-driven single-select question. It renders whatever `question` the
 * caller passes — the component never hardcodes the content — and reports the
 * chosen option id via `onSubmit`.
 */
export function QuestionModal({ question, submitLabel, onSubmit, onClose }: QuestionModalProps) {
  const [selected, setSelected] = useState<string | null>(null)

  return (
    <Modal title={question.title} description={question.description} onClose={onClose}>
      <form
        className="question-modal"
        onSubmit={(event) => {
          event.preventDefault()
          if (selected) onSubmit(selected)
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
                onChange={() => setSelected(option.id)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>

        <div className="question-modal__actions">
          <button type="submit" className="question-modal__submit" disabled={!selected}>
            {submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  )
}
