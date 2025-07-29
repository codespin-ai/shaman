import baseConfig from '../../eslint.config.js';

export default [
  ...baseConfig,
  {
    ignores: ['src/generated/**/*']
  },
  {
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname
      }
    }
  }
];
