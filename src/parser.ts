/**
 * Lit component parser using TypeScript Compiler API
 */

import ts from 'typescript';
import { readFileSync } from 'node:fs';
import { parseJsDoc } from './jsdoc-parser.js';
import { extractCustomElementTag, extractPropertyDecorator } from './decorator-parser.js';
import { inferTypeFromInitializer, sanitizeDefaultValue } from './type-utils.js';
import {
  type MixinContext,
  type ClassDocParts,
  extractMixinNamesFromClass,
  resolveMixinDocs,
  mergeClassDocParts,
  ensureFileInfo,
} from './mixin-resolver.js';
import type {
  LitComponentDocs,
  PropertyDocs,
  EventDocs,
  MethodDocs,
  ParameterDocs,
  SlotDocs,
  CssPropertyDocs,
  CssPartDocs,
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
  const mixinContext: MixinContext = {
    docsCache: new Map(),
    resolvingKeys: new Set(),
    fileInfoMap: new Map(),
  };

  ensureFileInfo(filePath, mixinContext, sourceFile);

  function visit(node: ts.Node) {
    // Look for class declarations
    if (ts.isClassDeclaration(node) && node.name) {
      // Check if it extends LitElement
      if (extendsLitElement(node)) {
        componentDocs = parseClassDeclaration(node, filePath, sourceFile, mixinContext);
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
  sourceFile: ts.SourceFile,
  mixinContext: MixinContext
): LitComponentDocs | null {
  const className = node.name?.getText() || 'Unknown';

  // Extract @customElement decorator
  const tagName = extractCustomElementTag(node);
  if (!tagName) {
    console.warn(`Class ${className} extends LitElement but has no @customElement decorator`);
    return null;
  }

  // Extract class-level JSDoc
  const classDocs = collectClassDocParts(node, sourceFile);

  const mixinNames = extractMixinNamesFromClass(node);
  for (const mixinName of mixinNames) {
    const mixinDocs = resolveMixinDocs(mixinName, mixinContext, filePath, collectClassDocParts);
    if (mixinDocs) {
      mixinDocs.methods = [];
      mergeClassDocParts(classDocs, mixinDocs);
    }
  }

  return {
    className,
    tagName,
    description: classDocs.description,
    usage: classDocs.usage,
    properties: classDocs.properties,
    events: classDocs.events,
    methods: classDocs.methods,
    slots: classDocs.slots,
    cssProperties: classDocs.cssProperties,
    cssParts: classDocs.cssParts,
    dependencies: classDocs.dependencies,
    filePath,
  };
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
  let type = node.type ? node.type.getText() : undefined;
  let defaultValue = node.initializer ? node.initializer.getText() : undefined;

  if (!type && decoratorInfo.type) {
    type = decoratorInfo.type;
  }

  if (!type && node.initializer) {
    type = inferTypeFromInitializer(node.initializer);
  }

  if (!type) {
    type = 'any';
  }

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
  node: ts.ClassLikeDeclarationBase,
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


function collectClassDocParts(
  node: ts.ClassLikeDeclarationBase,
  sourceFile: ts.SourceFile
): ClassDocParts {
  const classJsDoc = parseJsDoc(node, sourceFile);

  const docParts: ClassDocParts = {
    description: classJsDoc.description,
    usage: classJsDoc.usage ? [...classJsDoc.usage] : undefined,
    dependencies: classJsDoc.dependencies ? [...classJsDoc.dependencies] : undefined,
    slots: classJsDoc.slots ? classJsDoc.slots.map((slot) => ({ ...slot })) : [],
    cssProperties: classJsDoc.cssProperties ? classJsDoc.cssProperties.map((prop) => ({ ...prop })) : [],
    cssParts: classJsDoc.cssParts ? classJsDoc.cssParts.map((part) => ({ ...part })) : [],
    properties: [],
    events: [],
    methods: [],
  };

  node.members?.forEach((member) => {
    if (ts.isPropertyDeclaration(member)) {
      const prop = parseProperty(member as ts.PropertyDeclaration, sourceFile);
      if (prop) docParts.properties.push({ ...prop });
    } else if (ts.isMethodDeclaration(member)) {
      const method = parseMethod(member, sourceFile);
      if (method) {
        docParts.methods.push({
          ...method,
          parameters: method.parameters.map((param) => ({ ...param })),
          returns: method.returns ? { ...method.returns } : undefined,
        });
      }
    }
  });

  const extractedEvents = extractEvents(node, sourceFile);
  extractedEvents.forEach((event) => {
    docParts.events.push({ ...event });
  });

  return docParts;
}

