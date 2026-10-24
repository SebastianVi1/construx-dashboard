# Modal

Reusable, accessible modal primitives. Nothing here is feature specific.

- [`Modal`](./Modal.tsx) — a generic dialog: scrim, Escape-to-close,
  click-outside, focus, and ARIA wiring.
- [`QuestionModal`](./QuestionModal.tsx) — a config-driven single-select
  question. It renders whatever `Question` it is given and reports the chosen
  option id through `onSubmit`.

## Adding a question

Questions are data, not code. Build a `Question` (validated by
[`questionSchema`](./question.ts)) and pass it to `QuestionModal`:

```ts
import { QuestionModal, type Question } from '../../components/modal'

const question: Question = {
  id: 'role',
  title: 'What best describes your role?',
  options: [
    { id: 'owner', label: 'Owner / Developer' },
    { id: 'contractor', label: 'General contractor' },
  ],
}

<QuestionModal
  question={question}
  submitLabel="Continue"
  onSubmit={(optionId) => sendAnswer(optionId)}
  onClose={() => close()}
/>
```

## Extending

The current shape is a single question with a single answer. Growing it (multi
select, several questions, required vs optional) means extending
[`question.ts`](./question.ts) and its rendering here — the caller API keeps
the same `question`-in / `optionId`-out shape.
