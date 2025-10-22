import { AST_NODE_TYPES, type TSESTree } from "@typescript-eslint/utils";
import { SourceCode } from "@typescript-eslint/utils/ts-eslint";

/**
 * Checks if a node is a safe string literal (not dynamic)
 */
export function isSafeLiteral(node: TSESTree.Node): boolean {
  // String literals are safe
  if (node.type === AST_NODE_TYPES.Literal && typeof node.value === "string") {
    return true;
  }

  // Template literals without expressions are safe
  if (
    node.type === AST_NODE_TYPES.TemplateLiteral &&
    node.expressions.length === 0
  ) {
    return true;
  }

  return false;
}

/**
 * Checks if an identifier refers to a global variable (not shadowed by local scope)
 */
export function isGlobalIdentifier(
  node: TSESTree.Identifier,
  sourceCode: SourceCode
): boolean {
  const scope = sourceCode.getScope(node);
  const variable = scope.set.get(node.name);

  // If variable is not defined in any scope, it's global
  if (!variable) {
    return true;
  }

  // Check if all definitions are in the global scope
  return variable.defs.length === 0;
}

/**
 * Gets the base object from a member expression chain
 * E.g., window.location.href -> window
 */
export function getBaseObject(
  node: TSESTree.MemberExpression
): TSESTree.Expression {
  let current: TSESTree.Expression = node;

  while (current.type === AST_NODE_TYPES.MemberExpression) {
    current = current.object;
  }

  return current;
}

/**
 * Checks if a member expression is accessing a redirect-related property or method
 * Returns the type of redirect sink if it is one, null otherwise
 */
export function getRedirectSinkType(
  node: TSESTree.MemberExpression
): "href" | "replace" | "assign" | "navigate" | "location" | null {
  const { property } = node;

  if (property.type === AST_NODE_TYPES.Identifier) {
    switch (property.name) {
      case "href":
        return "href";
      case "replace":
        return "replace";
      case "assign":
        return "assign";
      case "navigate":
        return "navigate";
      default:
        return null;
    }
  }

  return null;
}

/**
 * Checks if a call expression looks like an open() call
 * Returns the callee identifier/member expression for further checking
 */
export function getOpenCallInfo(
  node: TSESTree.CallExpression
):
  | { type: "global"; identifier: TSESTree.Identifier }
  | { type: "method"; object: TSESTree.Expression }
  | null {
  const { callee } = node;

  // Direct call: open(...)
  if (callee.type === AST_NODE_TYPES.Identifier && callee.name === "open") {
    return { type: "global", identifier: callee };
  }

  // Method call: window.open(...) or someVar.open(...)
  if (
    callee.type === AST_NODE_TYPES.MemberExpression &&
    callee.property.type === AST_NODE_TYPES.Identifier &&
    callee.property.name === "open"
  ) {
    return { type: "method", object: callee.object };
  }

  return null;
}
