import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

/**
 * A flexible tooltip component that displays contextual information on hover or focus.
 *
 * Supports multiple positioning options, trigger modes, and can contain rich HTML content.
 * Automatically adjusts position to stay within viewport boundaries.
 *
 * @slot - Default slot for the tooltip trigger element
 * @slot content - Content to display in the tooltip (alternative to `text` property)
 *
 * @cssprop --tooltip-bg - Background color of the tooltip [default: #333]
 * @cssprop --tooltip-color - Text color [default: #fff]
 * @cssprop --tooltip-border-radius - Border radius [default: 4px]
 * @cssprop --tooltip-padding - Inner padding [default: 8px 12px]
 * @cssprop --tooltip-font-size - Font size [default: 14px]
 * @cssprop --tooltip-max-width - Maximum width [default: 300px]
 * @cssprop --tooltip-z-index - Z-index for stacking [default: 1000]
 * @cssprop --tooltip-shadow - Box shadow [default: 0 2px 8px rgba(0,0,0,0.15)]
 * @cssprop --tooltip-arrow-size - Size of the arrow [default: 6px]
 *
 * @part trigger - The trigger element wrapper
 * @part tooltip - The tooltip popup element
 * @part arrow - The tooltip arrow/pointer
 *
 * @example
 * <tooltip-component text="This is a tooltip">
 *   <button>Hover me</button>
 * </tooltip-component>
 *
 * @example
 * <tooltip-component position="top" trigger="click">
 *   <span>Click me</span>
 *   <div slot="content">
 *     <strong>Rich content</strong>
 *     <p>Can include HTML</p>
 *   </div>
 * </tooltip-component>
 */
@customElement('tooltip-component')
export class TooltipComponent extends LitElement {
  static styles = css`
    :host {
      display: inline-block;
      position: relative;
    }
  `;

  /**
   * The text content to display in the tooltip.
   * Use the 'content' slot for rich HTML content.
   */
  @property({ type: String })
  text = '';

  /**
   * Position of the tooltip relative to the trigger element.
   * Options: top, bottom, left, right, auto
   */
  @property({ type: String })
  position: 'top' | 'bottom' | 'left' | 'right' | 'auto' = 'top';

  /**
   * How the tooltip is triggered.
   * Options: hover, click, focus, manual
   */
  @property({ type: String })
  trigger: 'hover' | 'click' | 'focus' | 'manual' = 'hover';

  /**
   * Delay before showing tooltip in milliseconds.
   */
  @property({ type: Number, attribute: 'show-delay' })
  showDelay = 200;

  /**
   * Delay before hiding tooltip in milliseconds.
   */
  @property({ type: Number, attribute: 'hide-delay' })
  hideDelay = 0;

  /**
   * Keep tooltip open when hovering over it.
   */
  @property({ type: Boolean })
  interactive = false;

  /**
   * Disable the tooltip.
   */
  @property({ type: Boolean, reflect: true })
  disabled = false;

  /**
   * Show arrow pointer on the tooltip.
   */
  @property({ type: Boolean, attribute: 'show-arrow' })
  showArrow = true;

  /**
   * Distance offset from the trigger element in pixels.
   */
  @property({ type: Number })
  offset = 8;

  /**
   * Internal state for tooltip visibility.
   * @internal
   */
  @state()
  private visible = false;

  /**
   * Internal state for actual computed position.
   * @internal
   */
  @state()
  private computedPosition: 'top' | 'bottom' | 'left' | 'right' = 'top';

  /**
   * Timer for show delay.
   * @internal
   */
  private showTimer: number | null = null;

  /**
   * Timer for hide delay.
   * @internal
   */
  private hideTimer: number | null = null;

  /**
   * Programmatically show the tooltip.
   */
  show(): void {
    if (this.disabled || this.visible) return;

    this._clearTimers();

    if (this.showDelay > 0) {
      this.showTimer = window.setTimeout(() => {
        this._doShow();
      }, this.showDelay);
    } else {
      this._doShow();
    }
  }

  /**
   * Programmatically hide the tooltip.
   */
  hide(): void {
    if (!this.visible) return;

    this._clearTimers();

    if (this.hideDelay > 0) {
      this.hideTimer = window.setTimeout(() => {
        this._doHide();
      }, this.hideDelay);
    } else {
      this._doHide();
    }
  }

  /**
   * Toggle tooltip visibility.
   */
  toggle(): void {
    if (this.visible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Check if tooltip is currently visible.
   *
   * @returns True if visible
   */
  isVisible(): boolean {
    return this.visible;
  }

  /**
   * Internal method to actually show the tooltip.
   * @internal
   */
  private _doShow(): void {
    this.visible = true;
    this._computePosition();

    this.dispatchEvent(
      new CustomEvent('tooltip-show', {
        bubbles: true,
        composed: true,
      })
    );
  }

  /**
   * Internal method to actually hide the tooltip.
   * @internal
   */
  private _doHide(): void {
    this.visible = false;

    this.dispatchEvent(
      new CustomEvent('tooltip-hide', {
        bubbles: true,
        composed: true,
      })
    );
  }

  /**
   * Internal method to clear all timers.
   * @internal
   */
  private _clearTimers(): void {
    if (this.showTimer !== null) {
      clearTimeout(this.showTimer);
      this.showTimer = null;
    }
    if (this.hideTimer !== null) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  }

  /**
   * Internal method to compute optimal position.
   * @internal
   */
  private _computePosition(): void {
    if (this.position === 'auto') {
      // Compute best position based on viewport
      const rect = this.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      // Check space available in each direction
      const spaceTop = rect.top;
      const spaceBottom = viewportHeight - rect.bottom;
      const spaceLeft = rect.left;
      const spaceRight = viewportWidth - rect.right;

      // Choose position with most space
      if (spaceTop > spaceBottom && spaceTop > spaceLeft && spaceTop > spaceRight) {
        this.computedPosition = 'top';
      } else if (spaceBottom > spaceLeft && spaceBottom > spaceRight) {
        this.computedPosition = 'bottom';
      } else if (spaceLeft > spaceRight) {
        this.computedPosition = 'left';
      } else {
        this.computedPosition = 'right';
      }
    } else {
      this.computedPosition = this.position;
    }
  }

  render() {
    return html`
      <div part="trigger" @mouseenter="${this._handleMouseEnter}" @mouseleave="${this._handleMouseLeave}" @click="${this._handleClick}" @focus="${this._handleFocus}" @blur="${this._handleBlur}">
        <slot></slot>
      </div>
      ${this.visible
        ? html`
            <div part="tooltip" class="tooltip ${this.computedPosition}">
              ${this.showArrow ? html`<div part="arrow" class="arrow"></div>` : ''}
              ${this.text ? html`<span>${this.text}</span>` : html`<slot name="content"></slot>`}
            </div>
          `
        : ''}
    `;
  }

  /**
   * Handle mouse enter event.
   * @internal
   */
  private _handleMouseEnter(): void {
    if (this.trigger === 'hover') {
      this.show();
    }
  }

  /**
   * Handle mouse leave event.
   * @internal
   */
  private _handleMouseLeave(): void {
    if (this.trigger === 'hover' && !this.interactive) {
      this.hide();
    }
  }

  /**
   * Handle click event.
   * @internal
   */
  private _handleClick(): void {
    if (this.trigger === 'click') {
      this.toggle();
    }
  }

  /**
   * Handle focus event.
   * @internal
   */
  private _handleFocus(): void {
    if (this.trigger === 'focus') {
      this.show();
    }
  }

  /**
   * Handle blur event.
   * @internal
   */
  private _handleBlur(): void {
    if (this.trigger === 'focus') {
      this.hide();
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._clearTimers();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tooltip-component': TooltipComponent;
  }
}
