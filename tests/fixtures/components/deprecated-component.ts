import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';

/**
 * A component demonstrating deprecated features.
 */
@customElement('deprecated-widget')
export class DeprecatedWidget extends LitElement {
  /**
   * Current value.
   */
  @property({ type: Number })
  value = 0;

  /**
   * Old name for the value property.
   * @deprecated Use `value` instead
   */
  @property({ type: Number })
  oldValue = 0;

  /**
   * Legacy color setting.
   * @deprecated This property will be removed in v3.0. Use CSS custom properties instead.
   */
  @property({ type: String })
  color?: string;

  /**
   * Required identifier.
   * @required
   */
  @property({ type: String })
  id!: string;

  /**
   * Sets the value programmatically.
   * @deprecated Use the `value` property directly
   * @param newValue - The new value
   */
  public setValue(newValue: number): void {
    this.value = newValue;
    this.dispatchEvent(new CustomEvent('value-changed', {
      detail: newValue,
    }));
  }

  /**
   * Updates the widget value.
   *
   * @param val - New value to set
   * @returns Previous value
   */
  public updateValue(val: number): number {
    const prev = this.value;
    this.value = val;
    return prev;
  }

  /**
   * Legacy change event.
   * @deprecated Use `value-changed` instead
   */
  private emitLegacyChange(): void {
    this.dispatchEvent(new CustomEvent('legacy-change', {
      detail: this.value,
      bubbles: true,
    }));
  }

  render() {
    return html`<div>${this.value}</div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'deprecated-widget': DeprecatedWidget;
  }
}
