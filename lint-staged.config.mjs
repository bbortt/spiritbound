export default {
  '{,**/}*.{ts,tsx}': [
    'node scripts/ensure-license-header.mjs',
    'prettier --write',
  ],
  '{,**/}*.{cjs,js,json,md,mjs,xml,yaml,yml}': ['prettier --write'],
  '{,**/}*.md': ['markdownlint --rules markdownlint-sentences-per-line --fix'],
};
