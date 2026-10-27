# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

React 19 + TypeScript + Vite 8 (Rolldown) SPA. Bun is the package manager/runtime (`bun.lock` is committed; no npm/yarn). `AGENTS.md` holds the base repo guidelines; its route list and layout notes are out of date, so trust `src/App.tsx` and this file.

## Commands

- `bun install` — install locked deps
- `bun run dev` — Vite dev server; `/api` is proxied to `VITE_API_PROXY_TARGET` (default `http://localhost:8080`, see `vite.config.ts`)
- `bun run build` — `tsc -b` typecheck, then bundle to `dist/`
- `bun run lint` — ESLint
- `bun test` — all tests; `bun test src/features/auth/auth.test.ts` — one file
- Run lint + build + test before finishing. No formatter is configured; don't run Prettier.

## Architecture

**Provider stack** (`src/main.tsx`, order matters): `BrowserRouter` → `LocaleProvider` → `OnboardingProvider` → `AuthProvider` → `App`. `src/App.tsx` is the route table (`/`, `/login`, `/register`, `/verify-email`, `/auth/complete`, `/account`). `features/home/HomePage.tsx` exists but is intentionally unrouted.

**Auth** (`src/features/auth/`): the backend uses HttpOnly cookies (access JWT + rotating refresh token); JS never touches tokens. `auth.md` (untracked, repo root) documents the backend contract (endpoints, CSRF, Google OIDC flow).
- `authApi.ts`: axios (not fetch), `withCredentials: true`, fetches a CSRF token via GET before every mutating call. Injectable `AxiosInstance` for tests.
- `session.ts`: `restoreSession()` calls `/me`; on 401 it tries `/refresh` exactly once, then retries `/me`. `AuthProvider` guards against StrictMode double-invoke with a ref because refresh rotates the secret — don't make it run twice.
- Zod schemas for API payloads live in `schemas.ts`.

**i18n** (`src/i18n/`): custom, no library. `messages.ts` holds the typed message dictionaries per `Locale`; `format.ts` for formatting; `LocaleProvider`/`locale-context.ts` expose the locale. User-facing strings go through messages, not literals.

**Onboarding** (`src/features/onboarding/`): `OnboardingProvider` owns answers (persisted to `localStorage` key `construx.onboarding`) and renders the FAB and portal modal for the whole app. Built on the generic `src/components/modal/` (`Modal`, config-driven `QuestionModal`).

**Forms**: use `src/components/form/` (config-driven `Form`/`Field`, `useForm`, `collectErrors`); see its `README.md`.

## Conventions

- Design tokens come from `design.md`, mapped to `--cx-*` custom properties in `src/index.css`; use `var(--cx-*)`, never raw hex. Styles are co-located per feature/component; `index.css` is global only.
- React Compiler is on (`babel-plugin-react-compiler`): no manual `useMemo`/`useCallback` for performance.
- Context pattern: context object + hook in a `*-context.ts` file, provider component in a separate `.tsx` (keeps `react-refresh` lint happy).
- `tsconfig.app.json` fails the build on unused locals/params, value imports of types (use `import type`), and enums/namespaces/parameter properties.
- Style: two-space indent, single quotes, no semicolons.
- Only `VITE_API_`-prefixed env vars reach the browser; `src/config/env.ts` validates `VITE_API_BASE_URL` and throws if invalid. `.env` is gitignored, `.env.example` is committed.

## Testing

`bun test` runs `*.test.ts` only. There is no component renderer (no Testing Library/jsdom), so tests cover pure logic: zod schemas, the axios API via a fake `AxiosInstance`, and helpers. Keep tests beside their subject. Extract logic into pure functions so it is testable.

## Commits

Conventional Commit subjects (`feat:`, `fix:`, `refactor:`, `chore:`). No AI/Co-Authored-By attribution. Never commit `dist/`, `node_modules/`, `.env`, or secrets. Agent tooling is tracked: skills (`.agents/skills/`, linked from `.claude/skills/`, pinned in `skills-lock.json`), `AGENTS.md` and this file. Plans and specs (`.specify/`, `specs/`), `.claude/settings.local.json` and the skill registry (`.atl/`) stay gitignored.
