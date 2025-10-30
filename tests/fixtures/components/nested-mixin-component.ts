import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { withDataForm } from '../mixins/nested-mixins.js';

/**
 * A form component using deeply nested mixins.
 * Demonstrates mixin composition and inheritance of properties, events, and methods.
 *
 * @slot - Default slot for form fields
 * @cssprop --form-width - Width of the form [default: 100%]
 */
@customElement('nested-form')
export class NestedFormComponent extends withDataForm(LitElement) {
  /**
   * Form title.
   */
  @property({ type: String })
  title = 'Form';

  /**
   * Whether the form is read-only.
   */
  @property({ type: Boolean, reflect: true })
  readonly = false;

  render() {
    return html`
      <form>
        <h2>${this.title}</h2>
        <slot></slot>
      </form>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'nested-form': NestedFormComponent;
  }
}
