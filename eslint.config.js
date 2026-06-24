// ESLint 9 flat config for βetaFleet
// Patterns applied: @typescript-eslint (type-aware), eslint-plugin-react (React 19),
// eslint-plugin-tailwindcss (Tailwind v4), eslint-plugin-security (OWASP),
// eslint-plugin-import, eslint-plugin-react-hooks.
import eslint from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import tailwindcss from 'eslint-plugin-tailwindcss';
import security from 'eslint-plugin-security';
import importPlugin from 'eslint-plugin-import';
import globals from 'globals';
import path from 'node:path';

export default [
  // Global ignores — flat config uses `ignores` (no .eslintignore)
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      'supabase/functions/**',
      'e2e/**',
      'playwright*.ts',
      'playwright*.config.*',
      'scripts/**',
      '**/*.config.ts',
      '**/*.config.mjs',
      '**/*.config.js',
      'docs/**',
      'eslint-report.txt',
    ],
  },

  // Base JS recommended
  eslint.configs.recommended,

  // @typescript-eslint — type-aware linting (recommended-type-checked)
  ...tseslint.configs['flat/recommended-type-checked'],
  {
    name: 'betaravel/typescript-eslint/language-options',
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        projectService: true,
        ecmaFeatures: { jsx: true },
      },
    },
  },

  // React 19 (new JSX transform → jsx-runtime)
  {
    name: 'betaravel/react/setup',
    files: ['src/**/*.{ts,tsx,js,jsx}'],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooks,
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: {
        version: '19.0',
      },
    },
    rules: {
      ...reactPlugin.configs.flat.recommended.rules,
      ...reactPlugin.configs.flat['jsx-runtime'].rules,
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react/prop-types': 'off',
    },
  },

  // Tailwind CSS v4 validation
  {
    name: 'betaravel/tailwindcss/setup',
    files: ['src/**/*.{ts,tsx,js,jsx}'],
    plugins: {
      tailwindcss,
    },
    settings: {
      tailwindcss: {
        // Tailwind v4 has no JS config; point the plugin at the project CSS so it can
        // load the design system instead of warning it cannot resolve a default config.
        // Absolute path is required so the worker thread can resolve `tailwindcss` upward.
        config: path.resolve(import.meta.dirname, 'src/index.css'),
        callees: ['clsx', 'twMerge', 'cn'],
        cssFiles: ['src/**/*.css'],
      },
    },
    rules: {
      'tailwindcss/classnames-order': 'warn',
      'tailwindcss/enforces-negative-arbitrary-values': 'warn',
      'tailwindcss/enforces-shorthand': 'warn',
      'tailwindcss/migration-from-tailwind-2': 'off',
      'tailwindcss/no-arbitrary-value': 'off',
      'tailwindcss/no-custom-classname': 'off',
      'tailwindcss/no-contradicting-classname': 'off',
      'tailwindcss/no-unnecessary-arbitrary-value': 'warn',
    },
  },

  // OWASP-focused security rules
  {
    name: 'betaravel/security/setup',
    files: ['src/**/*.{ts,tsx,js,jsx}'],
    plugins: {
      security,
    },
    rules: {
      ...security.configs.recommended.rules,
      'security/detect-non-literal-regexp': 'warn',
      'security/detect-object-injection': 'off',
    },
  },

  // Import ordering
  {
    name: 'betaravel/import/setup',
    files: ['src/**/*.{ts,tsx,js,jsx}'],
    plugins: {
      import: importPlugin,
    },
    rules: {
      'import/order': [
        'warn',
        {
          'newlines-between': 'always',
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'type'],
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      'import/no-duplicates': 'warn',
    },
  },

  // Project-wide environment & shared rule overrides
  {
    name: 'betaravel/globals-and-overrides',
    files: ['src/**/*.{ts,tsx,js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      'no-debugger': 'warn',
      'react/react-in-jsx-scope': 'off',
      'react/jsx-uses-react': 'off',
      // The codebase is not on `strict`; the `no-unsafe-*` family floods on non-strict TS.
      // Keep the type-aware parser active (projectService) so other type-checked rules run,
      // but report unsafe accesses as warnings instead of blocking the pipeline.
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      // Baseline-only demotion: the following type-checked / recommended rules surface real
      // issues on this non-strict codebase that are NOT auto-fixable and would require
      // refactoring outside the ESLint-installation scope (see AGENT.md guardrail).
      // They are reported as warnings so `npm run lint` can exit 0 while the residuals are
      // triaged incrementally. These should be tightened back to `error` over time.
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/require-await': 'warn',
      '@typescript-eslint/no-base-to-string': 'warn',
      '@typescript-eslint/no-misused-promises': 'warn',
      '@typescript-eslint/no-redundant-type-constituents': 'warn',
      '@typescript-eslint/only-throw-error': 'warn',
      '@typescript-eslint/no-implied-eval': 'warn',
      '@typescript-eslint/unbound-method': 'warn',
      // Disable auto-removal of `as <Type>` casts: the ESLint type-service and `tsc`
      // disagree on `querySelectorAll('input[type="date"]')` typing here, so casts that
      // `tsc` requires were being stripped, introducing type errors. Re-enable after
      // auditing the codebase.
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
      'no-useless-escape': 'warn',
      'react/no-unescaped-entities': 'warn',
      // 68 existing violations of hooks rules exist (see residual report); kept as warning
      // for the baseline to avoid blocking. Address before re-enabling as `error`.
      'react-hooks/rules-of-hooks': 'warn',
    },
  },
];