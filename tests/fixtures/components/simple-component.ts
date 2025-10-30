import { LitElement, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

/**
 * A simple button component with basic properties.
 * This component demonstrates basic Lit functionality without mixins.
 *
 * @slot - Default slot for button content
 * @slot icon - Slot for button icon
 *
 * @cssprop --button-color - Button text color [default: #000]
 * @cssprop --button-bg - Button background color [default: #fff]
 *
 * @part button - The button element
 */
@customElement('simple-button')
export class SimpleButton extends LitElement {
  /**
   * Button label text.
   */
  @property({ type: String })
  label = 'Click me';

  /**
   * Whether the button is disabled.
   */
  @property({ type: Boolean, reflect: true })
  disabled = false;

  /**
   * Button variant type.
   */
  @property({ type: String })
  variant: 'primary' | 'secondary' = 'primary';

  /**
   * Number of times the button has been clicked.
   */
  @state()
  private clickCount = 0;

  /**
   * Handles button click events.
   *
   * @param event - The click event
   */
  public handleClick(event: MouseEvent): void {
    if (this.disabled) return;

    this.clickCount++;
    this.dispatchEvent(new CustomEvent('button-clicked', {
      detail: { count: this.clickCount },
      bubbles: true,
      composed: true,
    }));
  }

  /**
   * Resets the click count to zero.
   */
  public reset(): void {
    this.clickCount = 0;
  }

  render() {
    return html`
      <button
        part="button"
        ?disabled=${this.disabled}
        @click=${this.handleClick}
      >
        <slot name="icon"></slot>
        <slot>${this.label}</slot>
      </button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'simple-button': SimpleButton;
  }
}
