/**
 * Generate Stencil.js-compatible README markdown from Lit component docs
 */

import type { LitComponentDocs } from './types.js';

/**
 * Generate README markdown for a Lit component
 */
export function generateReadme(docs: LitComponentDocs): string {
  const sections: string[] = [];

  // Title
  sections.push(`# ${docs.tagName}`);
  sections.push('');

  // Description
  if (docs.description) {
    sections.push(docs.description);
    sections.push('');
  }

  // Usage examples
  if (docs.usage && docs.usage.length > 0) {
    sections.push('## Usage');
    sections.push('');
    docs.usage.forEach((example) => {
      sections.push('```html');
      sections.push(example);
      sections.push('```');
      sections.push('');
    });
  } else {
    // Generate basic usage example
    sections.push('## Usage');
    sections.push('');
    sections.push('```html');
    sections.push(`<${docs.tagName}></${docs.tagName}>`);
    sections.push('```');
    sections.push('');
  }

  // Properties
  if (docs.properties.length > 0) {
    sections.push('## Properties');
    sections.push('');
    sections.push(generatePropertiesTable(docs.properties));
    sections.push('');
  }

  // Events
  if (docs.events.length > 0) {
    sections.push('## Events');
    sections.push('');
    sections.push(generateEventsTable(docs.events));
    sections.push('');
  }

  // Methods
  if (docs.methods.length > 0) {
    sections.push('## Methods');
    sections.push('');
    sections.push(generateMethodsSection(docs.methods));
    sections.push('');
  }

  // Slots
  if (docs.slots.length > 0) {
    sections.push('## Slots');
    sections.push('');
    sections.push(generateSlotsTable(docs.slots));
    sections.push('');
  }

  // CSS Custom Properties
  if (docs.cssProperties.length > 0) {
    sections.push('## CSS Custom Properties');
    sections.push('');
    sections.push(generateCssPropertiesTable(docs.cssProperties));
    sections.push('');
  }

  // CSS Shadow Parts
  if (docs.cssParts.length > 0) {
    sections.push('## Shadow Parts');
    sections.push('');
    sections.push(generateCssPartsTable(docs.cssParts));
    sections.push('');
  }

  // Dependencies
  if (docs.dependencies && docs.dependencies.length > 0) {
    sections.push('## Dependencies');
    sections.push('');
    sections.push('### Depends on');
    sections.push('');
    docs.dependencies.forEach((dep) => {
      sections.push(`- ${dep}`);
    });
    sections.push('');
  }

  // Footer
  sections.push('---');
  sections.push('');
  sections.push(`*Built with [Lit](https://lit.dev/)*`);
  sections.push('');

  return sections.join('\n');
}

/**
 * Generate properties table
 */
function generatePropertiesTable(properties: LitComponentDocs['properties']): string {
  const lines: string[] = [];

  lines.push('| Property | Attribute | Description | Type | Default |');
  lines.push('| -------- | --------- | ----------- | ---- | ------- |');

  properties.forEach((prop) => {
    const name = prop.deprecated
      ? `~~\`${prop.name}\`~~${prop.state ? ' _(internal)_' : ''}`
      : `\`${prop.name}\`${prop.state ? ' _(internal)_' : ''}`;

    const attribute = prop.state
      ? '_internal_'
      : prop.attribute === undefined
      ? `\`${kebabCase(prop.name)}\``
      : prop.attribute === null
      ? '--'
      : `\`${prop.attribute}\``;

    let description = prop.description || '';
    if (prop.required) {
      description = `**(required)** ${description}`;
    }
    if (typeof prop.deprecated === 'string') {
      description += ` _Deprecated: ${prop.deprecated}_`;
    }

    const type = `\`${escapeMarkdown(prop.type)}\``;
    const defaultValue = prop.default ? `\`${escapeMarkdown(prop.default)}\`` : '--';

    lines.push(`| ${name} | ${attribute} | ${description} | ${type} | ${defaultValue} |`);
  });

  return lines.join('\n');
}

/**
 * Generate events table
 */
function generateEventsTable(events: LitComponentDocs['events']): string {
  const lines: string[] = [];

  lines.push('| Event | Description | Type |');
  lines.push('| ----- | ----------- | ---- |');

  events.forEach((event) => {
    const name = event.deprecated ? `~~\`${event.name}\`~~` : `\`${event.name}\``;

    let description = event.description || '';

    // Add event options to description
    const options: string[] = [];
    if (event.bubbles) options.push('bubbles');
    if (event.composed) options.push('composed');
    if (event.cancelable) options.push('cancelable');

    if (options.length > 0) {
      description += ` _(${options.join(', ')})_`;
    }

    if (typeof event.deprecated === 'string') {
      description += ` _Deprecated: ${event.deprecated}_`;
    }

    const type = event.detail
      ? `\`CustomEvent<${escapeMarkdown(event.detail)}>\``
      : `\`CustomEvent<any>\``;

    lines.push(`| ${name} | ${description} | ${type} |`);
  });

  return lines.join('\n');
}

/**
 * Generate methods section with detailed signatures
 */
function generateMethodsSection(methods: LitComponentDocs['methods']): string {
  const sections: string[] = [];

  methods.forEach((method, index) => {
    if (index > 0) sections.push('');

    const name = method.deprecated ? `~~\`${method.name}(...)\`~~` : `\`${method.name}(...)\``;
    sections.push(`### ${name}`);
    sections.push('');

    if (method.description) {
      sections.push(method.description);
      sections.push('');
    }

    if (typeof method.deprecated === 'string') {
      sections.push(`> **Deprecated:** ${method.deprecated}`);
      sections.push('');
    }

    // Signature
    sections.push('#### Signature');
    sections.push('');
    sections.push('```typescript');

    const params = method.parameters
      .map((p) => {
        const optional = p.optional ? '?' : '';
        const defaultVal = p.default ? ` = ${p.default}` : '';
        return `${p.name}${optional}: ${p.type}${defaultVal}`;
      })
      .join(', ');

    const asyncPrefix = method.async ? 'async ' : '';
    const returnType = method.returns?.type || 'void';

    sections.push(`${asyncPrefix}${method.name}(${params}): ${returnType}`);
    sections.push('```');
    sections.push('');

    // Parameters
    if (method.parameters.length > 0) {
      sections.push('#### Parameters');
      sections.push('');
      sections.push('| Name | Type | Description |');
      sections.push('| ---- | ---- | ----------- |');

      method.parameters.forEach((param) => {
        const name = param.optional ? `\`${param.name}\` _(optional)_` : `\`${param.name}\``;
        const type = `\`${escapeMarkdown(param.type)}\``;
        let description = param.description || '';
        if (param.default) {
          description += ` Default: \`${escapeMarkdown(param.default)}\``;
        }
        sections.push(`| ${name} | ${type} | ${description} |`);
      });

      sections.push('');
    }

    // Returns
    if (method.returns) {
      sections.push('#### Returns');
      sections.push('');
      sections.push(`Type: \`${escapeMarkdown(method.returns.type)}\``);
      sections.push('');
      if (method.returns.description) {
        sections.push(method.returns.description);
        sections.push('');
      }
    }
  });

  return sections.join('\n');
}

/**
 * Generate slots table
 */
function generateSlotsTable(slots: LitComponentDocs['slots']): string {
  const lines: string[] = [];

  lines.push('| Slot | Description |');
  lines.push('| ---- | ----------- |');

  slots.forEach((slot) => {
    const name = slot.name ? `\`"${slot.name}"\`` : '_(default)_';
    const description = slot.description || '';

    lines.push(`| ${name} | ${description} |`);
  });

  return lines.join('\n');
}

/**
 * Generate CSS custom properties table
 */
function generateCssPropertiesTable(cssProps: LitComponentDocs['cssProperties']): string {
  const lines: string[] = [];

  lines.push('| Name | Description | Default |');
  lines.push('| ---- | ----------- | ------- |');

  cssProps.forEach((prop) => {
    const name = `\`${prop.name}\``;
    const description = prop.description || '';
    const defaultValue = prop.default ? `\`${escapeMarkdown(prop.default)}\`` : '--';

    lines.push(`| ${name} | ${description} | ${defaultValue} |`);
  });

  return lines.join('\n');
}

/**
 * Generate CSS shadow parts table
 */
function generateCssPartsTable(cssParts: LitComponentDocs['cssParts']): string {
  const lines: string[] = [];

  lines.push('| Part | Description |');
  lines.push('| ---- | ----------- |');

  cssParts.forEach((part) => {
    const name = `\`${part.name}\``;
    const description = part.description || '';

    lines.push(`| ${name} | ${description} |`);
  });

  return lines.join('\n');
}

/**
 * Convert camelCase to kebab-case
 */
function kebabCase(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

/**
 * Escape special markdown characters
 */
function escapeMarkdown(str: string): string {
  return str
    .replace(/\|/g, '\\|')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
