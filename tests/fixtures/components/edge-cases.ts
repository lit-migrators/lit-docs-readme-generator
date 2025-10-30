import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';

// Component without @customElement decorator - should be skipped
export class NoDecoratorComponent extends LitElement {
  @property({ type: String })
  value = 'test';

  render() {
    return html`<div>${this.value}</div>`;
  }
}

// Non-Lit component - should be skipped
export class NotLitComponent {
  value = 'test';
}

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

/**
 * Component with complex event scenarios.
 */
@customElement('event-test')
export class EventTestComponent extends LitElement {
  /**
   * Triggers a simple event.
   */
  public triggerSimple(): void {
    this.dispatchEvent(new CustomEvent('simple-event'));
  }

  /**
   * Triggers event with detail.
   */
  public triggerWithDetail(): void {
    this.dispatchEvent(new CustomEvent('detail-event', {
      detail: { message: 'test', count: 1 },
    }));
  }

  /**
   * Triggers non-bubbling event.
   */
  public triggerNonBubbling(): void {
    this.dispatchEvent(new CustomEvent('non-bubbling', {
      bubbles: false,
    }));
  }

  /**
   * Triggers cancelable event.
   */
  public triggerCancelable(): void {
    this.dispatchEvent(new CustomEvent('cancelable-event', {
      cancelable: true,
      bubbles: true,
      composed: false,
    }));
  }

  render() {
    return html`<div>Events</div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'type-inference-test': TypeInferenceComponent;
    'event-test': EventTestComponent;
  }
}
