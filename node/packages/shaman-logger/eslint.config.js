import baseConfig from '../../eslint.config.js';

export default [
  ...baseConfig,
  {
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: {
      // Allow console methods only in this package
      'no-console': 'off'
    }
  }
];