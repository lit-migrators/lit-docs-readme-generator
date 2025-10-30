import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

/**
 * A highly customizable card component.
 *
 * @slot - Default slot for card content
 * @slot header - Card header content
 * @slot footer - Card footer content
 *
 * @cssprop --card-background - Background color of the card [default: white]
 * @cssprop --card-padding - Internal padding [default: 1rem]
 * @cssprop --card-border-radius - Border radius [default: 8px]
 * @cssprop --card-shadow - Box shadow
 * @cssprop --header-background - Header background color [default: #f5f5f5]
 * @cssprop --footer-color - Footer text color [default: #666]
 *
 * @part container - The main card container
 * @part header - The card header
 * @part content - The card content area
 * @part footer - The card footer
 */
@customElement('styled-card')
export class StyledCard extends LitElement {
  static styles = css`
    :host {
      display: block;
      background: var(--card-background, white);
      padding: var(--card-padding, 1rem);
      border-radius: var(--card-border-radius, 8px);
      box-shadow: var(--card-shadow, 0 2px 4px rgba(0, 0, 0, 0.1));
    }

    .header {
      background: var(--header-background, #f5f5f5);
    }

    .footer {
      color: var(--footer-color, #666);
    }
  `;

  /**
   * Card elevation level (affects shadow).
   */
  @property({ type: Number })
  elevation = 1;

  /**
   * Whether the card is highlighted.
   */
  @property({ type: Boolean, reflect: true })
  highlighted = false;

  render() {
    return html`
      <div part="container" class="card">
        <div part="header" class="header">
          <slot name="header"></slot>
        </div>
        <div part="content" class="content">
          <slot></slot>
        </div>
        <div part="footer" class="footer">
          <slot name="footer"></slot>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'styled-card': StyledCard;
  }
}
