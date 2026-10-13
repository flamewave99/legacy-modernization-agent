// @ts-check
import eslint from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    // Allowlist: lint modern/, scripts/ and this file, nothing else. The rest is frozen (legacy/,
    // tests/), protected, generated, or a separate package with its own tsconfig and tests (rag/,
    // mcp/), and a new top-level path stays out until it is listed here (NOTES N74).
    ignores: [
      '*',
      '!modern/',
      '!scripts/',
      '!eslint.config.mjs',
      '**/node_modules/',
      '**/dist/',
      '**/coverage/',
      'modern/web/public/resources/',
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
