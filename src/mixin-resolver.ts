/**
 * Mixin resolution and import handling utilities
 */

import ts from 'typescript';
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { dirname, resolve as resolvePath, basename as pathBasename, parse as parsePath, extname as pathExtname } from 'node:path';
import { parseJsDoc } from './jsdoc-parser.js';
import type { SlotDocs, CssPropertyDocs, CssPartDocs, PropertyDocs, EventDocs, MethodDocs } from './types.js';

export interface ClassDocParts {
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

export interface MixinDeclaration {
  classNode: ts.ClassLikeDeclarationBase;
  docNode: ts.Node;
  filePath: string;
}

export interface ImportRecord {
  filePath: string | null;
  exportName: string;
  type: 'named' | 'default' | 'namespace';
}

export interface FileInfo {
  filePath: string;
  sourceFile: ts.SourceFile;
  declarations: Map<string, MixinDeclaration>;
  imports: Map<string, ImportRecord>;
}

export interface MixinContext {
  docsCache: Map<string, ClassDocParts>;
  resolvingKeys: Set<string>;
  fileInfoMap: Map<string, FileInfo>;
}

/**
 * Extract mixin names from class heritage clauses
 */
export function extractMixinNamesFromClass(node: ts.ClassLikeDeclarationBase): string[] {
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

/**
 * Resolve mixin documentation recursively
 */
export function resolveMixinDocs(
  mixinName: string,
  context: MixinContext,
  filePath: string,
  collectClassDocPartsCallback: (node: ts.ClassLikeDeclarationBase, sourceFile: ts.SourceFile) => ClassDocParts
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
    const docs = buildDocsFromDeclaration(declaration, context, collectClassDocPartsCallback);
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
    const docs = resolveMixinDocs(importRecord.exportName, context, importRecord.filePath, collectClassDocPartsCallback);
    context.resolvingKeys.delete(key);

    if (docs) {
      const cloned = cloneClassDocParts(docs);
      context.docsCache.set(key, cloned);
      return cloneClassDocParts(cloned);
    }
  }

  return null;
}

/**
 * Merge class documentation parts
 */
export function mergeClassDocParts(target: ClassDocParts, source: ClassDocParts): void {
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

/**
 * Clone class documentation parts
 */
export function cloneClassDocParts(source: ClassDocParts): ClassDocParts {
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

/**
 * Create ClassDocParts from JSDoc info
 */
export function docPartsFromJsDoc(jsDoc: ReturnType<typeof parseJsDoc>): ClassDocParts {
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

/**
 * Ensure file info is loaded and cached
 */
export function ensureFileInfo(
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

// Private helper functions

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

function buildDocsFromDeclaration(
  declaration: MixinDeclaration,
  context: MixinContext,
  collectClassDocPartsCallback: (node: ts.ClassLikeDeclarationBase, sourceFile: ts.SourceFile) => ClassDocParts
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

  const docs = collectClassDocPartsCallback(declaration.classNode, fileInfo.sourceFile);

  if (declaration.docNode !== declaration.classNode) {
    const jsDoc = parseJsDoc(declaration.docNode, fileInfo.sourceFile);
    mergeClassDocParts(docs, docPartsFromJsDoc(jsDoc));
  }

  const mixinNames = extractMixinNamesFromClass(declaration.classNode);
  mixinNames.forEach((name) => {
    const depDocs = resolveMixinDocs(name, context, declaration.filePath, collectClassDocPartsCallback);
    if (depDocs) {
      mergeClassDocParts(docs, depDocs);
    }
  });

  return docs;
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

function resolveImportPath(specifier: string, fromFile: string): string | null {
  if (!specifier.startsWith('.') && !specifier.startsWith('/')) {
    return null;
  }

  const baseDir = dirname(fromFile);
  const rawPath = specifier.startsWith('.')
    ? resolvePath(baseDir, specifier)
    : resolvePath(specifier);

  const fallbackBase = pathBasename(specifier);

  const candidateBases = new Set<string>();
  addBasePathVariants(candidateBases, rawPath);
  if (fallbackBase) {
    addBasePathVariants(candidateBases, resolvePath(baseDir, fallbackBase));
  }

  for (const candidate of candidateBases) {
    const resolved = tryResolveFile(candidate);
    if (resolved) {
      return resolved;
    }
  }

  if (fallbackBase) {
    const searchDirs = new Set<string>();
    const rawDir = dirname(rawPath);
    if (rawDir) {
      searchDirs.add(rawDir);
    }
    searchDirs.add(baseDir);

    for (const dir of searchDirs) {
      const nearby = searchDirectoryForMatchingFile(dir, fallbackBase);
      if (nearby) {
        const resolved = tryResolveFile(nearby);
        if (resolved) {
          return resolved;
        }
      }
    }
  }

  return null;
}

const BASE_PATH_SUFFIXES = ['.mixin', '.mixins', '.component', '.element', '.lit', '.styles'];

function addBasePathVariants(target: Set<string>, basePath: string | null): void {
  if (!basePath) {
    return;
  }

  target.add(basePath);

  const parsed = parsePath(basePath);
  if (!parsed.ext) {
    const dir = parsed.dir || '.';
    const baseName = parsed.base;

    BASE_PATH_SUFFIXES.forEach((suffix) => {
      target.add(resolvePath(dir, `${baseName}${suffix}`));
    });
  }
}

const MATCHING_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.mjs', '.cjs', '.jsx']);

function searchDirectoryForMatchingFile(directory: string, baseName: string): string | null {
  if (!baseName) {
    return null;
  }

  try {
    const entries = readdirSync(directory, { withFileTypes: true });
    let bestMatch: { path: string; score: number } | null = null;

    for (const entry of entries) {
      const entryName = entry.name;

      if (entry.isFile()) {
        const extension = pathExtname(entryName);
        if (!MATCHING_EXTENSIONS.has(extension)) {
          continue;
        }
        if (!entryName.startsWith(baseName)) {
          continue;
        }

        const candidatePath = resolvePath(directory, entryName);
        const score = entryName.length - baseName.length;

        if (!bestMatch || score < bestMatch.score) {
          bestMatch = { path: candidatePath, score };
        }
      } else if (entry.isDirectory() && entryName.startsWith(baseName)) {
        const candidateDirectory = resolvePath(directory, entryName);
        const resolved = tryResolveFile(candidateDirectory);
        if (resolved) {
          return resolved;
        }
      }
    }

    return bestMatch?.path ?? null;
  } catch {
    return null;
  }
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
