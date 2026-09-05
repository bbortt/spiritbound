export default {
  endOfLine: 'lf',
  plugins: ['prettier-plugin-packagejson'],
  printWidth: 80,
  singleQuote: true,
  tabWidth: 2,
  useTabs: false,
  overrides: [
    {
      files: '**/*.{ts,tsx}',
      options: {
        parser: 'typescript',
      },
    },
  ],
};
