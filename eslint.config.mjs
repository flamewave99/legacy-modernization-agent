// @ts-check
import eslint from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    // Only modern/ and root config files are ours to lint; the rest is frozen or generated.
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      'legacy/**',
      'tests/**',
      'docker/**',
      'private/**',
      'logs/**',
      '.claude/**',
      '.devcontainer/**',
      '.github/**',
    ],
  },
  eslint.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      globals: { ...globals.node },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  prettier,
);
