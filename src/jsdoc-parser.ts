/**
 * JSDoc parsing utilities
 */

import ts from 'typescript';
import type { SlotDocs, CssPropertyDocs, CssPartDocs } from './types.js';

export interface JSDocInfo {
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
}

/**
 * Parse JSDoc comments from a node
 */
export function parseJsDoc(
  node: ts.Node,
  sourceFile: ts.SourceFile
): JSDocInfo {
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
export function parseSlotTag(comment: string): SlotDocs {
  const match = comment.match(/^(\S+)?\s*-?\s*(.+)?$/);
  if (match) {
    let name = match[1] || '';
    const description = match[2]?.trim();

    // If name is just "-", it means this is a default slot with format: @slot - description
    if (name === '-') {
      name = '';
    }

    return { name, description };
  }
  return { name: '', description: comment };
}

/**
 * Parse @cssprop tag
 * Format: @cssprop --property-name - description [default: value]
 */
export function parseCssPropTag(comment: string): CssPropertyDocs {
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
export function parseCssPartTag(comment: string): CssPartDocs {
  const match = comment.match(/^(\S+)\s*-?\s*(.+)?$/);
  if (match) {
    const name = match[1];
    const description = match[2]?.trim();
    return { name, description };
  }
  return { name: comment };
}
