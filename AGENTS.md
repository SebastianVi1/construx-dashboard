# Repository Guidelines

Construx dashboard — a React 19 + TypeScript + Vite 8 (Rolldown) SPA. Bun is the package manager and runtime; `bun.lock` is committed, so do not use npm/yarn.

## Commands

- `bun install` — install locked dependencies.
- `bun run dev` — Vite dev server (HMR). Proxies `/api` → `VITE_API_PROXY_TARGET` when that var is set.
- `bun run build` — `tsc -b` typecheck, then production bundle to `dist/`.
- `bun run lint` — ESLint.
- `bun test` — all tests; `bun test src/tests/features/auth/auth.test.ts` — a single file.
- `bun run preview` — serve the production build.

Run lint + build + test before finishing. No formatter is configured — do not run Prettier.

## Layout

- `src/main.tsx` wraps the app in `<BrowserRouter>`; `src/App.tsx` is the route table: `/` → `LoginPage`, `/register` → `RegisterPage`.
- Features live in `src/features/<domain>/`; shared UI in `src/components/`; `src/config/env.ts` wraps env access.
- Tests live in `src/tests/`, mirroring the source tree (`src/tests/features/auth/auth.test.ts` ↔ `src/features/auth/`); test-only helpers in `src/tests/support/`.
- Styles are co-located per feature/component (`auth.css`, `home.css`, `form.css`); `src/index.css` is global only.
- `src/features/home/HomePage.tsx` exists but is intentionally not routed yet.

## Conventions agents miss

- **Design tokens**: `design.md` is the source of truth, mapped once to `--cx-*` custom properties in `src/index.css`. Consume `var(--cx-*)`, never raw hex.
- **React Compiler is enabled** (`babel-plugin-react-compiler` via `vite.config.ts`). Write plain components; do not hand-add `useMemo`/`useCallback` for performance.
- **HTTP is axios, not fetch.** `src/features/auth/authApi.ts` is the pattern: `createAuthApi(baseUrl, client)` injects an `AxiosInstance`, uses `withCredentials: true`, and does a CSRF-proof GET before the POST (login expects `204`, register `202`).
- **Forms**: reuse `src/components/form/` (config-driven `Form`/`Field` + `useForm` + `collectErrors`); see its `README.md`. Do not hand-roll form state/JSX.
- **tsconfig** (`tsconfig.app.json`) fails builds on: unused locals/params (`noUnusedLocals`/`noUnusedParameters`), value imports of types (`verbatimModuleSyntax` → use `import type`), and enums/namespaces/parameter properties (`erasableSyntaxOnly`).
- Style: two-space indent, single quotes, no semicolons; PascalCase components, camelCase functions/vars.

## Testing

- `bun test` runs `*.test.ts`. There is **no React component test renderer** (no Testing Library/jsdom): tests cover pure logic only — zod schemas, the axios API (via an injected fake `AxiosInstance`), and pure helpers.
- Keep tests out of feature folders: `src/tests/<same path as src>/<name>.test.ts` (for example `src/tests/features/auth/auth.test.ts`, `src/tests/components/form/form.test.ts`). Import the subject with a relative path (`../../../features/auth/authApi`); test-only helpers go in `src/tests/support/`.

## Environment

- Only `VITE_API_`-prefixed vars are exposed to the browser. `.env.example` documents `VITE_API_BASE_URL` (auth API path, default `/api`) and `VITE_API_PROXY_TARGET` (dev-only proxy origin). `src/config/env.ts` validates `VITE_API_BASE_URL` and throws on invalid values.
- `.env` is gitignored; `.env.example` is committed.

## Commits

- Conventional Commit subjects (`feat:`, `fix:`, `refactor:`, `chore:`). No AI/Co-Authored-By attribution.
- Never commit `dist/`, `node_modules/`, `.env`, or secrets.
- AI tooling artifacts are gitignored (`.agents/`, `.atl/`, `.specify/`, `specs/`, `skills-lock.json`, `AGENTS.md`) — do not re-add them.
