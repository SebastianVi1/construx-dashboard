# Form

A small, dependency-light form toolkit. It separates **logic** from
**presentation** so screens describe *what* they collect and stay free of
state plumbing.

- [`useForm`](./useForm.ts) — owns all logic: values, validation, submission.
- [`Form`](./Form.tsx) — renders a `<form>` from a declarative `fields` config.
- [`Field`](./Field.tsx) — renders a single labelled control.
- [`collectErrors`](./validation.ts) — flattens a Zod error into a field→message map.
- [`NumberControl`](./NumberControl.tsx) — a number-only text input; money gets `1,234.56` grouping while typing.
- [`TEXT_LIMITS` / `MONEY_DIGITS`](./limits.ts) — the app's field lengths and money digits, never above the backend's.

## Why the split?

`AuthForm` used to mix validation, API calls, and JSX in one place. With this
toolkit the screen only wires a schema and a submit callback into `useForm`,
then hands the returned controller plus a `FieldConfig[]` to `<Form>`. The UI
never imports Zod, and the hook never renders JSX — each half is testable and
reusable on its own.

## Usage

```tsx
import { Form, useForm, type FieldConfig } from '../../components/form'
import { login } from './authApi'
import { loginSchema } from './schemas'

const fields: FieldConfig[] = [
  { name: 'email', label: 'Email address', type: 'email', placeholder: 'you@example.com', autoComplete: 'email' },
  { name: 'password', label: 'Password', type: 'password', autoComplete: 'current-password' },
]

function Login() {
  const form = useForm({
    initialValues: { email: '', password: '' },
    schema: loginSchema,
    onSubmit: async (values) => {
      await login(values)
    },
  })

  return (
    <Form controller={form} fields={fields} submitLabel="Sign in" pendingLabel="Signing you in…">
      {form.submitError && <p role="alert">Could not sign you in.</p>}
    </Form>
  )
}
```

## Field config

| Prop | Type | Description |
| --- | --- | --- |
| `name` | `string` | Unique field key; used as the input `name` and to key values/errors. |
| `label` | `string` | Label text rendered above the control. |
| `type` | `FieldType` | `text` \| `email` \| `password` \| `tel` \| `number` \| `money` \| `url` \| `search` \| `date` \| `datetime-local` \| `select` \| `textarea`. Default `text`. `money` shows the active currency symbol, groups thousands while typing and pads cents on blur; its value is the plain amount (`"1234.50"`) in the **active currency**, so convert it with `useCurrency().toMxn` before sending. `number` takes digits only (see `decimals`). `datetime-local` values are wall-clock `YYYY-MM-DDTHH:mm` strings; convert them to instants before sending. |
| `placeholder` | `string` | Placeholder shown while the field is empty. |
| `autoComplete` | `string` | Native autocomplete hint (`email`, `current-password`, …). |
| `inputMode` | `InputMode` | On-screen keyboard hint (`email`, `numeric`, …). |
| `spellCheck` | `boolean` | Force spell-check on/off for the control. |
| `hint` | `string` | Helper text shown while the field is valid. |
| `options` | `FieldOption[]` | Choices of a `select` field (`{ value, label }`); use `value: ''` for "none". |
| `min` | `string` | Earliest `date` / `datetime-local` value. |
| `rows` | `number` | Visible rows of a `textarea`. |
| `maxLength` | `number` | Most characters; pick it from `TEXT_LIMITS`. A `textarea` shows a counter. Keep the schema's `.max()` in step. |
| `decimals` | `number` | Decimal places of a `number` field; 0 (default) means whole numbers. |
| `maxDigits` | `number` | Digits before the dot of `number` / `money`; money defaults to `MONEY_DIGITS.amount`. |
| `suffix` | `string` | Unit shown after a `number` value, such as `m`. |

## `useForm` options

| Option | Type | Description |
| --- | --- | --- |
| `initialValues` | `Record<string, string>` | Starting values keyed by field name. |
| `schema` | `ZodType<Values>` | Zod schema used to validate on submit. |
| `onSubmit` | `(values) => Promise<void>` | Called with parsed values after validation passes. |
| `onInvalid` | `(errors) => void` | Optional; called with field errors after a failed validation (e.g. to focus the first bad field). |

## Controller (what `useForm` returns)

| Property | Type | Description |
| --- | --- | --- |
| `values` | `Record<string, string>` | Current field values. |
| `errors` | `FieldErrors` | Messages of fields already typed in, left or submitted; they update live. |
| `isSubmitting` | `boolean` | True while a submit is in flight. |
| `submitError` | `boolean` | True when the last submit request failed. |
| `onChange` | `(name, value) => void` | Updates a field and clears its error. |
| `onSubmit` | `(event) => void` | The form submit handler. |

## Buttons outside a form

Any `.button` that starts a request sets `disabled` and `aria-busy` while it runs and swaps its label for
the "…ing" text; `aria-busy` draws the spinner. Guard the handler with a ref too, so a double click that lands
before React re-renders is ignored.

## Accessibility

Every control gets a generated `id` (`field-{name}`) wired to its `<label>`,
and `aria-invalid` / `aria-describedby` point at the error or hint message.
Field names must be unique within a form.
