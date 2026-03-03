export const withSearchInputAttributes = (attributes = {}) => ({
  type: "text",
  autocomplete: "off",
  autocapitalize: "none",
  autocorrect: "off",
  spellcheck: "false",
  enterkeyhint: "search",
  ...attributes,
});
