import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';

/**
 * Component with type inference from initializers.
 */
@customElement('type-inference-test')
export class TypeInferenceComponent extends LitElement {
  /**
   * String inferred from string literal.
   */
  @property()
  stringProp = 'hello';

  /**
   * Number inferred from numeric literal.
   */
  @property()
  numberProp = 42;

  /**
   * Boolean inferred from boolean literal.
   */
  @property()
  booleanProp = true;

  /**
   * Array inferred from array literal.
   */
  @property()
  arrayProp = [1, 2, 3];

  /**
   * Object inferred from object literal.
   */
  @property()
  objectProp = { key: 'value' };

  /**
   * Null type.
   */
  @property()
  nullProp = null;

  /**
   * Undefined with explicit type.
   */
  @property({ type: String })
  undefinedProp?: string;

  /**
   * Property with type from decorator option.
   */
  @property({ type: String })
  decoratorTypeProp = 'test';

  /**
   * Property with explicit TypeScript type.
   */
  @property()
  explicitTypeProp: string = 'explicit';

  /**
   * Property with no attribute.
   */
  @property({ attribute: false })
  noAttributeProp = 'internal';

  /**
   * Property with custom attribute name.
   */
  @property({ attribute: 'data-custom' })
  customAttributeProp = 'custom';

  /**
   * Negative number.
   */
  @property()
  negativeProp = -10;

  /**
   * Template string.
   */
  @property()
  templateProp = `template ${42}`;

  render() {
    return html`<div>Edge cases</div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'type-inference-test': TypeInferenceComponent;
  }
}
