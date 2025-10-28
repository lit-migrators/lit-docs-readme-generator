/**
 * Lit component parser using TypeScript Compiler API
 */

import ts from 'typescript';
import { readFileSync } from 'node:fs';
import type {
  LitComponentDocs,
  PropertyDocs,
  EventDocs,
  MethodDocs,
  SlotDocs,
  CssPropertyDocs,
  CssPartDocs,
  ParameterDocs,
} from './types.js';

/**
 * Parse a Lit component file and extract documentation
 */
export function parseLitComponent(filePath: string): LitComponentDocs | null {
  const sourceCode = readFileSync(filePath, 'utf-8');
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceCode,
    ts.ScriptTarget.Latest,
    true
  );

  let componentDocs: LitComponentDocs | null = null;

  function visit(node: ts.Node) {
    // Look for class declarations
    if (ts.isClassDeclaration(node) && node.name) {
      // Check if it extends LitElement
      if (extendsLitElement(node)) {
        componentDocs = parseClassDeclaration(node, filePath, sourceFile);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return componentDocs;
}

/**
 * Check if a class extends LitElement
 */
function extendsLitElement(node: ts.ClassDeclaration): boolean {
  if (!node.heritageClauses) return false;

  for (const clause of node.heritageClauses) {
    if (clause.token === ts.SyntaxKind.ExtendsKeyword) {
      for (const type of clause.types) {
        const typeName = type.expression.getText();
        if (typeName === 'LitElement' || typeName.includes('LitElement')) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Parse class declaration into component docs
 */
function parseClassDeclaration(
  node: ts.ClassDeclaration,
  filePath: string,
  sourceFile: ts.SourceFile
): LitComponentDocs | null {
  const className = node.name?.getText() || 'Unknown';

  // Extract @customElement decorator
  const tagName = extractCustomElementTag(node);
  if (!tagName) {
    console.warn(`Class ${className} extends LitElement but has no @customElement decorator`);
    return null;
  }

  // Extract class-level JSDoc
  const classJsDoc = parseJsDoc(node, sourceFile);

  const properties: PropertyDocs[] = [];
  const methods: MethodDocs[] = [];
  const events: EventDocs[] = [];
  const slots: SlotDocs[] = [];
  const cssProperties: CssPropertyDocs[] = [];
  const cssParts: CssPartDocs[] = [];

  // Parse class members
  node.members.forEach((member) => {
    if (ts.isPropertyDeclaration(member)) {
      const prop = parseProperty(member, sourceFile);
      if (prop) properties.push(prop);
    } else if (ts.isMethodDeclaration(member)) {
      const method = parseMethod(member, sourceFile);
      if (method) methods.push(method);
    }
  });

  // Extract events from dispatchEvent calls
  const extractedEvents = extractEvents(node, sourceFile);
  events.push(...extractedEvents);

  // Extract slots, CSS properties, and parts from JSDoc
  if (classJsDoc.slots) {
    classJsDoc.slots.forEach((slot) => slots.push(slot));
  }
  if (classJsDoc.cssProperties) {
    classJsDoc.cssProperties.forEach((prop) => cssProperties.push(prop));
  }
  if (classJsDoc.cssParts) {
    classJsDoc.cssParts.forEach((part) => cssParts.push(part));
  }

  return {
    className,
    tagName,
    description: classJsDoc.description,
    usage: classJsDoc.usage,
    properties,
    events,
    methods,
    slots,
    cssProperties,
    cssParts,
    dependencies: classJsDoc.dependencies,
    filePath,
  };
}

/**
 * Extract @customElement decorator value
 */
function extractCustomElementTag(node: ts.ClassDeclaration): string | null {
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
 * Parse property declaration
 */
function parseProperty(
  node: ts.PropertyDeclaration,
  sourceFile: ts.SourceFile
): PropertyDocs | null {
  const name = node.name.getText();

  // Skip private properties
  if (node.modifiers?.some((m) => m.kind === ts.SyntaxKind.PrivateKeyword)) {
    return null;
  }

  // Skip static properties (like styles)
  if (node.modifiers?.some((m) => m.kind === ts.SyntaxKind.StaticKeyword)) {
    return null;
  }

  // Check for @property or @state decorator
  const decoratorInfo = extractPropertyDecorator(node);

  // Only include properties with @property or @state decorator
  if (!decoratorInfo) {
    return null;
  }

  const jsDoc = parseJsDoc(node, sourceFile);
  const type = node.type ? node.type.getText() : 'any';
  let defaultValue = node.initializer ? node.initializer.getText() : undefined;

  // Sanitize default values for markdown tables
  if (defaultValue) {
    defaultValue = sanitizeDefaultValue(defaultValue);
  }

  return {
    name,
    attribute: decoratorInfo?.attribute,
    description: jsDoc.description,
    type,
    default: defaultValue,
    reflects: decoratorInfo?.reflects,
    state: decoratorInfo?.state,
    required: jsDoc.required,
    deprecated: jsDoc.deprecated,
  };
}

/**
 * Sanitize default value for markdown display
 */
function sanitizeDefaultValue(value: string): string {
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

/**
 * Extract @property or @state decorator information
 */
function extractPropertyDecorator(
  node: ts.PropertyDeclaration
): { attribute?: string; reflects?: boolean; state?: boolean } | null {
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
              }
            }
          });

          return { attribute, reflects };
        }
        return {};
      }
    }
  }

  return null;
}

/**
 * Parse method declaration
 */
function parseMethod(
  node: ts.MethodDeclaration,
  sourceFile: ts.SourceFile
): MethodDocs | null {
  const name = node.name.getText();

  // Skip private methods and lifecycle methods
  if (
    node.modifiers?.some((m) => m.kind === ts.SyntaxKind.PrivateKeyword) ||
    name.startsWith('_') ||
    isLifecycleMethod(name)
  ) {
    return null;
  }

  const jsDoc = parseJsDoc(node, sourceFile);
  const isAsync = node.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword);

  const parameters: ParameterDocs[] = [];
  node.parameters.forEach((param) => {
    const paramName = param.name.getText();
    const paramType = param.type ? param.type.getText() : 'any';
    const paramDefault = param.initializer ? param.initializer.getText() : undefined;
    const optional = !!param.questionToken || !!param.initializer;

    parameters.push({
      name: paramName,
      type: paramType,
      description: jsDoc.params?.[paramName],
      optional,
      default: paramDefault,
    });
  });

  let returns: { type: string; description?: string } | undefined;
  if (node.type) {
    returns = {
      type: node.type.getText(),
      description: jsDoc.returns,
    };
  }

  return {
    name,
    description: jsDoc.description,
    parameters,
    returns,
    async: isAsync,
    deprecated: jsDoc.deprecated,
  };
}

/**
 * Check if method is a Lit lifecycle method
 */
function isLifecycleMethod(name: string): boolean {
  const lifecycleMethods = [
    'connectedCallback',
    'disconnectedCallback',
    'attributeChangedCallback',
    'adoptedCallback',
    'render',
    'update',
    'updated',
    'firstUpdated',
    'willUpdate',
    'shouldUpdate',
    'createRenderRoot',
    'performUpdate',
  ];
  return lifecycleMethods.includes(name);
}

/**
 * Extract events from dispatchEvent calls
 */
function extractEvents(
  node: ts.ClassDeclaration,
  sourceFile: ts.SourceFile
): EventDocs[] {
  const events: EventDocs[] = [];
  const eventMap = new Map<string, EventDocs>();

  function visitNode(n: ts.Node) {
    // Look for this.dispatchEvent calls
    if (ts.isCallExpression(n)) {
      if (
        ts.isPropertyAccessExpression(n.expression) &&
        n.expression.name.getText() === 'dispatchEvent'
      ) {
        const arg = n.arguments[0];
        if (arg && ts.isNewExpression(arg)) {
          const eventName = extractEventName(arg);
          if (eventName && !eventMap.has(eventName)) {
            const detail = extractEventDetail(arg);
            const options = extractEventOptions(arg);

            eventMap.set(eventName, {
              name: eventName,
              detail,
              bubbles: options.bubbles,
              composed: options.composed,
              cancelable: options.cancelable,
            });
          }
        }
      }
    }

    ts.forEachChild(n, visitNode);
  }

  node.members.forEach((member) => visitNode(member));

  return Array.from(eventMap.values());
}

/**
 * Extract event name from CustomEvent constructor
 */
function extractEventName(node: ts.NewExpression): string | null {
  const args = node.arguments;
  if (args && args.length > 0 && ts.isStringLiteral(args[0])) {
    return args[0].text;
  }
  return null;
}

/**
 * Extract event detail type from CustomEvent
 */
function extractEventDetail(node: ts.NewExpression): string | undefined {
  if (node.typeArguments && node.typeArguments.length > 0) {
    return node.typeArguments[0].getText();
  }
  return undefined;
}

/**
 * Extract event options (bubbles, composed, cancelable)
 */
function extractEventOptions(node: ts.NewExpression): {
  bubbles?: boolean;
  composed?: boolean;
  cancelable?: boolean;
} {
  const args = node.arguments;
  if (args && args.length > 1 && ts.isObjectLiteralExpression(args[1])) {
    const options = args[1];
    const result: any = {};

    options.properties.forEach((prop) => {
      if (ts.isPropertyAssignment(prop)) {
        const propName = prop.name.getText();
        if (['bubbles', 'composed', 'cancelable'].includes(propName)) {
          result[propName] = prop.initializer.getText() === 'true';
        }
      }
    });

    return result;
  }
  return {};
}

/**
 * Parse JSDoc comments
 */
function parseJsDoc(
  node: ts.Node,
  sourceFile: ts.SourceFile
): {
  description?: string;
  params?: Record<string, string>;
  returns?: string;
  required?: boolean;
  deprecated?: boolean | string;
  slots?: SlotDocs[];
  cssProperties?: CssPropertyDocs[];
  cssParts?: CssPartDocs[];
  usage?: string[];
  dependencies?: string[];
} {
  const jsDocTags = ts.getJSDocTags(node);
  const jsDocComments = (node as any).jsDoc;

  let description: string | undefined;
  let params: Record<string, string> | undefined;
  let returns: string | undefined;
  let required = false;
  let deprecated: boolean | string = false;
  const slots: SlotDocs[] = [];
  const cssProperties: CssPropertyDocs[] = [];
  const cssParts: CssPartDocs[] = [];
  const usage: string[] = [];
  const dependencies: string[] = [];

  // Extract description from JSDoc comment
  if (jsDocComments && jsDocComments.length > 0) {
    const comment = jsDocComments[0];
    if (comment.comment) {
      description = typeof comment.comment === 'string'
        ? comment.comment
        : comment.comment.map((c: any) => c.text).join('');
    }
  }

  // Parse JSDoc tags
  jsDocTags.forEach((tag) => {
    const tagName = tag.tagName.getText();
    const tagComment = typeof tag.comment === 'string'
      ? tag.comment
      : tag.comment?.map((c: any) => c.text).join('') || '';

    switch (tagName) {
      case 'param':
        if (!params) params = {};
        if (ts.isJSDocParameterTag(tag) && tag.name) {
          const paramName = tag.name.getText();
          params[paramName] = tagComment;
        }
        break;

      case 'returns':
      case 'return':
        returns = tagComment;
        break;

      case 'required':
        required = true;
        break;

      case 'deprecated':
        deprecated = tagComment || true;
        break;

      case 'slot':
        slots.push(parseSlotTag(tagComment));
        break;

      case 'cssprop':
      case 'cssproperty':
        cssProperties.push(parseCssPropTag(tagComment));
        break;

      case 'part':
        cssParts.push(parseCssPartTag(tagComment));
        break;

      case 'example':
        usage.push(tagComment);
        break;

      case 'dependency':
        dependencies.push(tagComment);
        break;
    }
  });

  return {
    description,
    params,
    returns,
    required,
    deprecated,
    slots,
    cssProperties,
    cssParts,
    usage: usage.length > 0 ? usage : undefined,
    dependencies: dependencies.length > 0 ? dependencies : undefined,
  };
}

/**
 * Parse @slot tag
 * Format: @slot [name] - description
 */
function parseSlotTag(comment: string): SlotDocs {
  const match = comment.match(/^(\S+)?\s*-?\s*(.+)?$/);
  if (match) {
    const name = match[1] || '';
    const description = match[2]?.trim();
    return { name, description };
  }
  return { name: '', description: comment };
}

/**
 * Parse @cssprop tag
 * Format: @cssprop --property-name - description [default: value]
 */
function parseCssPropTag(comment: string): CssPropertyDocs {
  const match = comment.match(/^(--[\w-]+)\s*-?\s*(.+)?$/);
  if (match) {
    const name = match[1];
    let description = match[2]?.trim();
    let defaultValue: string | undefined;

    // Extract default value from description
    const defaultMatch = description?.match(/\[default:\s*(.+?)\]$/);
    if (defaultMatch) {
      defaultValue = defaultMatch[1].trim();
      description = description?.replace(/\s*\[default:.+\]$/, '').trim();
    }

    return { name, description, default: defaultValue };
  }
  return { name: comment };
}

/**
 * Parse @part tag
 * Format: @part name - description
 */
function parseCssPartTag(comment: string): CssPartDocs {
  const match = comment.match(/^(\S+)\s*-?\s*(.+)?$/);
  if (match) {
    const name = match[1];
    const description = match[2]?.trim();
    return { name, description };
  }
  return { name: comment };
}
