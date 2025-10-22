# eslint-plugin-dom-security

ESLint plugin with type-aware rules for detecting unsafe frontend redirects.

## Installation

```bash
pnpm add -D eslint-plugin-dom-security @typescript-eslint/parser typescript
```

## Disclaimer

Using this plugin does _not_ prevent all unsafe redirects, but will detect most common ones. It should not be used as a reference for validating user-inputted code as there are various ways to fool analysis like this (using reflection, `Object.assign`, juggling variables). As long as your codebase uses regular ways to do redirection, this plugin should help in the vast majority of situations.

This plugin currently only focuses on programmatic redirection sinks. Links (`<a href=…>`), forms, iframes, meta tags, etc. are not included a the moment.

## Usage

### Using the Recommended Configuration

Add the plugin to your `eslint.config.mjs`:

```javascript
import domSecurity from "eslint-plugin-dom-security";
import typescriptParser from "@typescript-eslint/parser";

export default [
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "dom-security": domSecurity,
    },
    rules: {
      "dom-security/no-unsafe-redirect": "error",
    },
  },
];
```

### Using the Runtime Validation Utility

Import the `ensureTrustedUrl` function in your application code to validate URLs at runtime:

```typescript
import { ensureTrustedUrl } from "eslint-plugin-dom-security/runtime";

// Safe - validates the URL before redirecting
const userUrl = new URLSearchParams(window.location.search).get("returnUrl");
if (userUrl) {
  location.href = ensureTrustedUrl(userUrl);
}

// With options
location.href = ensureTrustedUrl(userUrl, {
  allowedOrigins: ["https://trusted.com"],
  allowedProtocols: ["http:", "https:"],
});
```

## Rules

### `no-unsafe-redirect`

Detects potentially unsafe frontend redirects using browser APIs like `location.href`, `window.open()`, etc.

#### Why This Rule?

Open redirect vulnerabilities occur when an application redirects users to URLs controlled by untrusted input. Attackers can exploit this to redirect users to malicious sites, enabling phishing attacks and credential theft. When the attacker can redirect to a `javascript:` protocol URL, it's possible to escalate the open redirect to DOM XSS.

This rule detects unsafe redirects in:

- `location.href` assignments
- `location.replace()` calls
- `location.assign()` calls
- `location` assignments
- `navigation.navigate()` calls
- `window.open()` calls

#### Examples

**Invalid** (will be flagged):

```typescript
// Direct assignment to location.href
location.href = someVariable; // ❌ Unsafe!

// Navigation function calls
location.replace(userInput); // ❌ Unsafe!
location.assign(getData()); // ❌ Unsafe!
window.open(someUrl); // ❌ Unsafe!

// Template literal starting with expression
location.href = `${userInput}/page`; // ❌ Unsafe!

// Template literal that could allow third-party redirection (`//example.com`)
location.href = `/${userInput}`; // ❌ Unsafe!

// Via variable
const loc = location;
loc.href = someVariable; // ❌ Unsafe!
```

**Valid** (safe patterns):

```typescript
// Redirect to string literal
location.href = "/dashboard"; // ✅ Safe
location.href = "https://example.com"; // ✅ Safe

// Template literals
location.href = `/dashboard`; // ✅ Safe
location.href = `/dashboard/${userId}`; // ✅ Safe
location.href = `/redirect?id=${id}`; // ✅ Safe

// Validated URL using the runtime utility
import { ensureTrustedUrl } from "eslint-plugin-dom-security/runtime";

location.href = ensureTrustedUrl(userInput); // ✅ Safe

// Custom validation function that returns TrustedUrl
function myValidator(url: string): TrustedUrl {
  // Your validation logic
}
location.href = myValidator(userInput); // ✅ Safe - typed as TrustedUrl

// Constant strings
const DASHBOARD_URL = "/dashboard" as const; // "as const" may be optional in some situations
location.href = DASHBOARD_URL; // ✅ Safe
```

**Note:** The rule uses TypeScript's type system to detect `TrustedUrl` types. Any function that returns a value typed as `TrustedUrl` will be considered safe, not just `ensureTrustedUrl()`.

## Runtime Utilities

### `ensureTrustedUrl(url, options?)`

Validates that a URL is safe for redirection.

**Parameters:**

- `url: string` - The URL to validate
- `options?: EnsureTrustedUrlOptions` - Optional configuration

**Returns:** `TrustedUrl` - A branded string type indicating validation

**Throws:** `TypeError` - If the URL is invalid or unsafe

**Options:**

```typescript
interface EnsureTrustedUrlOptions {
  // Allow cross-origin URLs (default: false)
  allowCrossOrigin?: boolean;

  // Allowed protocols (default: ['http:', 'https:'])
  allowedProtocols?: string[];

  // Allowed origins (default: current origin)
  allowedOrigins?: string[];
}
```

**Examples:**

```typescript
import { ensureTrustedUrl } from "eslint-plugin-dom-security/runtime";

// Basic usage - same origin only
const url = ensureTrustedUrl(userInput);
location.href = url;

// Allow specific trusted domains
location.href = ensureTrustedUrl(url, {
  allowedOrigins: ["https://trusted.example.com"],
});

// Allow all cross-origin (use with caution!)
location.href = ensureTrustedUrl(url, {
  allowCrossOrigin: true,
});

// Error handling
try {
  location.href = ensureTrustedUrl(userInput);
} catch (error) {
  console.error("Invalid redirect URL:", error.message);
  location.href = "/default-page";
}
```

**What it validates:**

1. URL can be parsed with the URL constructor
2. Protocol is safe/allowed
3. Origin is allowed
4. Blocks dangerous protocols like `javascript:`

### Creating Custom Validation Functions

You can create your own URL validation functions that work with the ESLint rule. The key is to return a value typed as `TrustedUrl`:

```typescript
import {
  ensureTrustedUrl,
  type TrustedUrl,
} from "eslint-plugin-dom-security/runtime";

// Example: Validate against an allowlist
function validateAllowedUrl(url: string): TrustedUrl {
  const allowedPaths = ["/dashboard", "/profile", "/settings"];

  const parsedUrl = new URL(url, window.location.origin);

  if (!allowedPaths.includes(parsedUrl.pathname)) {
    throw new TypeError(`URL path not in allowlist: ${parsedUrl.pathname}`);
  }

  // Use ensureTrustedUrl to do the final validation
  return ensureTrustedUrl(url);
}

// The ESLint rule will recognize this as safe!
location.href = validateAllowedUrl(userInput);
```

**Important:** The ESLint rule uses TypeScript's type checker to detect the `TrustedUrl` brand. This means it works with any function that returns `TrustedUrl`, but requires TypeScript for type checking. If TypeScript is not available, the plugin falls back to heuristics.

## Development

### Setup

1. Clone the repository
2. Install dependencies:

```bash
pnpm install
```

### Available Scripts

- `pnpm build` - Build the plugin for distribution
- `pnpm dev` - Build in watch mode
- `pnpm test` - Run tests
- `pnpm test:watch` - Run tests in watch mode
- `pnpm test:ui` - Run tests with UI
- `pnpm type-check` - Run TypeScript type checking
- `pnpm lint` - Lint the codebase

### Testing Locally

To test the plugin locally before publishing:

1. Build the plugin:

```bash
pnpm build
```

2. In your test project, install the plugin locally:

```bash
pnpm add -D file:/path/to/eslint-plugin-dom-security
```

3. Configure ESLint as shown in the usage section above.

## Security

If you discover a security vulnerability in this plugin, please report it privately through [GitHub's security advisory feature](https://github.com/jolle/eslint-plugin-dom-security/security/advisories/new). Please do not report security vulnerabilities through public GitHub issues.

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. If you are not able to submit a PR, please create an issue for any bugs or feature requests.
