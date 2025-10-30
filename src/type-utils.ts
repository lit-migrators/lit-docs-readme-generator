/**
 * Type inference and normalization utilities
 */

import ts from 'typescript';

/**
 * Extract type from decorator expression
 */
export function getTypeFromDecoratorExpression(expression: ts.Expression): string | undefined {
  if (ts.isIdentifier(expression) || ts.isPropertyAccessExpression(expression)) {
    return normalizeDecoratorTypeName(expression.getText());
  }

  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
    return normalizeDecoratorTypeName(expression.text);
  }

  if (ts.isCallExpression(expression)) {
    return normalizeDecoratorTypeName(expression.expression.getText());
  }

  if (ts.isAsExpression(expression) || ts.isTypeAssertionExpression(expression)) {
    return getTypeFromDecoratorExpression(expression.expression);
  }

  return normalizeDecoratorTypeName(expression.getText());
}

/**
 * Normalize decorator type names (e.g., String -> string)
 */
export function normalizeDecoratorTypeName(raw: string): string | undefined {
  const cleaned = raw
    .replace(/Constructor$/u, '')
    .trim();

  switch (cleaned) {
    case 'String':
      return 'string';
    case 'Number':
      return 'number';
    case 'Boolean':
      return 'boolean';
    case 'Array':
      return 'unknown[]';
    case 'Object':
      return 'Record<string, unknown>';
    case 'Date':
      return 'Date';
    default:
      return cleaned || undefined;
  }
}

/**
 * Infer type from initializer expression
 */
export function inferTypeFromInitializer(initializer: ts.Expression): string | undefined {
  if (ts.isStringLiteral(initializer) || ts.isNoSubstitutionTemplateLiteral(initializer)) {
    return 'string';
  }

  if (
    initializer.kind === ts.SyntaxKind.TrueKeyword ||
    initializer.kind === ts.SyntaxKind.FalseKeyword
  ) {
    return 'boolean';
  }

  if (ts.isNumericLiteral(initializer) || initializer.kind === ts.SyntaxKind.BigIntLiteral) {
    return 'number';
  }

  if (ts.isPrefixUnaryExpression(initializer) && ts.isNumericLiteral(initializer.operand)) {
    return 'number';
  }

  if (ts.isArrayLiteralExpression(initializer)) {
    return 'unknown[]';
  }

  if (ts.isObjectLiteralExpression(initializer)) {
    return 'Record<string, unknown>';
  }

  if (ts.isTemplateExpression(initializer)) {
    return 'string';
  }

  if (initializer.kind === ts.SyntaxKind.NullKeyword) {
    return 'null';
  }

  if (ts.isIdentifier(initializer)) {
    const identifier = initializer.getText();
    if (identifier === 'undefined') {
      return 'undefined';
    }
  }

  return undefined;
}

/**
 * Sanitize default value for markdown display
 */
export function sanitizeDefaultValue(value: string): string {
  // Remove newlines and excessive whitespace
  value = value.replace(/\s+/g, ' ').trim();

  // Truncate very long values
  const maxLength = 50;
  if (value.length > maxLength) {
    value = value.substring(0, maxLength) + '...';
  }

  // Remove template literal backticks that could break markdown
  if (value.startsWith('css`') || value.startsWith('html`')) {
    return '(template)';
  }

  return value;
}
