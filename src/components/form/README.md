# Form

A small, dependency-light form toolkit. It separates **logic** from
**presentation** so screens describe *what* they collect and stay free of
state plumbing.

- [`useForm`](./useForm.ts) — owns all logic: values, validation, submission.
- [`Form`](./Form.tsx) — renders a `<form>` from a declarative `fields` config.
- [`Field`](./Field.tsx) — renders a single labelled control.
- [`collectErrors`](./validation.ts) — flattens a Zod error into a field→message map.

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
| `type` | `FieldType` | `text` \| `email` \| `password` \| `tel` \| `number` \| `url` \| `search`. Default `text`. |
| `placeholder` | `string` | Placeholder shown while the field is empty. |
| `autoComplete` | `string` | Native autocomplete hint (`email`, `current-password`, …). |
| `inputMode` | `InputMode` | On-screen keyboard hint (`email`, `numeric`, …). |
| `spellCheck` | `boolean` | Force spell-check on/off for the control. |
| `hint` | `string` | Helper text shown while the field is valid. |

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
| `errors` | `FieldErrors` | Current per-field messages. |
| `isSubmitting` | `boolean` | True while a submit is in flight. |
| `submitError` | `boolean` | True when the last submit request failed. |
| `onChange` | `(name, value) => void` | Updates a field and clears its error. |
| `onSubmit` | `(event) => void` | The form submit handler. |

## Accessibility

Every control gets a generated `id` (`field-{name}`) wired to its `<label>`,
and `aria-invalid` / `aria-describedby` point at the error or hint message.
Field names must be unique within a form.
