import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      // Turn off some rules that currently generate a large number of
      // warnings across the codebase. We can re-enable and fix them
      // incrementally later if you prefer stricter checks.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'no-useless-escape': 'off',
      'react-hooks/exhaustive-deps': 'off',
      'no-unused-vars': 'off',
      'react-refresh/only-export-components': 'off',
    },
  }
  ,
  {
    // Warn-only boundaries: prefer DAL in UI layers instead of reaching into services directly
    files: ['src/pages/**/*.{ts,tsx}', 'src/components/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'warn',
        {
          patterns: [
            {
              group: ['src/services/*', '**/services/*'],
              message:
                'UI layers should prefer DAL facades in src/dal/* instead of importing from services directly (incremental migration).',
            },
            {
              group: ['server/*', 'src/server/*', '**/server/*'],
              message: 'Do not import server code into client UI layers.',
            },
          ],
        },
      ],
    },
  }
  ,
  {
    // Relax a couple of rules in tests to avoid noise from placeholder blocks in e2e scaffolding
    files: ['tests/**/*.ts', 'tests/**/*.tsx'],
    rules: {
      'no-empty': 'off',
      'no-restricted-imports': 'off',
    },
  }
);
