/**
 * Runtime utilities for validating URLs in your application code.
 * Import these in your application to validate redirect URLs at runtime.
 *
 * @example
 * ```typescript
 * import { ensureTrustedUrl } from 'eslint-plugin-dom-security/runtime';
 *
 * const userUrl = searchParams.get('returnUrl');
 * if (userUrl) {
 *   location.href = ensureTrustedUrl(userUrl);
 * }
 * ```
 */

export {
  ensureTrustedUrl,
  type TrustedUrl,
  type EnsureTrustedUrlOptions,
} from "./ensure-trusted-url.js";
