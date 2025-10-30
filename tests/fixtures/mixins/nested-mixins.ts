import { LitElement } from 'lit';
import { property } from 'lit/decorators.js';

type Constructor<T = Record<string, unknown>> = new (...args: any[]) => T;

/**
 * Base mixin that adds logging capability.
 *
 * @cssprop --log-color - Color for log messages
 */
export const withLogging = <T extends Constructor<LitElement>>(Base: T) => {
  class LoggingMixin extends Base {
    /**
     * Enable or disable logging.
     */
    @property({ type: Boolean })
    enableLogging = false;

    /**
     * Log level.
     */
    @property({ type: String })
    logLevel: 'debug' | 'info' | 'warn' | 'error' = 'info';

    protected log(message: string, level: string = 'info'): void {
      if (this.enableLogging) {
        console.log(`[${level}] ${message}`);
        this.dispatchEvent(new CustomEvent('log-message', {
          detail: { message, level },
          bubbles: true,
        }));
      }
    }
  }

  return LoggingMixin;
};

/**
 * Mixin that adds validation capability.
 * This mixin extends the logging mixin.
 *
 * @slot validation-message - Slot for custom validation messages
 */
export const withValidation = <T extends Constructor<LitElement>>(Base: T) => {
  class ValidationMixin extends withLogging(Base) {
    /**
     * Whether the current state is valid.
     */
    @property({ type: Boolean, reflect: true })
    valid = true;

    /**
     * Validation error message.
     */
    @property({ type: String })
    errorMessage = '';

    /**
     * Validates the component state.
     *
     * @returns True if valid
     */
    public validate(): boolean {
      this.log('Validating component');
      this.dispatchEvent(new CustomEvent('validation-attempted', {
        bubbles: true,
        composed: true,
      }));
      return this.valid;
    }

    /**
     * Clears any validation errors.
     */
    public clearErrors(): void {
      this.valid = true;
      this.errorMessage = '';
    }
  }

  return ValidationMixin;
};

/**
 * Mixin for components that need async data loading.
 *
 * @part loader - Loading indicator element
 */
export const withAsyncData = <T extends Constructor<LitElement>>(Base: T) => {
  class AsyncDataMixin extends Base {
    /**
     * Whether data is currently loading.
     */
    @property({ type: Boolean, reflect: true })
    loading = false;

    /**
     * Error from last load attempt.
     */
    @property({ type: String })
    loadError?: string;

    /**
     * Loads data asynchronously.
     *
     * @param source - Data source URL or identifier
     * @returns Promise that resolves when loading completes
     */
    public async loadData(source: string): Promise<void> {
      this.loading = true;
      this.loadError = undefined;

      try {
        this.dispatchEvent(new CustomEvent('load-start', {
          detail: { source },
          bubbles: true,
        }));

        // Simulate async operation
        await new Promise((resolve) => setTimeout(resolve, 100));

        this.dispatchEvent(new CustomEvent('load-complete', {
          detail: { source },
          bubbles: true,
          composed: true,
        }));
      } catch (error) {
        this.loadError = String(error);
        this.dispatchEvent(new CustomEvent('load-error', {
          detail: { error },
        }));
      } finally {
        this.loading = false;
      }
    }
  }

  return AsyncDataMixin;
};

/**
 * Complex mixin combining validation and async data.
 * Demonstrates deeply nested mixin composition.
 *
 * @cssprop --data-form-border - Border style for the form
 * @part form-container - Main form container
 */
export const withDataForm = <T extends Constructor<LitElement>>(Base: T) => {
  class DataFormMixin extends withValidation(withAsyncData(Base)) {
    /**
     * Form data source URL.
     */
    @property({ type: String })
    dataSource = '';

    /**
     * Auto-validate on data load.
     */
    @property({ type: Boolean })
    autoValidate = true;

    /**
     * Submits the form data.
     *
     * @param data - Form data to submit
     * @returns Promise resolving to submission result
     */
    public async submitForm(data: Record<string, unknown>): Promise<boolean> {
      if (!this.validate()) {
        this.log('Form validation failed', 'error');
        return false;
      }

      await this.loadData(this.dataSource);

      this.dispatchEvent(new CustomEvent('form-submitted', {
        detail: data,
        bubbles: true,
        composed: true,
      }));

      return true;
    }
  }

  return DataFormMixin;
};
