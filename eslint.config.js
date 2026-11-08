import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "Literal[value=/^#[0-9a-fA-F]{3,8}$/]",
          message: 'Use var(--cx-*) design tokens, not raw hex values.',
        },
      ],
    },
  },
  // Tests, theme token definitions, and Leaflet/SVG color consumers may use raw hex
  {
    files: [
      'src/tests/**',
      'src/theme/**',
      'src/features/auth/AuthForm.tsx',
      'src/features/floor-plans/zonesApi.ts',
      'src/features/gantt/BarColorPicker.tsx',
    ],
    rules: { 'no-restricted-syntax': 'off' },
  },
])
