import {
  AST_NODE_TYPES,
  ESLintUtils,
  ParserServicesWithTypeInformation,
  TSESTree,
} from "@typescript-eslint/utils";
import {
  isSafeLiteral,
  getRedirectSinkType,
  getOpenCallInfo,
  isGlobalIdentifier,
} from "../utils/index.js";
import { TypeChecker, Type } from "typescript";

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/jolle/eslint-plugin-dom-security/blob/main/docs/rules/${name}.md`
);

type MessageIds = "unsafeRedirect";
type Options = [];

interface VariableInfo {
  node: TSESTree.Identifier;
  isLocation: boolean;
  isNavigation: boolean;
  isWindow: boolean;
}

export default createRule<Options, MessageIds>({
  name: "no-unsafe-redirect",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow unsafe frontend redirects to untrusted URLs without validation",
    },
    messages: {
      unsafeRedirect:
        "Unsafe redirect detected. Make sure the URL is safe by doing one of the following:\n" +
        "1. Use ensureTrustedUrl() provided by eslint-plugin-dom-security to validate the URL\n" +
        "2. Use your own validator and cast the return type to TrustedUrl\n" +
        "3. Ignore this error with an explanation in a code comment attesting to the safety of the redirect",
    },
    schema: [],
  },

  defaultOptions: [],

  create(context) {
    let services: ParserServicesWithTypeInformation | null = null;
    let checker: TypeChecker | null = null;

    try {
      services = ESLintUtils.getParserServices(context);
      checker = services.program.getTypeChecker();
    } catch {}

    const trackedVariables = new Map<string, VariableInfo>();
    const withStack: Array<"location" | "navigation" | "window" | null> = [];

    function getType(node: TSESTree.Node): Type | null {
      if (!services || !checker) return null;
      try {
        const tsNode = services.esTreeNodeToTSNodeMap.get(node);
        return checker.getTypeAtLocation(tsNode);
      } catch {
        return null;
      }
    }

    /**
     * Checks if a type matches a specific type name by checking its symbol
     * Handles complex types like "Window & typeof globalThis" by checking constituent types
     */
    function hasTypeName(type: Type, typeName: string): boolean {
      if (!checker) return false;

      const symbol = type.getSymbol();
      if (symbol?.getName() === typeName) {
        return true;
      }

      if (type.isUnion()) {
        return type.types.some((t) => hasTypeName(t, typeName));
      }

      if (type.isIntersection()) {
        return type.types.some((t) => hasTypeName(t, typeName));
      }

      return false;
    }

    function isTrustedUrlType(type: Type): boolean {
      if (!checker) return false;

      const properties = type.getProperties();
      const brandProp = properties.find((prop) => prop.getName() === "__brand");

      if (!brandProp) {
        return false;
      }

      const brandType = checker.getTypeOfSymbol(brandProp);

      if (brandType.isStringLiteral()) {
        return brandType.value === "TrustedUrl";
      }

      return false;
    }

    function isValueSafe(node: TSESTree.Node): boolean {
      if (isSafeLiteral(node)) {
        return true;
      }

      if (
        node.type === AST_NODE_TYPES.TemplateLiteral &&
        node.expressions.length > 0
      ) {
        const firstQuasi = node.quasis[0];
        if (firstQuasi && firstQuasi.value.raw.length > 0) {
          if (/^[/\\]+$/.test(firstQuasi.value.raw)) {
            return false;
          }

          return true;
        }
        return false;
      }

      if (
        node.type === AST_NODE_TYPES.BinaryExpression &&
        node.operator === "+"
      ) {
        let leftmost = node.left;
        while (
          leftmost.type === AST_NODE_TYPES.BinaryExpression &&
          leftmost.operator === "+"
        ) {
          leftmost = leftmost.left;
        }

        if (
          leftmost.type === AST_NODE_TYPES.Literal &&
          typeof leftmost.value === "string"
        ) {
          if (/^[/\\]+$/.test(leftmost.value)) {
            return false;
          }
          return true;
        }

        if (
          leftmost.type === AST_NODE_TYPES.TemplateLiteral &&
          leftmost.quasis.length === 1
        ) {
          const value = leftmost.quasis[0]?.value.raw;
          if (value && value.length > 0) {
            if (/^[/\\]+$/.test(value)) {
              return false;
            }
            return true;
          }
        }

        return false;
      }

      const type = getType(node);
      if (type) {
        if (isTrustedUrlType(type)) {
          return true;
        }

        if (type.isStringLiteral()) {
          return true;
        }
      }

      if (node.type === AST_NODE_TYPES.CallExpression) {
        if (node.callee.type === AST_NODE_TYPES.Identifier) {
          if (node.callee.name === "ensureTrustedUrl") {
            return true;
          }
        }
      }

      return false;
    }

    function isRedirectObject(
      node: TSESTree.Expression
    ): "location" | "navigation" | "window" | null {
      const type = getType(node);
      if (type) {
        if (hasTypeName(type, "Location")) {
          return "location";
        }
        if (hasTypeName(type, "Window")) {
          return "window";
        }
        if (hasTypeName(type, "typeof globalThis")) {
          return "window";
        }
        // for our purposes, "Document" is the same as window as it also provides a "location" prop
        if (hasTypeName(type, "Document")) {
          return "window";
        }
      }

      if (node.type === AST_NODE_TYPES.Identifier) {
        const varInfo = trackedVariables.get(node.name);
        if (varInfo) {
          if (varInfo.isLocation) return "location";
          if (varInfo.isNavigation) return "navigation";
          if (varInfo.isWindow) return "window";
        }

        if (isGlobalIdentifier(node, context.sourceCode)) {
          if (node.name === "location") {
            return "location";
          }
          if (node.name === "window") {
            return "window";
          }
          if (node.name === "navigation") {
            return "navigation";
          }
        }
      }

      if (node.type === AST_NODE_TYPES.MemberExpression) {
        const { object, property } = node;

        if (
          object.type === AST_NODE_TYPES.Identifier &&
          property.type === AST_NODE_TYPES.Identifier
        ) {
          const isGlobal = isGlobalIdentifier(object, context.sourceCode);

          if (property.name === "location" && isGlobal) {
            if (
              object.name === "window" ||
              object.name === "document" ||
              object.name === "globalThis"
            ) {
              return "location";
            }
          }

          if (
            object.name === "window" &&
            property.name === "navigation" &&
            isGlobal
          ) {
            return "navigation";
          }
        }

        const objectType = isRedirectObject(object);
        if (
          objectType === "window" &&
          property.type === AST_NODE_TYPES.Identifier
        ) {
          if (property.name === "location") {
            return "location";
          }
          if (property.name === "navigation") {
            return "navigation";
          }
        }
      }

      return null;
    }

    function reportUnsafeRedirect(node: TSESTree.Node) {
      context.report({
        node,
        messageId: "unsafeRedirect",
      });
    }

    function getCurrentWithObject():
      | "location"
      | "navigation"
      | "window"
      | null {
      return withStack.length > 0
        ? withStack[withStack.length - 1] ?? null
        : null;
    }

    function unwrapChainExpression(node: TSESTree.Node): TSESTree.Node {
      if (node.type === AST_NODE_TYPES.ChainExpression) {
        return node.expression;
      }
      return node;
    }

    return {
      WithStatement(node) {
        const objectType = isRedirectObject(node.object);
        withStack.push(objectType);
      },

      "WithStatement:exit"() {
        withStack.pop();
      },

      VariableDeclarator(node) {
        if (node.id.type === AST_NODE_TYPES.Identifier && node.init) {
          const objectType = isRedirectObject(node.init);
          if (objectType) {
            trackedVariables.set(node.id.name, {
              node: node.id,
              isLocation: objectType === "location",
              isNavigation: objectType === "navigation",
              isWindow: objectType === "window",
            });
          }
        }
      },

      AssignmentExpression(node) {
        const { left, right } = node;
        const unwrappedLeft = unwrapChainExpression(left);

        if (unwrappedLeft.type === AST_NODE_TYPES.MemberExpression) {
          const { object, property } = unwrappedLeft;

          const sinkType = getRedirectSinkType(unwrappedLeft);
          if (sinkType && property.type === AST_NODE_TYPES.Identifier) {
            const objectType = isRedirectObject(object);
            if (objectType === "location") {
              if (!isValueSafe(right)) {
                reportUnsafeRedirect(right);
              }
              return;
            }
          }

          if (
            property.type === AST_NODE_TYPES.Identifier &&
            property.name === "location"
          ) {
            const objectType = isRedirectObject(object);
            if (objectType === "window") {
              if (!isValueSafe(right)) {
                reportUnsafeRedirect(right);
              }
              return;
            }

            if (
              object.type === AST_NODE_TYPES.Identifier &&
              isGlobalIdentifier(object, context.sourceCode)
            ) {
              if (object.name === "document" || object.name === "globalThis") {
                if (!isValueSafe(right)) {
                  reportUnsafeRedirect(right);
                }
              }
            }
          }

          if (unwrappedLeft.computed) {
            const objectType = isRedirectObject(object);
            if (objectType === "location") {
              if (!isValueSafe(right)) {
                reportUnsafeRedirect(right);
              }
            }
          }
        }

        if (left.type === AST_NODE_TYPES.Identifier) {
          const objectType = isRedirectObject(left);
          if (objectType === "location") {
            if (!isValueSafe(right)) {
              reportUnsafeRedirect(right);
            }
            return;
          }

          const withinObject = getCurrentWithObject();
          if (withinObject) {
            const leftType = getType(left);
            if (leftType) {
              const typeName = checker?.typeToString(leftType);
              if (typeName === "string" || typeName?.includes("Location")) {
                if (left.name === "href" && !isValueSafe(right)) {
                  reportUnsafeRedirect(right);
                  return;
                }
              }
            }

            if (withinObject === "location" && left.name === "href") {
              if (!isValueSafe(right)) {
                reportUnsafeRedirect(right);
              }
            }
          }
        }
      },

      CallExpression(node) {
        const { callee, arguments: args } = node;

        const openInfo = getOpenCallInfo(node);
        if (openInfo) {
          let isValidOpen = false;

          if (openInfo.type === "global") {
            isValidOpen = isGlobalIdentifier(
              openInfo.identifier,
              context.sourceCode
            );
          } else {
            const objectType = isRedirectObject(openInfo.object);
            isValidOpen = objectType === "window";
          }

          if (isValidOpen) {
            const urlArg = args[0];
            if (urlArg && !isValueSafe(urlArg)) {
              reportUnsafeRedirect(urlArg);
            }
          }
          return;
        }

        const unwrappedCallee = unwrapChainExpression(callee);

        if (unwrappedCallee.type === AST_NODE_TYPES.MemberExpression) {
          const sinkType = getRedirectSinkType(unwrappedCallee);

          if (sinkType === "replace" || sinkType === "assign") {
            const objectType = isRedirectObject(unwrappedCallee.object);
            if (objectType === "location") {
              const urlArg = args[0];
              if (urlArg && !isValueSafe(urlArg)) {
                reportUnsafeRedirect(urlArg);
              }
            }
          }

          if (sinkType === "navigate") {
            const objectType = isRedirectObject(unwrappedCallee.object);
            if (objectType === "navigation") {
              const urlArg = args[0];
              if (urlArg && !isValueSafe(urlArg)) {
                reportUnsafeRedirect(urlArg);
              }
            }
          }
        }

        if (callee.type === AST_NODE_TYPES.Identifier) {
          const withinObject = getCurrentWithObject();
          if (withinObject === "location") {
            if (callee.name === "replace" || callee.name === "assign") {
              const urlArg = args[0];
              if (urlArg && !isValueSafe(urlArg)) {
                reportUnsafeRedirect(urlArg);
              }
            }
          }
        }
      },
    };
  },
});
