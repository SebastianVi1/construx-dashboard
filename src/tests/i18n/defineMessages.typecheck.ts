// Compile-time spec for defineMessages, checked by `bun run build` (tsc -b), not by `bun test`.
// Every @ts-expect-error below must stay an error: if a slice stopped enforcing EN/ES parity,
// the directive would become unused and the build would fail.
import { defineMessages } from '../../i18n/defineMessages'

// A slice whose Spanish side mirrors the English keys compiles.
defineMessages({
  en: { title: 'Floor plans', zone: { name: 'Zone' } },
  es: { title: 'Planos', zone: { name: 'Zona' } },
})

defineMessages({
  en: { title: 'Floor plans', subtitle: 'All plans' },
  // @ts-expect-error -- a missing top-level es key fails the typecheck
  es: { title: 'Planos' },
})

defineMessages({
  en: { zone: { name: 'Zone', area: 'Area' } },
  // @ts-expect-error -- a missing nested es key fails the typecheck
  es: { zone: { name: 'Zona' } },
})

defineMessages({
  en: { title: 'Floor plans' },
  // @ts-expect-error -- an es key unknown to en fails the typecheck
  es: { title: 'Planos', extra: 'Extra' },
})

defineMessages({
  en: { zone: { name: 'Zone' } },
  // @ts-expect-error -- es must keep en's nesting, not flatten a group into a string
  es: { zone: 'Zona' },
})
