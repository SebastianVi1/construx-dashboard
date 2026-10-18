# Repository Guidelines

## Project Structure & Module Organization

This is a React 19, TypeScript, and Vite application. `src/main.tsx` mounts the app, while `src/App.tsx` contains the current screen. Keep component-specific styles near their components (`src/App.css`); `src/index.css` holds global styles. Imported images live in `src/assets/`, and files served unchanged, such as `public/icons.svg`, live in `public/`. Build output goes to `dist/` and must not be committed.

## Build, Test, and Development Commands

Use Bun because the repository tracks `bun.lock`:

- `bun install` installs locked dependencies.
- `bun run dev` starts the Vite development server with hot reload.
- `bun run build` type-checks with `tsc -b` and creates a production build in `dist/`.
- `bun run preview` serves that build locally for a final check.
- `bun run lint` runs ESLint across the project.

## Coding Style & Naming Conventions

Follow the existing TypeScript/TSX style: two-space indentation, single-quoted imports, and no semicolons. Name React components and their files in PascalCase (`App.tsx`); use camelCase for functions and variables. Keep browser-facing code in `src/` and avoid unused locals or parameters: the TypeScript configuration rejects them. ESLint enforces recommended JavaScript, TypeScript, React Hooks, and Vite React Refresh rules. Run lint and build before submitting changes; no formatter is configured.

## Testing Guidelines

There is currently no test script, test framework, or coverage threshold. Do not claim automated test coverage from `bun run build`: it checks types and bundling, not behavior. For a behavior change, add a focused test when a test runner is introduced, using names such as `App.test.tsx`; until then, run lint/build and describe the manual checks performed in the pull request.

## Commit & Pull Request Guidelines

The two existing commits use informal subjects (`first commit`, `add zod for validation`), so there is no established history-based format. Use clear Conventional Commit subjects for new work, such as `feat: add project overview`. Keep pull requests focused; explain the change, link a relevant issue when one exists, list verification commands, and include screenshots for visible UI changes. Never commit secrets, `node_modules/`, or `dist/`.
