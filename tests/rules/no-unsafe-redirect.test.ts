import { RuleTester, TestCaseError } from "@typescript-eslint/rule-tester";
import { describe, it, afterAll } from "vitest";
import rule from "../../src/rules/no-unsafe-redirect.js";

RuleTester.afterAll = afterAll;
RuleTester.it = it;
RuleTester.describe = describe;

const PREAMBLE = `
type TrustedUrl<T extends string = string> = T & { readonly __brand: "TrustedUrl" };
declare function ensureTrustedUrl<T extends string>(url: T): TrustedUrl<T>;
declare var someVariable: string;
declare var someFunction: () => string;
`;

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      projectService: {
        allowDefaultProject: ["*.ts"],
        defaultProject: "./tsconfig.test.json",
      },
      tsconfigRootDir: process.cwd(),
    },
  },
});

const defaultErrors: TestCaseError<"unsafeRedirect">[] = [
  {
    messageId: "unsafeRedirect",
  },
];

const sinks: [string, (content: string) => string][] = [
  ["location.href assignment", (content) => `location.href = ${content};`],
  ["location.replace call", (content) => `location.replace(${content});`],
  ["location.assign call", (content) => `location.assign(${content});`],
  ["location assignment", (content) => `location = ${content};`],
  ["navigation.navigate call", (content) => `navigation.navigate(${content});`],
  ["open call", (content) => `open(${content});`],

  [
    "window.location.href assignment",
    (content) => `window.location.href = ${content};`,
  ],
  [
    "window.location.replace call",
    (content) => `window.location.replace(${content});`,
  ],
  [
    "window.location.assign call",
    (content) => `window.location.assign(${content});`,
  ],
  ["window.location assignment", (content) => `window.location = ${content};`],
  [
    "window.navigation.navigate call",
    (content) => `window.navigation.navigate(${content});`,
  ],
  ["window.open call", (content) => `window.open(${content});`],

  [
    "location.href assignment, via variable",
    (content) => `var loc = location; loc.href = ${content};`,
  ],
  [
    "location.replace call, via variable",
    (content) => `var loc = location; loc.replace(${content});`,
  ],
  [
    "location.assign call, via variable",
    (content) => `var loc = location; loc.assign(${content});`,
  ],
  [
    "navigation.navigate call, via variable",
    (content) => `var n = navigation; n.navigate(${content});`,
  ],
  [
    "open call, via aliased window",
    (content) => `var w = window; w.open(${content});`,
  ],

  [
    "window.window.window.location assignment",
    (content) => `window.window.window.location = ${content};`,
  ],

  [
    "with(location) href assignment",
    (content) => `with(location) href = ${content};`,
  ],

  [
    "function parameter with Window, location assignment",
    (content) =>
      `const f = (w: Window, s: string) => { w.location = ${content} }`,
  ],
  [
    "function parameter with Location, location.href assignment",
    (content) =>
      `const f = (l: Location, s: string) => { l.href = ${content} }`,
  ],

  [
    "document.location assignment",
    (content) => `document.location = ${content};`,
  ],
  [
    "document.location.href assignment",
    (content) => `document.location.href = ${content};`,
  ],
  [
    "document alias assignment",
    (content) => `const d = document; d.location = ${content};`,
  ],
  [
    "globalThis.location assignment",
    (content) => `globalThis.location = ${content};`,
  ],
  [
    "globalThis.location.href assignment",
    (content) => `globalThis.location.href = ${content};`,
  ],
  [
    "globalThis alias assignment",
    (content) => `let g = globalThis; g.location.href = ${content};`,
  ],
  [
    'location["href"] assignment',
    (content) => `location["href"] = ${content};`,
  ],
  [
    'location[var="href"] assignment',
    (content) => `const x = \"href\"; location[x] = ${content};`,
  ],
  ["location?.href assignment", (content) => `location?.href = ${content};`],
  [
    "window?.location assignment",
    (content) => `window?.location = ${content};`,
  ],
];

ruleTester.run("no-unsafe-redirect", rule, {
  valid: [
    {
      name: "should allow location.href assignment to string literal",
      code: `
        location.href = "/dashboard";
        location.href = "#/1";
        location.href = "https://example.com";
      `,
    },
    {
      name: "should allow location.href assignment to safe template strings",
      code: `
        location.href = \`/dashboard\`;
        location.href = \`/dashboard/\${someVariable}\`;
      `,
    },
    {
      name: "should allow location.replace call to string literal",
      code: `
        location.replace("/dashboard");
        location.replace("#/1");
        location.replace("https://example.com");
      `,
    },
    {
      name: "should allow location.replace call to safe template strings",
      code: `
        location.replace(\`/dashboard\`);
        location.replace(\`/dashboard/\${someVariable}\`);
      `,
    },
    {
      name: "should allow location.assign call to string literal",
      code: `
        location.assign("/dashboard");
        location.assign("#/1");
        location.assign("https://example.com");
      `,
    },
    {
      name: "should allow location.assign call to safe template strings",
      code: `
        location.assign(\`/dashboard\`);
        location.assign(\`/dashboard/\${someVariable}\`);
      `,
    },
    {
      name: "should allow location assignment to string literal",
      code: `
        location = "/dashboard";
        window.location = "#/1";
        location = "https://example.com";
      `,
    },
    {
      name: "should allow location assignment to safe template strings",
      code: `
        location = \`/dashboard\`;
        location = \`/dashboard/\${someVariable}\`;
      `,
    },
    {
      name: "should allow navigation.navigate call to string literal",
      code: `
        navigation.navigate("/dashboard");
        navigation.navigate("#/1");
        navigation.navigate("https://example.com");
      `,
    },
    {
      name: "should allow navigation.navigate call to safe template strings",
      code: `
        navigation.navigate(\`/dashboard\`);
        navigation.navigate(\`/dashboard/\${someVariable}\`);
      `,
    },
    {
      name: "should allow open call to string literal",
      code: `
        window.open("/dashboard");
        open("#/1");
        window.open("https://example.com");
      `,
    },
    {
      name: "should allow open call to safe template strings",
      code: `
        window.open(\`/dashboard\`);
        open(\`/dashboard/\${someVariable}\`);
      `,
    },
    {
      name: "should allow validated URL",
      code:
        PREAMBLE +
        `
        location.href = ensureTrustedUrl(someVariable);
        window.open(ensureTrustedUrl(someVariable));
      `,
    },
    {
      name: "should allow validated URL from variable",
      code:
        PREAMBLE +
        `
        const safeVar = ensureTrustedUrl(someVariable);
        location.href = safeVar;
      `,
    },
    {
      name: "should allow constant string from variable",
      code: `
        const safeVar = "/dashboard" as const;
        location.href = safeVar;
        const safeVar2 = "/dashboard";
        location.href = safeVar2;
      `,
    },
    {
      name: "should allow using own function called 'open'",
      code: `
        const open = x => console.log(x);
        open(someVar);
      `,
    },
    {
      name: "should allow safe string concatenation",
      code: `
        location.href = "/dashboard/" + x;
      `,
    },
    {
      name: "should allow safe string concatenation with template string",
      code: `
        location.href = \`/dashboard/\` + x;
      `,
    },
  ],

  invalid: sinks.flatMap(([sinkName, construct]) => [
    {
      name: `should report ${sinkName} to unsafe variable`,
      code: construct("someVariable"),
      errors: defaultErrors,
    },
    {
      name: `should report ${sinkName} to unsafe template literal forming third-party origin`,
      // e.g., someVariable = "/example.com" causes redirection to "//example.com"
      code: construct("`/${someVariable}`"),
      errors: defaultErrors,
    },
    {
      name: `should report ${sinkName} to unsafe template literal forming third-party origin with backslash`,
      // e.g., someVariable = "/example.com" causes redirection to "//example.com"
      code: construct("`\\\\${someVariable}`"),
      errors: defaultErrors,
    },
    {
      name: `should report ${sinkName} to unsafe template literal`,
      code: construct("`${someVariable}?param1=a`"),
      errors: defaultErrors,
    },
    {
      name: `should report ${sinkName} to unsafe function call`,
      code: construct("someFunction()"),
      errors: defaultErrors,
    },
    {
      name: `should report ${sinkName} to unsafe string concatenation forming third-party origin`,
      code: construct('"/" + someVariable'),
      errors: defaultErrors,
    },
    {
      name: `should report ${sinkName} to unsafe string concatenation`,
      code: construct('someVariable + "/"'),
      errors: defaultErrors,
    },
  ]),
});
