---
version: alpha
name: Construx Dashboard
description: A precise, blue-led operations workspace for construction companies.
colors:
  canvas: "#F5F8FC"
  surface: "#FFFFFF"
  ink: "#14263D"
  muted: "#52657A"
  border: "#D7E1EC"
  primary: "#175CD3"
  primary-hover: "#1248A8"
  primary-subtle: "#EAF2FF"
  success: "#176B4D"
  warning: "#8B5600"
  danger: "#B42332"
  chart-teal: "#0F766E"
  chart-amber: "#A96909"
  chart-violet: "#6E56CF"
typography:
  sans:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
  data:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
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
    minHeight: "2.75rem"
  input:
    minHeight: "2.75rem"
  card:
    radius: "0.75rem"
  table:
    rowMinHeight: "3rem"
---

# Construx Dashboard design guide

**Status:** The Login and Registration screens now map this proposed system to semantic CSS variables in `src/index.css` and consume them in `src/features/auth/auth.css`. The existing landing route remains the Vite starter; its purple accent and automatic dark mode are not evidence of an established Construx identity. Other dashboard screens have not yet implemented this guide.

## Overview

### Direction

Think of a well-kept site log: precise headings, aligned measurements, restrained blueprint-blue markers, and enough whitespace to scan quickly. This is an operational SaaS product, not a marketing landing page. Administrators need to move between Sites, People, Products, Finance, and CRM; employees need an uncomplicated view of their assigned sites and the product catalogue. The interface should make the **current company and site context** unmistakable without decorating every panel like a blueprint.

The signature is a slim, persistent context strip showing the selected company, site when relevant, and reporting period where financial data appears. It encodes actual scope, not decoration. Navigation, forms, and tables remain conventional. Avoid construction stock photos, blueprint-grid backgrounds behind data, gradients on every card, and a wall of generic KPI tiles.

This direction implements the [dashboard constitution](.specify/memory/constitution.md) and the [construction workspace specification](specs/001-construction-operations-workspace/spec.md). The [login and registration specification](specs/003-auth-entry-screens/spec.md) informs the auth-screen states. Product behavior and authorization remain governed by those specs, not by this visual guide.

### Ownership

`design.md` is the proposed source for **future** visual tokens. When UI implementation begins, map each semantic token once into global CSS custom properties in `src/index.css`, then have shared components consume those properties. Do not copy raw hex values into individual screens. Update this file and the runtime tokens together if a design decision changes. No token export pipeline or new design dependency is required.

## Colors

| Role | Token | Use |
| --- | --- | --- |
| App canvas | `canvas` | Quiet page background, never chart data. |
| Surface | `surface` | Forms, tables, cards, and dialogs. |
| Main / secondary text | `ink` / `muted` | Primary reading hierarchy and supporting labels. |
| Structural line | `border` | Dividers and input outlines; grouping starts with spacing. |
| Action | `primary` / `primary-hover` | Primary button, link, active navigation, and selection. |
| Soft action surface | `primary-subtle` | Selected row or low-emphasis information, with dark text. |
| Status | `success` / `warning` / `danger` | Confirmed outcomes, caution, and errors or overruns. |
| Chart series | `primary`, `chart-teal`, `chart-amber`, `chart-violet` | Distinct series only when the chart needs them. |

Use a light theme for the first release; dark mode is not specified. Never infer financial health from hue alone: label **Savings**, **Overrun**, or **No data** and show the actual amount, period, and currency. Missing values are not zero. Keep status colors out of decorative chrome. The main text and action/status text tokens above have at least 4.5:1 contrast against white; recheck every composed state, especially muted text on tinted surfaces and chart marks.

## Typography

- **Primary:** IBM Plex Sans for headings, controls, forms, and prose; weights 400, 500, and 600. Self-host only the necessary WOFF2 subsets when implemented. Until those assets exist, use the listed system fallback without blocking content or fetching a font at runtime.
- **Data:** IBM Plex Mono for amounts, IDs, dates, and compact metadata; use sparingly, not for paragraphs. Enable tabular numerals in financial columns so changing values do not shift alignment.
- **Scale:** Page title 28/36 px at desktop and 24/32 px on mobile; section title 20/28 px; body and controls 14/20 or 16/24 px; supporting text 13/18 px. Financial headline values may reach 32/40 px when accompanied by a clear label.
- **Copy:** Sentence case, specific nouns, and direct verbs: “Add site,” “Assign employee,” “Record cost.” Avoid “Submit,” unexplained abbreviations, decorative all-caps, and color-only labels.

## Layout

- Desktop: stable left navigation, context strip, then a page header containing title, short purpose, and one primary action. Put filters next to their dataset, not in a global toolbar.
- Use a 4 px spacing unit: 8 px within tight control groups, 16 px within components, 24 px between related blocks, and 32 px between major sections. Give dense tables more horizontal room rather than enlarging every card.
- At narrow widths, replace the side navigation with a labelled menu or compact navigation that still exposes all authorized destinations. Stack page actions and forms, preserve readable labels, and give data tables their own horizontal scroll or a purpose-built row layout. Do not silently hide required fields.
- Do not treat 768 px or 1200 px as device categories; use them as initial layout review points and adjust at actual content breakpoints. Keep controls at least 44 × 44 px where they are touch targets.
- Reserve space for loaders, errors, and async results so controls and totals do not jump. The content area may scroll; avoid trapping a long form inside a fixed-height panel.

## Elevation & depth

Prefer spacing and a 1 px `border` to separate regions. Use a soft shadow only for floating menus, dialogs, or a surface that must visibly sit above another. Do not shadow every card. Keep chart plot areas flat so marks and axes remain legible.

## Shapes

Use `sm` for compact badges, `md` for inputs and buttons, and `lg` for cards and dialogs. Avoid pill-shaped data containers and excessively rounded dashboard panels. Icons should be simple, consistent, and paired with text for primary navigation or ambiguous actions; do not introduce a second icon library without a concrete need.

## Components

### Navigation, cards, and tables

- Show the active destination and current company context on every protected screen. Site details should retain a clear route back to the site list.
- A card groups one meaningful task or data story; not every number needs its own card. Use labels, units, and comparison periods beside values.
- Tables use visible headers, aligned numeric columns, readable row dividers, and explicit sort/filter controls. Provide loading, empty, no-results, error, and populated states. Do not show another company's data or stale protected data while session status is unresolved.
- Put a named action in empty states (“Add first site” for authorized administrators); employees receive role-appropriate guidance rather than an unusable create action.

### Forms and feedback

- Labels remain visible above fields; placeholder text is an example, not a label. Put validation beside the affected field and preserve entered non-secret values on recoverable errors.
- Buttons have default, hover, pressed, focus-visible, disabled, and busy states. Keep button width stable while busy and prevent duplicate submissions.
- Use an app-owned accessible dialog for consequential confirmations, with clear action and cancellation. Use inline feedback for field errors and a short status message for completed actions; never rely on color alone.
- Login and registration use the same blue type, controls, and spacing, but a narrower single-column layout. Their success/error states must not reveal credentials, token values, or whether a registration email is already in use. Registration acceptance means “check your email,” not “signed in.”

### Finance and charts

- Lead with labelled budget, recorded cost, and **Savings** or **Overrun** totals, followed by a simple comparison chart only when it adds insight. Explicitly show reporting period and declared currency.
- Use bars or lines for comparisons and trends; avoid 3D, gradients, gauges, and animated counting numbers. Label axes and series directly where possible, and provide a concise text/table equivalent for chart data.
- A negative budget difference is an overrun, not green “savings.” No budget or no costs must appear as missing data, not a fabricated zero. Never sum mixed currencies.

### Motion and accessibility

- Motion should confirm an interaction, not delay access: roughly 120–180 ms for hover/press and up to 220 ms for a small panel transition. Avoid entrance choreography on routine dashboard loads.
- Respect `prefers-reduced-motion` by removing nonessential transitions. Keep focus indicators visible, keyboard order logical, and state changes announced where appropriate. Target WCAG 2.2 AA when implementing and verify contrast, focus, touch targets, and chart alternatives in the rendered UI.

## Do's and Don'ts

- **Do** make company/site scope and data freshness obvious before optimizing decoration.
- **Do** reuse one semantic token and component vocabulary across Sites, People, Products, Finance, CRM, and auth.
- **Don't** turn the Products catalogue into an inventory or purchasing interface; that is outside the current spec.
- **Don't** add chart libraries, animation packages, or font services merely to match a mockup; speed and KISS are product requirements.
