---
name: form-inputs
description: Use when adding or changing any input, form or mutating button in the Construx dashboard - money and number fields, text lengths, live validation, currency conversion, and single-submit loading states.
---

# Form inputs

Every field validates live, every text has a realistic limit, every amount reads `$1,234,567.89`, and every
button that changes data can only fire once. Build on `src/components/form/` (read its `README.md`).

## Fields

- Use `useForm` + zod + `Form`/`Field`. A hand-written form is only for layouts `Form` cannot render; even then
  render each control with `<Field>` so state, errors and counters look the same.
- Text: `maxLength: TEXT_LIMITS.<kind>` on the field **and** `.max(TEXT_LIMITS.<kind>, message)` in the schema.
  Required text uses `.trim().min(1, message)`. Long text is a `textarea` with `TEXT_LIMITS.longText`.
- Money: `type: 'money'` (prices add `maxDigits: MONEY_DIGITS.price`). The value is the plain amount in the
  **active currency**. Validate with `amountIssue(raw, { allowZero, max, rate })` from
  `features/sites/budgetRules.ts`, where `rate` is pesos per typed unit, so the backend cap is checked in MXN.
  Send `toMxn(Number(raw))`; prefill an edit with `String(fromMxn(stored))`, both from `useCurrency()`.
- Labels never hardcode a currency: use `{currency}` in the message and fill it with `useCurrency().currency`.
- Numbers: `type: 'number'` with `decimals`, `maxDigits` and `suffix` (unit).
- Every message lives in the feature's `messages.ts` slice in English and Spanish. No zod default messages.

## Buttons

- Any button that creates, saves, deletes, moves or uploads: `disabled={busy}` + `aria-busy={busy}` + the
  "…ing" label, and return early from the handler while a ref says it is running.
- Confirm destructive actions with `ConfirmDialog` from `components/modal`, never `window.confirm`; show the
  error inside it instead of swallowing it.

## Before committing

`bun run lint && bun run build && bun test`, then one Conventional Commit per feature
(`feat(materials): validate and format price inputs`). Pure rules go in a feature `*.ts` file with a test in
`src/tests/` mirroring the path.
