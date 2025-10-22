import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  ensureTrustedUrl,
  isTrustedUrl,
  type TrustedUrl,
} from "../../src/runtime/ensure-trusted-url.js";

describe("ensureTrustedUrl", () => {
  let originalWindow: typeof globalThis.window;

  beforeEach(() => {
    globalThis.window = {
      // @ts-expect-error - no browser types during tests
      location: {
        origin: "https://example.com",
      },
    };
  });

  afterEach(() => {
    // @ts-expect-error - no browser types during tests
    globalThis.window = originalWindow;
  });

  describe("valid URLs", () => {
    it("should allow relative URLs", () => {
      expect(ensureTrustedUrl("/dashboard")).toBe("/dashboard");
      expect(ensureTrustedUrl("/path/to/page")).toBe("/path/to/page");
      expect(ensureTrustedUrl("./relative")).toBe("./relative");
      expect(ensureTrustedUrl("../parent")).toBe("../parent");
    });

    it("should allow same-origin URLs", () => {
      expect(ensureTrustedUrl("https://example.com/page")).toBe(
        "https://example.com/page"
      );
      expect(ensureTrustedUrl("https://example.com:443/page")).toBe(
        "https://example.com:443/page"
      );
    });

    it("should allow URLs with hash fragments", () => {
      expect(ensureTrustedUrl("#section")).toBe("#section");
      expect(ensureTrustedUrl("/page#section")).toBe("/page#section");
    });

    it("should allow URLs with query strings", () => {
      expect(ensureTrustedUrl("/page?param=value")).toBe("/page?param=value");
      expect(ensureTrustedUrl("?param=value")).toBe("?param=value");
    });

    it("should allow cross-origin URLs when explicitly allowed via allowedOrigins", () => {
      const url = ensureTrustedUrl("https://trusted.com/page", {
        allowedOrigins: ["https://trusted.com"],
      });
      expect(url).toBe("https://trusted.com/page");
    });

    it("should allow cross-origin URLs when allowCrossOrigin is true", () => {
      const url = ensureTrustedUrl("https://other.com/page", {
        allowCrossOrigin: true,
      });
      expect(url).toBe("https://other.com/page");
    });

    it("should allow custom protocols when specified", () => {
      const url = ensureTrustedUrl("ftp://files.com/data", {
        allowedProtocols: ["ftp:"],
        allowCrossOrigin: true,
      });
      expect(url).toBe("ftp://files.com/data");
    });
  });

  describe("invalid URLs", () => {
    it("should throw on empty string", () => {
      expect(() => ensureTrustedUrl("")).toThrow(
        "URL must be a non-empty string"
      );
    });

    it("should throw on non-string input", () => {
      // @ts-expect-error - testing runtime behavior
      expect(() => ensureTrustedUrl(null)).toThrow(
        "URL must be a non-empty string"
      );
      // @ts-expect-error - testing runtime behavior
      expect(() => ensureTrustedUrl(undefined)).toThrow(
        "URL must be a non-empty string"
      );
      // @ts-expect-error - testing runtime behavior
      expect(() => ensureTrustedUrl(123)).toThrow(
        "URL must be a non-empty string"
      );
      // @ts-expect-error - testing runtime behavior
      expect(() => ensureTrustedUrl(["a", "b"])).toThrow(
        "URL must be a non-empty string"
      );
    });

    it("should throw on cross-origin URLs without permission", () => {
      expect(() => ensureTrustedUrl("https://evil.com/page")).toThrow(
        "Cross-origin URL not allowed"
      );
      expect(() => ensureTrustedUrl("http://other.com/page")).toThrow(
        "Cross-origin URL not allowed"
      );
      expect(() => ensureTrustedUrl("http://example.com@other.com")).toThrow(
        "Cross-origin URL not allowed"
      );
      expect(() => ensureTrustedUrl("http://other.com\\ @example.com")).toThrow(
        "Cross-origin URL not allowed"
      );
      expect(() => ensureTrustedUrl("http://xyzexample.com")).toThrow(
        "Cross-origin URL not allowed"
      );
    });

    it("should throw on disallow protocols", () => {
      expect(() => ensureTrustedUrl("javascript:alert(1)")).toThrow(
        "Unsafe URL protocol: javascript:"
      );

      expect(() =>
        ensureTrustedUrl("data:text/html,<script>alert(1)</script>", {
          allowCrossOrigin: true,
        })
      ).toThrow("Unsafe URL protocol: data:");

      expect(() =>
        ensureTrustedUrl("vbscript:msgbox(1)", {
          allowCrossOrigin: true,
        })
      ).toThrow("Unsafe URL protocol: vbscript:");
    });

    it("should throw on URLs not in allowedOrigins", () => {
      expect(() =>
        ensureTrustedUrl("https://evil.com/page", {
          allowedOrigins: ["https://trusted.com"],
        })
      ).toThrow("Cross-origin URL not allowed");
    });

    it("should throw on http when only https is allowed", () => {
      expect(() =>
        ensureTrustedUrl("http://example.com/page", {
          allowedProtocols: ["https:"],
          allowedOrigins: ["http://example.com"],
        })
      ).toThrow("Unsafe URL protocol: http:");
    });
  });

  describe("without window object", () => {
    beforeEach(() => {
      // @ts-expect-error - simulating non-browser environment
      globalThis.window = undefined;
    });

    it("should throw on relative URLs without base", () => {
      expect(() => ensureTrustedUrl("/dashboard")).toThrow("Invalid URL");
    });

    it("should validate absolute URLs with allowCrossOrigin", () => {
      expect(() => ensureTrustedUrl("https://example.com/page")).toThrow(
        "Cross-origin URL not allowed"
      );

      expect(
        ensureTrustedUrl("https://example.com/page", { allowCrossOrigin: true })
      ).toBe("https://example.com/page");
    });
  });
});

describe("isTrustedUrl", () => {
  beforeEach(() => {
    globalThis.window = {
      // @ts-expect-error - browser types during tests
      location: {
        origin: "https://example.com",
      },
    };
  });

  it("should return true for valid URLs", () => {
    expect(isTrustedUrl("/dashboard")).toBe(true);
    expect(isTrustedUrl("https://example.com/page")).toBe(true);
    expect(isTrustedUrl("#section")).toBe(true);
  });

  it("should return false for invalid URLs", () => {
    expect(isTrustedUrl("")).toBe(false);
    expect(isTrustedUrl("javascript:alert(1)")).toBe(false);
    expect(isTrustedUrl("https://evil.com/page")).toBe(false);
  });

  it("should work as type guard", () => {
    const url: string = "/dashboard";

    if (isTrustedUrl(url)) {
      const trusted: TrustedUrl = url;
      expect(trusted).toBe("/dashboard");
    } else {
      throw new Error("Should have been trusted");
    }
  });

  it("should respect options", () => {
    expect(isTrustedUrl("https://trusted.com/page")).toBe(false);
    expect(
      isTrustedUrl("https://trusted.com/page", {
        allowedOrigins: ["https://trusted.com"],
      })
    ).toBe(true);
  });
});
