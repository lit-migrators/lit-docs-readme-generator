/**
 * Lit component parser using TypeScript Compiler API
 */

import ts from 'typescript';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { dirname, resolve as resolvePath, basename as pathBasename } from 'node:path';

interface ClassDocParts {
  description?: string;
  usage?: string[];
  dependencies?: string[];
  slots: SlotDocs[];
  cssProperties: CssPropertyDocs[];
  cssParts: CssPartDocs[];
  properties: PropertyDocs[];
  events: EventDocs[];
  methods: MethodDocs[];
}

interface MixinDeclaration {
  classNode: ts.ClassLikeDeclarationBase;
  docNode: ts.Node;
  filePath: string;
}

interface ImportRecord {
  filePath: string | null;
  exportName: string;
  type: 'named' | 'default' | 'namespace';
}

interface FileInfo {
  filePath: string;
  sourceFile: ts.SourceFile;
  declarations: Map<string, MixinDeclaration>;
  imports: Map<string, ImportRecord>;
}

interface MixinContext {
  docsCache: Map<string, ClassDocParts>;
  resolvingKeys: Set<string>;
  fileInfoMap: Map<string, FileInfo>;
}
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
    const mixinDocs = resolveMixinDocs(mixinName, mixinContext, filePath);
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

function mergeClassDocParts(target: ClassDocParts, source: ClassDocParts): void {
  if (!target.description && source.description) {
    target.description = source.description;
  }

  if (source.usage && source.usage.length > 0) {
    target.usage ??= [];
    source.usage.forEach((example) => {
      if (!target.usage!.includes(example)) {
        target.usage!.push(example);
      }
    });
  }

  if (source.dependencies && source.dependencies.length > 0) {
    target.dependencies ??= [];
    source.dependencies.forEach((dependency) => {
      if (!target.dependencies!.includes(dependency)) {
        target.dependencies!.push(dependency);
      }
    });
  }

  source.properties.forEach((prop) => {
    if (!target.properties.some((existing) => existing.name === prop.name)) {
      target.properties.push({ ...prop });
    }
  });

  source.events.forEach((event) => {
    if (!target.events.some((existing) => existing.name === event.name)) {
      target.events.push({ ...event });
    }
  });

  source.methods.forEach((method) => {
    if (!target.methods.some((existing) => existing.name === method.name)) {
      target.methods.push({
        ...method,
        parameters: method.parameters.map((param) => ({ ...param })),
        returns: method.returns ? { ...method.returns } : undefined,
      });
    }
  });

  source.slots.forEach((slot) => {
    if (!target.slots.some((existing) => existing.name === slot.name)) {
      target.slots.push({ ...slot });
    }
  });

  source.cssProperties.forEach((prop) => {
    if (!target.cssProperties.some((existing) => existing.name === prop.name)) {
      target.cssProperties.push({ ...prop });
    }
  });

  source.cssParts.forEach((part) => {
    if (!target.cssParts.some((existing) => existing.name === part.name)) {
      target.cssParts.push({ ...part });
    }
  });
}

function cloneClassDocParts(source: ClassDocParts): ClassDocParts {
  return {
    description: source.description,
    usage: source.usage ? [...source.usage] : undefined,
    dependencies: source.dependencies ? [...source.dependencies] : undefined,
    slots: source.slots.map((slot) => ({ ...slot })),
    cssProperties: source.cssProperties.map((prop) => ({ ...prop })),
    cssParts: source.cssParts.map((part) => ({ ...part })),
    properties: source.properties.map((prop) => ({ ...prop })),
    events: source.events.map((event) => ({ ...event })),
    methods: source.methods.map((method) => ({
      ...method,
      parameters: method.parameters.map((param) => ({ ...param })),
      returns: method.returns ? { ...method.returns } : undefined,
    })),
  };
}

function extractMixinNamesFromClass(node: ts.ClassLikeDeclarationBase): string[] {
  const names: string[] = [];

  node.heritageClauses?.forEach((clause) => {
    if (clause.token === ts.SyntaxKind.ExtendsKeyword) {
      clause.types.forEach((type) => {
        names.push(...collectMixinNamesFromExpression(type.expression));
      });
    }
  });

  return Array.from(new Set(names.filter(Boolean)));
}

function collectMixinNamesFromExpression(expression: ts.Expression): string[] {
  if (ts.isCallExpression(expression)) {
    const results: string[] = [];
    const calleeName = getExpressionName(expression.expression);
    if (calleeName) {
      results.push(calleeName);
    }

    expression.arguments.forEach((arg) => {
      results.push(...collectMixinNamesFromExpression(arg));
    });

    return results;
  }

  const name = getExpressionName(expression);
  return name ? [name] : [];
}

function getExpressionName(expression: ts.Expression): string | null {
  if (ts.isIdentifier(expression)) {
    return expression.getText();
  }
  if (ts.isPropertyAccessExpression(expression)) {
    return expression.getText();
  }
  if (ts.isAsExpression(expression) || ts.isTypeAssertionExpression(expression)) {
    return getExpressionName(expression.expression);
  }
  if (ts.isParenthesizedExpression(expression)) {
    return getExpressionName(expression.expression);
  }
  return null;
}

function resolveMixinDocs(
  mixinName: string,
  context: MixinContext,
  filePath: string
): ClassDocParts | null {
  if (!mixinName) {
    return null;
  }

  const key = `${filePath}::${mixinName}`;

  const cached = context.docsCache.get(key);
  if (cached) {
    return cloneClassDocParts(cached);
  }

  if (context.resolvingKeys.has(key)) {
    return null;
  }

  const fileInfo = ensureFileInfo(filePath, context);
  if (!fileInfo) {
    return null;
  }

  const declaration = fileInfo.declarations.get(mixinName);
  if (declaration) {
    context.resolvingKeys.add(key);
    const docs = buildDocsFromDeclaration(declaration, context);
    context.resolvingKeys.delete(key);

    const cloned = cloneClassDocParts(docs);
    context.docsCache.set(key, cloned);
    return cloneClassDocParts(cloned);
  }

  const importRecord = fileInfo.imports.get(mixinName);
  if (importRecord && importRecord.filePath) {
    if (importRecord.type === 'namespace') {
      // Namespace imports (import * as) are not resolved automatically
      return null;
    }

    context.resolvingKeys.add(key);
    const docs = resolveMixinDocs(importRecord.exportName, context, importRecord.filePath);
    context.resolvingKeys.delete(key);

    if (docs) {
      const cloned = cloneClassDocParts(docs);
      context.docsCache.set(key, cloned);
      return cloneClassDocParts(cloned);
    }
  }

  return null;
}

function buildDocsFromDeclaration(
  declaration: MixinDeclaration,
  context: MixinContext
): ClassDocParts {
  const fileInfo = ensureFileInfo(declaration.filePath, context);
  if (!fileInfo) {
    return {
      properties: [],
      events: [],
      methods: [],
      slots: [],
      cssProperties: [],
      cssParts: [],
    };
  }

  const docs = collectClassDocParts(declaration.classNode, fileInfo.sourceFile);

  if (declaration.docNode !== declaration.classNode) {
    const jsDoc = parseJsDoc(declaration.docNode, fileInfo.sourceFile);
    mergeClassDocParts(docs, docPartsFromJsDoc(jsDoc));
  }

  const mixinNames = extractMixinNamesFromClass(declaration.classNode);
  mixinNames.forEach((name) => {
    const depDocs = resolveMixinDocs(name, context, declaration.filePath);
    if (depDocs) {
      mergeClassDocParts(docs, depDocs);
    }
  });

  return docs;
}

function ensureFileInfo(
  filePath: string,
  context: MixinContext,
  existingSourceFile?: ts.SourceFile
): FileInfo | null {
  if (context.fileInfoMap.has(filePath)) {
    return context.fileInfoMap.get(filePath)!;
  }

  let sourceFile = existingSourceFile;

  if (!sourceFile) {
    if (!existsSync(filePath)) {
      return null;
    }
    const sourceCode = readFileSync(filePath, 'utf-8');
    sourceFile = ts.createSourceFile(
      filePath,
      sourceCode,
      ts.ScriptTarget.Latest,
      true
    );
  }

  const declarations = collectMixinDeclarations(sourceFile, filePath);
  const imports = collectImportRecords(sourceFile, filePath);

  const info: FileInfo = {
    filePath,
    sourceFile,
    declarations,
    imports,
  };

  context.fileInfoMap.set(filePath, info);
  return info;
}

function collectMixinDeclarations(
  sourceFile: ts.SourceFile,
  filePath: string
): Map<string, MixinDeclaration> {
  const declarations = new Map<string, MixinDeclaration>();

  function visit(node: ts.Node) {
    if (ts.isVariableStatement(node)) {
      node.declarationList.declarations.forEach((declaration) => {
        if (ts.isIdentifier(declaration.name) && declaration.initializer) {
          const classNode = extractClassFromInitializer(declaration.initializer);
          if (classNode) {
            declarations.set(declaration.name.text, {
              classNode,
              docNode: declaration,
              filePath,
            });
          }
        }
      });
    } else if (ts.isFunctionDeclaration(node) && node.name) {
      const classNode = extractClassFromFunctionLike(node);
      if (classNode) {
        declarations.set(node.name.text, {
          classNode,
          docNode: node,
          filePath,
        });
      }
    } else if (ts.isExportAssignment(node)) {
      const classNode = extractClassFromExpression(node.expression);
      if (classNode) {
        declarations.set('default', {
          classNode,
          docNode: node,
          filePath,
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return declarations;
}

function collectImportRecords(
  sourceFile: ts.SourceFile,
  filePath: string
): Map<string, ImportRecord> {
  const imports = new Map<string, ImportRecord>();

  sourceFile.forEachChild((node) => {
    if (!ts.isImportDeclaration(node) || !node.importClause) {
      return;
    }

    if (!ts.isStringLiteral(node.moduleSpecifier)) {
      return;
    }

    const resolvedPath = resolveImportPath(node.moduleSpecifier.text, filePath);
    const importClause = node.importClause;

    if (importClause.name) {
      imports.set(importClause.name.getText(), {
        filePath: resolvedPath,
        exportName: 'default',
        type: 'default',
      });
    }

    if (importClause.namedBindings) {
      if (ts.isNamedImports(importClause.namedBindings)) {
        importClause.namedBindings.elements.forEach((element) => {
          const localName = element.name.getText();
          const exportedName = element.propertyName
            ? element.propertyName.getText()
            : element.name.getText();

          imports.set(localName, {
            filePath: resolvedPath,
            exportName: exportedName,
            type: 'named',
          });
        });
      } else if (ts.isNamespaceImport(importClause.namedBindings)) {
        const localName = importClause.namedBindings.name.getText();
        imports.set(localName, {
          filePath: resolvedPath,
          exportName: '*',
          type: 'namespace',
        });
      }
    }
  });

  return imports;
}

function docPartsFromJsDoc(jsDoc: ReturnType<typeof parseJsDoc>): ClassDocParts {
  return {
    description: jsDoc.description,
    usage: jsDoc.usage ? [...jsDoc.usage] : undefined,
    dependencies: jsDoc.dependencies ? [...jsDoc.dependencies] : undefined,
    slots: jsDoc.slots ? jsDoc.slots.map((slot) => ({ ...slot })) : [],
    cssProperties: jsDoc.cssProperties ? jsDoc.cssProperties.map((prop) => ({ ...prop })) : [],
    cssParts: jsDoc.cssParts ? jsDoc.cssParts.map((part) => ({ ...part })) : [],
    properties: [],
    events: [],
    methods: [],
  };
}

function resolveImportPath(specifier: string, fromFile: string): string | null {
  if (!specifier.startsWith('.') && !specifier.startsWith('/')) {
    return null;
  }

  const baseDir = dirname(fromFile);
  const rawPath = specifier.startsWith('.')
    ? resolvePath(baseDir, specifier)
    : resolvePath(specifier);

  const resolvedDirect = tryResolveFile(rawPath);
  if (resolvedDirect) {
    return resolvedDirect;
  }

  const fallbackBase = pathBasename(specifier);
  if (fallbackBase) {
    const fallbackPath = resolvePath(baseDir, fallbackBase);
    const resolvedFallback = tryResolveFile(fallbackPath);
    if (resolvedFallback) {
      return resolvedFallback;
    }
  }

  return null;
}

function tryResolveFile(basePath: string): string | null {
  const candidates = new Set<string>();
  const extensionPriority = ['.ts', '.tsx', '.mts', '.cts', '.js', '.mjs', '.cjs', '.jsx'];
  const knownExtensions = new Set(extensionPriority);
  const tsExtensions = new Set(['.ts', '.tsx', '.mts', '.cts']);
  const jsExtensions = new Set(['.js', '.mjs', '.cjs', '.jsx']);

  candidates.add(basePath);

  const lastSlash = Math.max(basePath.lastIndexOf('/'), basePath.lastIndexOf('\\'));
  const lastDot = basePath.lastIndexOf('.');
  const hasDot = lastDot > lastSlash;
  const currentExtension = hasDot ? basePath.slice(lastDot) : '';
  const extensionRecognized = hasDot && knownExtensions.has(currentExtension);

  if (!extensionRecognized) {
    extensionPriority.forEach((ext) => candidates.add(`${basePath}${ext}`));
  } else {
    const baseWithoutExt = basePath.slice(0, lastDot);
    if (jsExtensions.has(currentExtension)) {
      tsExtensions.forEach((ext) => candidates.add(`${baseWithoutExt}${ext}`));
    } else if (tsExtensions.has(currentExtension)) {
      jsExtensions.forEach((ext) => candidates.add(`${baseWithoutExt}${ext}`));
    }
  }

  for (const candidate of candidates) {
    try {
      if (!existsSync(candidate)) {
        continue;
      }
      const stats = statSync(candidate);
      if (stats.isFile()) {
        return candidate;
      }
      if (stats.isDirectory()) {
        for (const ext of extensionPriority) {
          const indexCandidate = resolvePath(candidate, `index${ext}`);
          try {
            if (existsSync(indexCandidate)) {
              const indexStats = statSync(indexCandidate);
              if (indexStats.isFile()) {
                return indexCandidate;
              }
            }
          } catch {
            // Ignore resolution errors
          }
        }
      }
    } catch {
      // Ignore resolution errors
    }
  }

  return null;
}

function extractClassFromInitializer(initializer: ts.Expression): ts.ClassLikeDeclarationBase | null {
  if (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer)) {
    return extractClassFromFunctionLike(initializer);
  }

  return extractClassFromExpression(initializer);
}

function extractClassFromFunctionLike(node: ts.FunctionLikeDeclarationBase): ts.ClassLikeDeclarationBase | null {
  if (!node.body) {
    return null;
  }

  if (ts.isBlock(node.body)) {
    // First, collect all class declarations in the function body
    const classDeclarations = new Map<string, ts.ClassLikeDeclarationBase>();
    for (const statement of node.body.statements) {
      if (ts.isClassDeclaration(statement) && statement.name) {
        classDeclarations.set(statement.name.getText(), statement);
      }
    }

    // Then look for return statements
    for (const statement of node.body.statements) {
      if (ts.isReturnStatement(statement) && statement.expression) {
        // First try to extract as expression
        const classNode = extractClassFromExpression(statement.expression);
        if (classNode) {
          return classNode;
        }

        // If that fails, check if the return expression is an identifier
        // that references a class declaration we found
        const returnedIdentifier = extractIdentifierFromExpression(statement.expression);
        if (returnedIdentifier) {
          const classDecl = classDeclarations.get(returnedIdentifier);
          if (classDecl) {
            return classDecl;
          }
        }
      }
    }

    if (classDeclarations.size > 0) {
      for (const classDecl of classDeclarations.values()) {
        if (classHasExtendsClause(classDecl)) {
          return classDecl;
        }
      }
      return classDeclarations.values().next().value ?? null;
    }
    return null;
  }

  return extractClassFromExpression(node.body);
}

/**
 * Extract identifier name from an expression, handling type assertions
 */
function extractIdentifierFromExpression(expression: ts.Expression): string | null {
  if (ts.isIdentifier(expression)) {
    return expression.getText();
  }
  if (ts.isAsExpression(expression) || ts.isTypeAssertionExpression(expression)) {
    return extractIdentifierFromExpression(expression.expression);
  }
  if (ts.isParenthesizedExpression(expression)) {
    return extractIdentifierFromExpression(expression.expression);
  }
  return null;
}

function extractClassFromExpression(expression: ts.Expression): ts.ClassLikeDeclarationBase | null {
  if (ts.isClassExpression(expression)) {
    return expression;
  }
  if (ts.isParenthesizedExpression(expression)) {
    return extractClassFromExpression(expression.expression);
  }
  if (ts.isAsExpression(expression) || ts.isTypeAssertionExpression(expression)) {
    return extractClassFromExpression(expression.expression);
  }
  return null;
}

function classHasExtendsClause(node: ts.ClassLikeDeclarationBase): boolean {
  const clauses = node.heritageClauses;
  if (!clauses) return false;

  for (const clause of clauses) {
    if (clause.token === ts.SyntaxKind.ExtendsKeyword && clause.types.length > 0) {
      return true;
    }
  }

  return false;
}
