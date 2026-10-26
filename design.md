---
version: alpha
name: Construx Dashboard
description: A dark blueprint-style operations workspace for construction companies, sharing the Construx landing page palette.
colors:
  ink-950: "#060D1A"
  ink-900: "#0A1628"
  ink-800: "#102039"
  ink-700: "#1A2F52"
  ink-600: "#2A4373"
  blueprint-400: "#6FA8FF"
  blueprint-300: "#9CC2FF"
  paper: "#F3F6FB"
  paper-dim: "#C4CFE0"
  safety-600: "#E5640A"
  safety-500: "#FF7A1A"
  safety-400: "#FF9446"
  success: "#3DDC97"
  warning: "#FFC24A"
  danger: "#FF7B8A"
typography:
  display:
    fontFamily: "Space Grotesk Variable, system-ui, sans-serif"
  sans:
    fontFamily: "Inter Variable, system-ui, sans-serif"
  data:
    fontFamily: "JetBrains Mono Variable, ui-monospace, monospace"
rounded:
  sm: "0.375rem"
  md: "0.5rem"
  lg: "0.75rem"
spacing:
  unit: "0.25rem"
  page-gutter: "1.5rem"
  section-gap: "2rem"
components:
  button:
    minHeight: "2.875rem"
  input:
    minHeight: "2.875rem"
  card:
    radius: "0.75rem"
  table:
    rowMinHeight: "3rem"
---

# Construx Dashboard design guide

**Status:** Login, registration, password recovery and account screens use this system through semantic `--cx-*` variables in `src/index.css`. The palette, fonts, and logo assets come from the Construx landing page (`construx-landing-page/src/styles/global.css`) so both products read as one brand. Other dashboard screens have not yet been restyled; they inherit the new tokens but need a pass.

## Overview

### Direction

Think of a well-kept site log: precise headings, aligned measurements, restrained blueprint-blue markers, and enough whitespace to scan quickly. This is an operational SaaS product, not a marketing landing page. Administrators need to move between Sites, People, Products, Finance, and CRM; employees need an uncomplicated view of their assigned sites and the product catalogue. The interface should make the **current company and site context** unmistakable without decorating every panel like a blueprint.

The signature is a slim, persistent context strip showing the selected company, site when relevant, and reporting period where financial data appears. It encodes actual scope, not decoration. Navigation, forms, and tables remain conventional. Avoid construction stock photos, blueprint-grid backgrounds behind data, gradients on every card, and a wall of generic KPI tiles.

This direction implements the [dashboard constitution](.specify/memory/constitution.md) and the [construction workspace specification](specs/001-construction-operations-workspace/spec.md). The [login and registration specification](specs/003-auth-entry-screens/spec.md) informs the auth-screen states. Product behavior and authorization remain governed by those specs, not by this visual guide.

### Ownership

`design.md` is the proposed source for **future** visual tokens. When UI implementation begins, map each semantic token once into global CSS custom properties in `src/index.css`, then have shared components consume those properties. Do not copy raw hex values into individual screens. Update this file and the runtime tokens together if a design decision changes. No token export pipeline or new design dependency is required.

## Colors

The raw landing-page scale lives in `src/index.css` (`--cx-ink-*`, `--cx-blueprint-*`, `--cx-safety-*`, `--cx-paper*`). Components use only the semantic roles below.

| Role | Token | Value | Use |
| --- | --- | --- | --- |
| App canvas | `--cx-canvas` | ink-950 | Page background and input fill. |
| Surface | `--cx-surface` / `--cx-surface-raised` | ink-900 / ink-800 | Panels, dialogs, raised items. |
| Text | `--cx-ink` / `--cx-muted` | paper / paper-dim | Primary reading and supporting text. |
| Structural line | `--cx-border` / `--cx-border-strong` | ink-700 / ink-600 | Panel dividers and input outlines. |
| Action | `--cx-primary` (+ `-hover`, `-pressed`, `-subtle`) | safety-500 / 400 / 600 | One primary button per view. Text on it uses `--cx-on-primary` (ink-950), never white. |
| Structure and focus | `--cx-accent` / `--cx-accent-subtle` | blueprint-400 | Links, input hover and focus ring, loaders. |
| Status | `--cx-success` / `--cx-warning` / `--cx-danger` (+ `-subtle`) | green / amber / rose | Confirmed outcomes, caution, errors. |

Orange means "act", blue means "structure and focus"; never swap them. Errors use a rose `danger` rather than orange so they cannot be confused with the primary action. Dark only for now. Do not infer financial health from hue alone: label **Savings**, **Overrun**, or **No data** and show the amount, period, and currency. Contrast is expected to be at least 4.5:1 for `paper`, `paper-dim`, `blueprint-400`, `success`, `danger`, and ink-950 text on `safety-500`, but it has not been measured in the rendered UI yet; recheck every composed state, especially tinted error and success fills.

## Typography

- **Display:** Space Grotesk for headings (h1-h3) and button labels. Tight tracking (-0.02em) on headings.
- **Body:** Inter for forms, tables, and prose; weights 400, 500, and 600.
- **Data:** JetBrains Mono for amounts, IDs, dates, and compact metadata, sparingly. Enable tabular numerals in financial columns.
- All three are self-hosted through `@fontsource-variable/*` (the same packages as the landing page), imported at the top of `src/index.css`. No font service is fetched at runtime.
- **Scale:** Page title 28/36 px desktop and 24/32 px mobile; section title 20/28 px; body and controls 14/20 or 16/24 px; supporting text 13/18 px.
- **Copy:** Sentence case, specific nouns, and direct verbs: "Add site," "Assign employee." Avoid "Submit," unexplained abbreviations, and decorative all-caps.

## Layout

- Desktop: stable left navigation, context strip, then a page header containing title, short purpose, and one primary action. Put filters next to their dataset, not in a global toolbar.
- Use a 4 px spacing unit: 8 px within tight control groups, 16 px within components, 24 px between related blocks, and 32 px between major sections. Give dense tables more horizontal room rather than enlarging every card.
- At narrow widths, replace the side navigation with a labelled menu or compact navigation that still exposes all authorized destinations. Stack page actions and forms, preserve readable labels, and give data tables their own horizontal scroll or a purpose-built row layout. Do not silently hide required fields.
- Do not treat 768 px or 1200 px as device categories; use them as initial layout review points and adjust at actual content breakpoints. Keep controls at least 44 × 44 px where they are touch targets.
- Reserve space for loaders, errors, and async results so controls and totals do not jump. The content area may scroll; avoid trapping a long form inside a fixed-height panel.

## Elevation & depth

Prefer spacing and a 1 px `border` to separate regions. On the dark canvas, use a deep black shadow only for floating menus, dialogs, and the auth panel.

The signature device from the landing page is the **plan-sheet corner mark**: four small safety-orange L-shaped ticks inset in a panel's corners. Use it on the auth panel and on cards the user can open; never on every container. Auth screens also sit on the faint blueprint grid (48 px, blueprint-400 at 7%); keep that grid out of data views. Do not shadow every card. Keep chart plot areas flat so marks and axes remain legible.

## Shapes

Use `sm` for compact badges, `md` for inputs and buttons, and `lg` for cards and dialogs. Avoid pill-shaped data containers and excessively rounded dashboard panels. Icons should be simple, consistent, and paired with text for primary navigation or ambiguous actions; do not introduce a second icon library without a concrete need.

## Components

### Navigation, cards, and tables

- Show the active destination and current company context on every protected screen. Site details should retain a clear route back to the site list.
- A card groups one meaningful task or data story; not every number needs its own card. Use labels, units, and comparison periods beside values.
- Tables use visible headers, aligned numeric columns, readable row dividers, and explicit sort/filter controls. Provide loading, empty, no-results, error, and populated states. Do not show another company's data or stale protected data while session status is unresolved.
- Put a named action in empty states (“Add first site” for authorized administrators); employees receive role-appropriate guidance rather than an unusable create action.

### Forms and feedback

- Labels remain visible above fields; placeholder text is an example, not a label. Preserve entered non-secret values on recoverable errors.
- **Validation is reactive and schema-driven.** Each form has one Zod schema; `useForm` re-parses the values on every render. A field shows no state until it is blurred or a submit was attempted; from then on its error, or its valid mark, follows the current value on every keystroke. Rules that span fields (such as password confirmation) update when either field changes. The first failed submit focuses the first invalid field.
- Field states are driven by `data-state="idle|invalid|valid"` on the field wrapper: an invalid field gets a rose border, a faint rose fill, an exclamation glyph, and a message below (`role="alert"`); a valid field gets a green border and a tick. The glyph means colour is never the only cue. A hint turns green once its rule is met.
- Password fields have a show/hide toggle with localized accessible names (`revealLabels`).
- Server errors appear in a bordered, tinted `form-error` block above the submit button, not under a field, and clear as soon as the user edits.
- Buttons have default, hover, pressed, focus-visible, disabled, and busy states. Keep width stable while busy and prevent duplicate submissions.
- Use an app-owned accessible dialog for consequential confirmations. Use inline feedback for field errors and a short status message for completed actions.
- Login and registration share controls and spacing in a narrow single-column panel. Their states must not reveal credentials, token values, or whether a registration email is already in use. Registration acceptance means "check your email," not "signed in."

### Finance and charts

- Lead with labelled budget, recorded cost, and **Savings** or **Overrun** totals, followed by a simple comparison chart only when it adds insight. Explicitly show reporting period and declared currency.
- Use bars or lines for comparisons and trends; avoid 3D, gradients, gauges, and animated counting numbers. Label axes and series directly where possible, and provide a concise text/table equivalent for chart data.
- A negative budget difference is an overrun, not green “savings.” No budget or no costs must appear as missing data, not a fabricated zero. Never sum mixed currencies.

### Motion and accessibility

- Motion should confirm an interaction, not delay access: roughly 120–180 ms for hover/press and up to 220 ms for a small panel transition. Avoid entrance choreography on routine dashboard loads.
- Respect `prefers-reduced-motion` by removing nonessential transitions. Focus indicators are a 2 px `safety-400` outline (or the blue accent ring on inputs) and must stay visible, keyboard order logical, and state changes announced where appropriate. Target WCAG 2.2 AA when implementing and verify contrast, focus, touch targets, and chart alternatives in the rendered UI.

## Brand assets

Logo files are kept in `src/assets/logo` (not committed). Usage:

| Need | File |
| --- | --- |
| Main brand on dark UI (auth header) | `lockup-horizontal-on-dark.svg`, imported by `AuthLayout` |
| Browser tab, bookmarks | `public/favicon.svg`, `favicon.ico`, `favicon-16/32.png` |
| iOS home screen | `public/apple-touch-icon.png` |
| Install / PWA | `public/site.webmanifest`, `icon-192.png`, `icon-512.png`, `maskable-512.png` |
| Narrow spaces (collapsed nav) | `symbol-on-dark.svg` |
| Light backgrounds (emails, print) | `lockup-horizontal.svg` |

Browser chrome colour is `#0A1628` (`ink-900`).

## Do's and Don'ts

- **Do** make company/site scope and data freshness obvious before optimizing decoration.
- **Do** reuse one semantic token and component vocabulary across Sites, People, Products, Finance, CRM, and auth.
- **Don't** use `white` or raw hex in component CSS; use the `--cx-*` roles.
- **Don't** turn the Products catalogue into an inventory or purchasing interface; that is outside the current spec.
- **Don't** add chart libraries, animation packages, or font services merely to match a mockup; speed and KISS are product requirements.
