/**
 * @filename: lint-staged.config.js
 * @type {import('lint-staged').Configuration}
 */
export default {
  "{,src/**/}*.{js,md,mjs,ts,tsx,yaml}": "prettier --write",
};
