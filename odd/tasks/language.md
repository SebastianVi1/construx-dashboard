# Language (i18n): region-based locale

Objective: make the app render in one language or another based on the user's region — Spanish (neutral) or English — with every hardcoded UI string replaced by locale-aware messages.

Branch: `language`
Delivery: work-unit commits on the feature branch; push/PR/merge remain the user's decisions.
Test runner: `bun test`

## Specs

- S1: "Cambia la arquitectura para que use un idioma u otro segun su region, crea un branch llamado language y empieza a cambiar todas las variables por ese locale language"
- S2: Supported locales: "Español (neutro) + Inglés"
- S3: English is the default/fallback locale.
- S4: Region is auto-detected from the browser (`navigator.language`): a language starting with `es` → `es`, anything else → `en`.
- S5: A manual switcher overrides the detected locale and persists the choice across sessions (`localStorage`).
- S6: Every hardcoded user-facing string (auth + home UI: labels, buttons, headings, validation messages) becomes locale-aware. The brand name "Construx" and static demo data (site names/locations, activity text, people counts) stay as data.

## Tasks

- T1 — i18n foundation: `Locale` type + `resolveLocale`, en/es message dictionaries, `formatMessage`, `LocaleProvider`, `LocaleSwitcher`, tests — inline — S2/S3/S4/S5 — done — `4bed675`
- T2 — auth feature string migration + `LocaleProvider` wiring in `main.tsx` — inline — S1/S6 — done — `e264a00`
- T3 — home feature string migration + locale-aware date/currency/month formatting — inline — S1/S6 — done — `8a30e52`

## Log

- L1 (2026-10-23): "Cambia la arquitectura para que use un idioma u otro segun su region, crea un branch llamado language y empieza a cambiar todas las variables por ese locale language"
- L2 (2026-10-23): "Español (neutro) + Inglés"
- L3 (2026-10-23): Prior register work (`name` field mapping) stashed as `stash@{0}` so the `language` branch starts clean.
- L4 (2026-10-23): Locale switcher placed in the top-right corner of the auth screen only (`.auth-locale`); Home keeps its own placement in the sidebar footer.
- L5 (2026-10-23): T1 → `4bed675`, T2 → `e264a00`, T3 → `8a30e52`. `bun test` (36 pass), lint, and build all green.
