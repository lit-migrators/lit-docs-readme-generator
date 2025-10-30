# lit-docs-generator

Generate Stencil.js-compatible README documentation for Lit components.

## Overview

This package automatically generates comprehensive README.md documentation for your Lit components by parsing TypeScript source files. It extracts metadata from Lit decorators (`@customElement`, `@property`, `@state`, etc.) and JSDoc comments to create well-formatted markdown documentation compatible with Stencil.js documentation format.

## Features

- 🔍 **Automatic Discovery** - Uses glob patterns to find Lit component files
- 📝 **Complete Documentation** - Extracts properties, events, methods, slots, CSS properties, and CSS parts
- 🎯 **Stencil.js Compatible** - Generates markdown in Stencil.js documentation format
- 🏷️ **JSDoc Support** - Supports Stencil.js JSDoc annotations (`@slot`, `@cssprop`, `@part`, etc.)
- 🚀 **CLI & API** - Use as a command-line tool or programmatically
- 📦 **Zero Config** - Works out of the box with standard Lit components

## Installation

```bash
pnpm add -D lit-docs-generator
# or
npm install --save-dev lit-docs-generator
# or
yarn add -D lit-docs-generator
```

## Usage

Use with stencil:
```
import { litDocsPlugin } from './plugins/lit-docs-plugin';
...
  plugins: [
    litDocsPlugin(),
    cemMergerPlugin(),
  ],
...
```

### Command Line

```bash
# Generate docs for all *.lit.ts files
npx lit-docs "**/*.lit.ts"

# With custom pattern
npx lit-docs "src/components/**/*.ts"

# Overwrite existing README files
npx lit-docs "**/*.lit.ts" --overwrite

# Show help
npx lit-docs --help
```

### Programmatic API

```typescript
import { generateDocs } from 'lit-docs-generator';

await generateDocs({
  pattern: '**/*.lit.ts',
  overwrite: true
});
```

### package.json Script

```json
{
  "scripts": {
    "docs": "lit-docs \"src/components/**/*.ts\" --overwrite"
  }
}
```

## Supported JSDoc Tags

The generator supports the following Stencil.js-compatible JSDoc tags:

### Component Level

- `@example` - Usage examples (can have multiple)
- `@dependency` - Component dependencies
- `@slot [name] - description` - Define slots
- `@cssprop --property-name - description [default: value]` - CSS custom properties
- `@part name - description` - CSS shadow parts

### Property Level

- `@required` - Mark property as required
- `@deprecated [message]` - Mark property as deprecated

### Method Level

- `@param {type} name - description` - Parameter documentation
- `@returns {type} description` - Return value documentation
- `@deprecated [message]` - Mark method as deprecated

## Example Component

```typescript
import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

/**
 * A simple button component with variants and loading state.
 *
 * @slot - Default slot for button content
 * @slot icon - Slot for an icon
 *
 * @cssprop --button-bg - Background color [default: #007bff]
 * @cssprop --button-color - Text color [default: #ffffff]
 * @cssprop --button-border-radius - Border radius [default: 4px]
 *
 * @part button - The button element
 * @part loader - The loading spinner
 *
 * @example
 * <my-button variant="primary">Click me</my-button>
 *
 * @example
 * <my-button loading disabled>
 *   <icon-check slot="icon"></icon-check>
 *   Save
 * </my-button>
 */
@customElement('my-button')
export class MyButton extends LitElement {
  static styles = css`
    :host {
      display: inline-block;
    }
  `;

  /**
   * Button variant style.
   * @required
   */
  @property({ type: String })
  variant: 'primary' | 'secondary' | 'danger' = 'primary';

  /**
   * Disable the button.
   */
  @property({ type: Boolean, reflect: true })
  disabled = false;

  /**
   * Show loading state.
   */
  @property({ type: Boolean })
  loading = false;

  /**
   * Button size.
   */
  @property({ type: String })
  size: 'small' | 'medium' | 'large' = 'medium';

  /**
   * Internal loading state.
   * @internal
   */
  @state()
  private isProcessing = false;

  /**
   * Simulate an async action.
   *
   * @param duration - How long the action takes in milliseconds
   * @returns Promise that resolves when action completes
   */
  async performAction(duration = 1000): Promise<void> {
    this.isProcessing = true;

    await new Promise(resolve => setTimeout(resolve, duration));

    this.isProcessing = false;

    this.dispatchEvent(
      new CustomEvent('action-complete', {
        detail: { duration },
        bubbles: true,
        composed: true
      })
    );
  }

  render() {
    return html`
      <button
        part="button"
        ?disabled="${this.disabled || this.loading}"
        @click="${this._handleClick}"
      >
        ${this.loading ? html`<span part="loader">Loading...</span>` : ''}
        <slot name="icon"></slot>
        <slot></slot>
      </button>
    `;
  }

  private _handleClick() {
    this.dispatchEvent(
      new CustomEvent('button-click', {
        bubbles: true,
        composed: true
      })
    );
  }
}
```

This will generate a README.md like:

```markdown
# my-button

A simple button component with variants and loading state.

## Usage

\`\`\`html
<my-button variant="primary">Click me</my-button>
\`\`\`

\`\`\`html
<my-button loading disabled>
  <icon-check slot="icon"></icon-check>
  Save
</my-button>
\`\`\`

## Properties

| Property | Attribute | Description | Type | Default |
| -------- | --------- | ----------- | ---- | ------- |
| `variant` | `variant` | **(required)** Button variant style. | `'primary' \| 'secondary' \| 'danger'` | `'primary'` |
| `disabled` | `disabled` | Disable the button. | `boolean` | `false` |
| `loading` | `loading` | Show loading state. | `boolean` | `false` |
| `size` | `size` | Button size. | `'small' \| 'medium' \| 'large'` | `'medium'` |

## Events

| Event | Description | Type |
| ----- | ----------- | ---- |
| `action-complete` |  _(bubbles, composed)_ | `CustomEvent<any>` |
| `button-click` |  _(bubbles, composed)_ | `CustomEvent<any>` |

## Methods

### `performAction(...)`

Simulate an async action.

#### Signature

\`\`\`typescript
async performAction(duration?: any = 1000): Promise<void>
\`\`\`

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| `duration` _(optional)_ | `any` | - How long the action takes in milliseconds Default: `1000` |

#### Returns

Type: `Promise<void>`

Promise that resolves when action completes

## Slots

| Slot | Description |
| ---- | ----------- |
| _(default)_ | Default slot for button content |
| `"icon"` | Slot for an icon |

## CSS Custom Properties

| Name | Description | Default |
| ---- | ----------- | ------- |
| `--button-bg` | Background color | `#007bff` |
| `--button-color` | Text color | `#ffffff` |
| `--button-border-radius` | Border radius | `4px` |

## Shadow Parts

| Part | Description |
| ---- | ----------- |
| `button` | The button element |
| `loader` | The loading spinner |

---

*Built with [Lit](https://lit.dev/)*
```

## Extracted Metadata

The generator automatically extracts:

### From Decorators

- `@customElement('tag-name')` - Component tag name
- `@property()` - Public properties with types and defaults
- `@state()` - Internal state (marked as "internal")
- Property options: `attribute`, `reflect`, `type`

### From JSDoc

- Component description
- Property descriptions
- Method descriptions and parameter docs
- `@slot` annotations
- `@cssprop` / `@cssproperty` annotations
- `@part` annotations
- `@example` usage examples
- `@deprecated` warnings
- `@required` markers

### From Code

- Events from `dispatchEvent()` calls
- Event details, bubbles, composed flags
- Public methods with parameters and return types
- Method signatures (sync/async)
- Type information

## Generated Documentation Format

Each README includes:

1. **Title** - Component tag name
2. **Description** - From class-level JSDoc
3. **Usage Examples** - From `@example` tags
4. **Properties Table** - All public properties
5. **Events Table** - All dispatched events
6. **Methods Section** - Public methods with full signatures
7. **Slots Table** - Available content slots
8. **CSS Custom Properties** - Themeable CSS variables
9. **Shadow Parts** - Styleable shadow DOM parts
10. **Dependencies** - Component dependencies (if specified)

## Examples

The package includes three comprehensive example components:

### [data-grid](./examples/data-grid/data-grid.lit.ts)
A complex data grid with:
- 15 properties (sorting, filtering, pagination)
- 7 events
- 9 public methods
- 4 slots
- 9 CSS custom properties
- 7 CSS shadow parts

### [wysiwyg-editor](./examples/wysiwyg-editor/wysiwyg-editor.lit.ts)
A rich text editor with:
- 16 properties
- 4 events
- 13 public methods
- 3 slots
- 11 CSS custom properties
- 5 CSS shadow parts

### [tooltip](./examples/tooltip/tooltip.lit.ts)
A flexible tooltip with:
- 10 properties
- 2 events
- 4 public methods
- 2 slots
- 9 CSS custom properties
- 3 CSS shadow parts

Run the examples:

```bash
pnpm example
```

## CLI Options

```
Usage:
  lit-docs [pattern] [options]

Arguments:
  pattern           Glob pattern for files to process (default: **/*.lit.ts)

Options:
  -o, --overwrite   Overwrite existing README.md files
  -h, --help        Show help message
  -v, --version     Show version number

Examples:
  lit-docs "**/*.lit.ts"
  lit-docs "src/components/**/*.ts" --overwrite
  lit-docs "src/my-component.lit.ts"
```

## Requirements

- Components must extend `LitElement`
- Components must have `@customElement` decorator
- TypeScript source files

## Tips

1. **Organize Components** - Place each component in its own directory for individual README files
2. **Use JSDoc** - Add comprehensive JSDoc comments for better documentation
3. **Stencil Tags** - Use `@slot`, `@cssprop`, and `@part` tags for complete docs
4. **Examples** - Include multiple `@example` tags showing different use cases
5. **Type Safety** - Use TypeScript types for properties and methods

## Comparison with Stencil

This generator produces documentation compatible with Stencil.js but works with Lit components:

| Feature | Stencil | lit-docs-generator |
|---------|---------|-------------------|
| Component Framework | Stencil | Lit |
| Doc Format | Markdown | Markdown (same format) |
| Decorators | `@Component`, `@Prop` | `@customElement`, `@property` |
| Auto-generation | Built-in | Standalone tool |
| JSDoc Tags | Supported | Fully supported |

## License

MIT

## Important disclaimer

This project is generated with AI.

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.
