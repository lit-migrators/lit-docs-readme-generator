import { LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { withAnalyticsMeta, withBaseFormControl } from '../mixins/form-mixins.js';

@customElement('demo-complex-component')
export class ComplexComponent extends withAnalyticsMeta(withBaseFormControl(LitElement)) {
  /**
   * Public API flag.
   */
  @property({ type: Boolean, reflect: true })
  open = false;

  /**
   * Internal state should not leak into docs.
   */
  @state()
  private busy = false;

  /**
   * Eventual display name. `undefined` on first render.
   */
  @property({ type: String })
  displayName?: string;

  protected updated(): void {
    if (this.open) {
      this.logAnalytics('opened');
    }
  }

  private toggleBusy(): void {
    this.busy = !this.busy;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'demo-complex-component': ComplexComponent;
  }
}
