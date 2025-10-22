/**
 * Options for URL validation
 */
export interface EnsureTrustedUrlOptions {
  /**
   * Allow URLs with different origins than the current page.
   * Default: false
   */
  allowCrossOrigin?: boolean;

  /**
   * Allowed URL protocols. Default: ['http:', 'https:']
   * Relative URLs (no protocol) are always allowed.
   */
  allowedProtocols?: string[];

  /**
   * List of allowed origins. Does not include the current origin.
   */
  allowedOrigins?: string[];
}

export type TrustedUrl<T extends string = string> = T & {
  readonly __brand: "TrustedUrl";
};

/**
 * Validates that a URL is safe for redirection by checking:
 * 1. The URL can be parsed
 * 2. The protocol is in the allowed list (default: http, https, or relative)
 * 3. For absolute URLs, the origin matches the current origin (unless allowCrossOrigin is true)
 *
 * @param url - The URL to validate
 * @param options - Validation options
 * @returns The validated URL
 * @throws {TypeError} If the URL is invalid or unsafe
 *
 * @example
 * ```typescript
 * // Safe - same origin
 * location.href = ensureTrustedUrl("/dashboard");
 *
 * // Safe - validated user input
 * const userUrl = new URLSearchParams(window.location.search).get("returnUrl");
 * if (userUrl) {
 *   location.href = ensureTrustedUrl(userUrl);
 * }
 *
 * // Throws - cross-origin without permission
 * location.href = ensureTrustedUrl("https://evil.com");
 *
 * // Safe - cross-origin allowed
 * location.href = ensureTrustedUrl("https://trusted.com", {
 *   allowedOrigins: ["https://trusted.com"]
 * });
 * ```
 */
export function ensureTrustedUrl<T extends string>(
  url: T,
  options: EnsureTrustedUrlOptions = {}
): TrustedUrl<T> {
  // @ts-expect-error - we do not have browser types
  const win = window as unknown;
  const currentOrigin =
    typeof win === "object" &&
    win &&
    "location" in win &&
    typeof win.location === "object" &&
    win.location &&
    "origin" in win.location &&
    typeof win.location.origin === "string"
      ? win.location.origin
      : undefined;

  const defaultAllowedOrigins = currentOrigin ? [currentOrigin] : [];

  const {
    allowCrossOrigin = false,
    allowedProtocols = ["http:", "https:"],
    allowedOrigins = defaultAllowedOrigins,
  } = options;

  if (!url || typeof url !== "string") {
    throw new TypeError("URL must be a non-empty string");
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url, currentOrigin);
  } catch (error) {
    throw new TypeError(
      `Invalid URL: ${url}. ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  if (!allowedProtocols.includes(parsedUrl.protocol)) {
    throw new TypeError(`Unsafe URL protocol: ${parsedUrl.protocol}`);
  }

  const isAllowedOrigin = allowedOrigins.includes(parsedUrl.origin);

  if (!isAllowedOrigin && !allowCrossOrigin) {
    throw new TypeError(`Cross-origin URL not allowed: ${parsedUrl.origin}`);
  }

  // Additional security checks for dangerous URL patterns for potential browser parsing bugs
  const normalizedUrl = url.toLowerCase().replace(/[^a-z:]/g, "");
  if (normalizedUrl.startsWith("javascript:")) {
    throw new TypeError(`Potentially dangerous URL protocol detected: ${url}`);
  }

  return url as TrustedUrl<T>;
}

export function isTrustedUrl<T extends string>(
  url: T,
  options: EnsureTrustedUrlOptions = {}
): url is TrustedUrl<T> {
  try {
    ensureTrustedUrl(url, options);
    return true;
  } catch {
    return false;
  }
}
