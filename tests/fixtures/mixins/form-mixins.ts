import { LitElement, html, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';

type Constructor<T = Record<string, unknown>> = new (...args: any[]) => T;

/**
 * Adds base form control behaviour.
 *
 * @slot before-control - Rendered before the control wrapper
 * @slot after-control - Rendered after the control wrapper
 * @returns Form control mixin class
 */
export const withBaseFormControl = <T extends Constructor<LitElement>>(Base: T) => {
  class BaseFormControl extends Base {
    /**
     * Human readable name shown next to the control.
     */
    @property({ type: String }) label: string = 'Unnamed control';

    /**
     * Help text that explains how to use the control.
     */
    @property({ type: String }) helperText = '';

    /**
     * Indicates whether the control is in an invalid state.
     */
    @property({ type: Boolean, reflect: true }) invalid = false;

    protected emitHelper(detail: { message: string }) {
      this.dispatchEvent(new CustomEvent('helper-changed', {
        detail,
        bubbles: true,
        composed: true,
      }));
    }

    protected renderWrapper(content: TemplateResult): TemplateResult {
      this.emitHelper({ message: this.helperText });
      return html`
        <div class="base-wrapper">
          <slot name="before-control"></slot>
          ${content}
          <slot name="after-control"></slot>
        </div>
      `;
    }
  }

  return BaseFormControl;
};

/**
 * Adds additional metadata fields required for analytics.
 *
 * @returns Analytics-aware mixin class
 */
export const withAnalyticsMeta = <T extends Constructor<LitElement>>(Base: T) => {
  class AnalyticsMixin extends Base {
    /**
     * Unique identifier for tracking.
     */
    @property({ type: String }) trackingId: string = 'track-default';

    /**
     * When true, analytics events are suppressed.
     */
    @property({ type: Boolean }) muteAnalytics = false;

    // Should be ignored because it's private.
    #privateSessionId = '';

    protected logAnalytics(eventName: string) {
      if (!this.muteAnalytics) {
        this.dispatchEvent(new CustomEvent('analytics', {
          detail: { eventName, trackingId: this.trackingId },
        }));
      }
    }
  }

  return AnalyticsMixin;
};
