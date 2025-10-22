import noUnsafeRedirect from "./rules/no-unsafe-redirect.js";

const plugin = {
  meta: {
    name: "eslint-plugin-dom-security",
    version: "1.0.0",
  },
  rules: {
    "no-unsafe-redirect": noUnsafeRedirect,
  },
  configs: {},
};

plugin.configs = {
  recommended: {
    plugins: {
      "dom-security": plugin,
    },
    rules: {
      "dom-security/no-unsafe-redirect": "error",
    },
  },
};

export default plugin;

export { noUnsafeRedirect };
export const rules = plugin.rules;
export const configs = plugin.configs;

export {
  ensureTrustedUrl,
  isTrustedUrl,
  type TrustedUrl,
  type EnsureTrustedUrlOptions,
} from "./runtime/ensure-trusted-url.js";
