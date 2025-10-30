/**
 * Decorator parsing utilities for Lit components
 */

import ts from 'typescript';
import { getTypeFromDecoratorExpression } from './type-utils.js';

export interface PropertyDecoratorInfo {
  attribute?: string;
  reflects?: boolean;
  state?: boolean;
  type?: string;
}

/**
 * Extract @customElement decorator value from class
 */
export function extractCustomElementTag(node: ts.ClassDeclaration): string | null {
  if (!ts.canHaveDecorators(node)) return null;

  const decorators = ts.getDecorators(node);
  if (!decorators) return null;

  for (const decorator of decorators) {
    const expression = decorator.expression;
    if (ts.isCallExpression(expression)) {
      const decoratorName = expression.expression.getText();
      if (decoratorName === 'customElement') {
        const args = expression.arguments;
        if (args.length > 0 && ts.isStringLiteral(args[0])) {
          return args[0].text;
        }
      }
    }
  }

  return null;
}

/**
 * Extract @property or @state decorator information from property
 */
export function extractPropertyDecorator(
  node: ts.PropertyDeclaration
): PropertyDecoratorInfo | null {
  if (!ts.canHaveDecorators(node)) return null;

  const decorators = ts.getDecorators(node);
  if (!decorators) return null;

  for (const decorator of decorators) {
    const expression = decorator.expression;
    if (ts.isCallExpression(expression)) {
      const decoratorName = expression.expression.getText();

      if (decoratorName === 'state') {
        return { state: true };
      }

      if (decoratorName === 'property') {
        const args = expression.arguments;
        if (args.length > 0 && ts.isObjectLiteralExpression(args[0])) {
          const options = args[0];
          let attribute: string | undefined;
          let reflects: boolean | undefined;
          let decoratorType: string | undefined;

          options.properties.forEach((prop) => {
            if (ts.isPropertyAssignment(prop)) {
              const propName = prop.name.getText();
              if (propName === 'attribute') {
                if (ts.isStringLiteral(prop.initializer)) {
                  attribute = prop.initializer.text;
                } else if (prop.initializer.getText() === 'false') {
                  attribute = undefined; // No attribute
                }
              } else if (propName === 'reflect' && prop.initializer.getText() === 'true') {
                reflects = true;
              } else if (propName === 'type') {
                decoratorType = getTypeFromDecoratorExpression(prop.initializer);
              }
            }
          });

          return { attribute, reflects, type: decoratorType };
        }
        return {};
      }
    }
  }

  return null;
}
