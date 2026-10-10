import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  { ignores: ['**/node_modules/**', '**/dist/**', '**/coverage/**', 'apps/api/uploads/**'] },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...globals.node, ...globals.browser } },
    rules: { 'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }] },
  },
  {
    files: ['apps/web/**/*.{js,jsx}'],
    plugins: { react, 'react-hooks': reactHooks },
    settings: { react: { version: '18' } },
    languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
    rules: { ...react.configs.recommended.rules, ...reactHooks.configs.recommended.rules, 'react/prop-types': 'off', 'react/react-in-jsx-scope': 'off', 'no-alert': 'error' },
  },
];
