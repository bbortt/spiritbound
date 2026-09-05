export default {
  '{,**/}*.{cjs,js,json,md,mjs,ts,tsx,xml,yaml,yml}': ['prettier --write'],
  '{,**/}*.md': ['markdownlint --rules markdownlint-sentences-per-line --fix'],
};
