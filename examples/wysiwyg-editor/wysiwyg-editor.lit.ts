import { LitElement, html, css } from 'lit';
import { customElement, property, state, query } from 'lit/decorators.js';

/**
 * A feature-rich WYSIWYG editor component with toolbar, formatting, and media support.
 *
 * This editor provides a complete content editing experience with support for rich text
 * formatting, images, links, tables, code blocks, and more. It outputs clean HTML and
 * supports undo/redo, keyboard shortcuts, and custom plugins.
 *
 * @slot toolbar-start - Content to prepend to the toolbar
 * @slot toolbar-end - Content to append to the toolbar
 * @slot - Default slot for custom content overlay
 *
 * @cssprop --editor-bg - Background color of the editor [default: #ffffff]
 * @cssprop --editor-color - Text color [default: #333333]
 * @cssprop --editor-border - Border style [default: 1px solid #cccccc]
 * @cssprop --editor-border-radius - Border radius [default: 4px]
 * @cssprop --editor-min-height - Minimum height of editor [default: 300px]
 * @cssprop --editor-max-height - Maximum height of editor [default: none]
 * @cssprop --editor-padding - Inner padding [default: 16px]
 * @cssprop --toolbar-bg - Toolbar background [default: #f5f5f5]
 * @cssprop --toolbar-border - Toolbar border [default: 1px solid #e0e0e0]
 * @cssprop --button-hover-bg - Button hover background [default: #e0e0e0]
 * @cssprop --button-active-bg - Button active background [default: #d0d0d0]
 *
 * @part container - Main container element
 * @part toolbar - Toolbar container
 * @part button - Toolbar buttons
 * @part editor - Contenteditable area
 * @part statusbar - Status bar at bottom
 *
 * @example
 * <wysiwyg-editor
 *   value="<p>Hello World</p>"
 *   placeholder="Start typing..."
 *   .toolbar="${['bold', 'italic', 'link', 'image']}"
 * ></wysiwyg-editor>
 *
 * @dependency icon-button
 */
@customElement('wysiwyg-editor')
export class WysiwygEditor extends LitElement {
  static styles = css`
    :host {
      display: block;
      font-family: system-ui, -apple-system, sans-serif;
    }
  `;

  /**
   * The HTML content of the editor.
   */
  @property({ type: String })
  value = '';

  /**
   * Placeholder text displayed when editor is empty.
   */
  @property({ type: String })
  placeholder = 'Start typing...';

  /**
   * Make the editor read-only (non-editable).
   */
  @property({ type: Boolean, reflect: true })
  readonly = false;

  /**
   * Disable the editor completely.
   */
  @property({ type: Boolean, reflect: true })
  disabled = false;

  /**
   * Array of toolbar button identifiers to display.
   * Available buttons: bold, italic, underline, strike, h1, h2, h3, link, image,
   * video, code, quote, ol, ul, table, hr, undo, redo, clear
   */
  @property({ type: Array })
  toolbar: string[] = [
    'bold',
    'italic',
    'underline',
    'link',
    'image',
    'code',
    'ol',
    'ul',
    'undo',
    'redo',
  ];

  /**
   * Maximum character length. Set to 0 for unlimited.
   */
  @property({ type: Number, attribute: 'max-length' })
  maxLength = 0;

  /**
   * Automatically focus the editor when it loads.
   */
  @property({ type: Boolean })
  autofocus = false;

  /**
   * Enable browser spellcheck.
   */
  @property({ type: Boolean })
  spellcheck = true;

  /**
   * Enable HTML mode (show raw HTML instead of rendered).
   */
  @property({ type: Boolean, attribute: 'html-mode' })
  htmlMode = false;

  /**
   * Allowed HTML tags for sanitization. If empty, all tags are allowed.
   */
  @property({ type: Array, attribute: 'allowed-tags' })
  allowedTags: string[] = [];

  /**
   * Enable image upload capability.
   */
  @property({ type: Boolean, attribute: 'allow-image-upload' })
  allowImageUpload = true;

  /**
   * Maximum file size for uploads in bytes.
   */
  @property({ type: Number, attribute: 'max-upload-size' })
  maxUploadSize = 5 * 1024 * 1024; // 5MB

  /**
   * Show character count in status bar.
   */
  @property({ type: Boolean, attribute: 'show-char-count' })
  showCharCount = true;

  /**
   * Show word count in status bar.
   */
  @property({ type: Boolean, attribute: 'show-word-count' })
  showWordCount = true;

  /**
   * Custom CSS class to apply to the editor content area.
   */
  @property({ type: String, attribute: 'editor-class' })
  editorClass = '';

  /**
   * Internal state tracking if editor has focus.
   * @internal
   */
  @state()
  private hasFocus = false;

  /**
   * Internal state for current selection/cursor position.
   * @internal
   */
  @state()
  private selection: Selection | null = null;

  /**
   * Internal state for undo history.
   * @internal
   */
  @state()
  private history: string[] = [];

  /**
   * Internal state for redo history.
   * @internal
   */
  @state()
  private redoStack: string[] = [];

  /**
   * Reference to the contenteditable element.
   * @internal
   */
  @query('[contenteditable]')
  private editorElement!: HTMLElement;

  /**
   * Insert HTML content at the current cursor position.
   *
   * @param html - HTML string to insert
   * @param selectInserted - Whether to select the inserted content
   */
  insertHtml(html: string, selectInserted = false): void {
    if (this.readonly || this.disabled) return;

    this.editorElement.focus();
    document.execCommand('insertHTML', false, html);

    if (selectInserted) {
      // Select the inserted content
      const selection = window.getSelection();
      if (selection) {
        this.selection = selection;
      }
    }

    this._saveHistory();
    this._emitChange();
  }

  /**
   * Insert text at the current cursor position.
   *
   * @param text - Plain text to insert (will be escaped)
   */
  insertText(text: string): void {
    if (this.readonly || this.disabled) return;

    this.editorElement.focus();
    document.execCommand('insertText', false, text);

    this._saveHistory();
    this._emitChange();
  }

  /**
   * Apply a formatting command to the selected text.
   *
   * @param command - The formatting command (e.g., 'bold', 'italic', 'createLink')
   * @param value - Optional value for the command (e.g., URL for 'createLink')
   */
  execCommand(command: string, value?: string): boolean {
    if (this.readonly || this.disabled) return false;

    this.editorElement.focus();
    const result = document.execCommand(command, false, value);

    this._saveHistory();
    this._emitChange();

    return result;
  }

  /**
   * Get the current selection range.
   *
   * @returns The current selection Range object or null
   */
  getSelection(): Range | null {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      return selection.getRangeAt(0);
    }
    return null;
  }

  /**
   * Set focus to the editor.
   */
  focus(): void {
    this.editorElement?.focus();
  }

  /**
   * Remove focus from the editor.
   */
  blur(): void {
    this.editorElement?.blur();
  }

  /**
   * Clear all content from the editor.
   */
  clear(): void {
    this.value = '';
    this.editorElement.innerHTML = '';
    this._saveHistory();
    this._emitChange();
  }

  /**
   * Undo the last change.
   */
  undo(): void {
    if (this.history.length > 1) {
      const current = this.history.pop()!;
      this.redoStack.push(current);
      const previous = this.history[this.history.length - 1];
      this.value = previous;
      this.editorElement.innerHTML = previous;
      this._emitChange();
    }
  }

  /**
   * Redo the last undone change.
   */
  redo(): void {
    if (this.redoStack.length > 0) {
      const next = this.redoStack.pop()!;
      this.history.push(next);
      this.value = next;
      this.editorElement.innerHTML = next;
      this._emitChange();
    }
  }

  /**
   * Get the plain text content (without HTML tags).
   *
   * @returns Plain text content
   */
  getTextContent(): string {
    return this.editorElement?.textContent || '';
  }

  /**
   * Get the current character count.
   *
   * @returns Number of characters
   */
  getCharCount(): number {
    return this.getTextContent().length;
  }

  /**
   * Get the current word count.
   *
   * @returns Number of words
   */
  getWordCount(): number {
    const text = this.getTextContent().trim();
    return text ? text.split(/\s+/).length : 0;
  }

  /**
   * Check if the editor content is empty.
   *
   * @returns True if editor is empty
   */
  isEmpty(): boolean {
    return this.getTextContent().trim().length === 0;
  }

  /**
   * Internal method to save current state to history.
   * @internal
   */
  private _saveHistory(): void {
    const currentValue = this.editorElement.innerHTML;
    if (this.history[this.history.length - 1] !== currentValue) {
      this.history.push(currentValue);
      // Clear redo stack when new changes are made
      this.redoStack = [];
    }
  }

  /**
   * Internal method to emit change events.
   * @internal
   */
  private _emitChange(): void {
    const html = this.editorElement.innerHTML;
    const text = this.getTextContent();

    this.dispatchEvent(
      new CustomEvent('value-change', {
        detail: {
          value: html,
          html: html,
          text: text,
          charCount: this.getCharCount(),
          wordCount: this.getWordCount(),
        },
        bubbles: true,
        composed: true,
      })
    );
  }

  /**
   * Handle editor focus event.
   * @internal
   */
  private _handleFocus(): void {
    this.hasFocus = true;

    this.dispatchEvent(
      new CustomEvent('editor-focus', {
        bubbles: true,
        composed: true,
      })
    );
  }

  /**
   * Handle editor blur event.
   * @internal
   */
  private _handleBlur(): void {
    this.hasFocus = false;

    this.dispatchEvent(
      new CustomEvent('editor-blur', {
        bubbles: true,
        composed: true,
      })
    );
  }

  /**
   * Handle selection change.
   * @internal
   */
  private _handleSelectionChange(): void {
    this.selection = window.getSelection();

    this.dispatchEvent(
      new CustomEvent('selection-change', {
        detail: {
          selection: this.selection,
          range: this.getSelection(),
        },
        bubbles: true,
        composed: true,
      })
    );
  }

  render() {
    return html`
      <div part="container">
        <div part="toolbar">
          <slot name="toolbar-start"></slot>
          <!-- Toolbar buttons -->
          <slot name="toolbar-end"></slot>
        </div>
        <div
          part="editor"
          contenteditable="${!this.readonly && !this.disabled}"
          spellcheck="${this.spellcheck}"
          @focus="${this._handleFocus}"
          @blur="${this._handleBlur}"
          @input="${this._emitChange}"
        >
          ${this.value}
        </div>
        <div part="statusbar">
          ${this.showCharCount ? html`<span>${this.getCharCount()} chars</span>` : ''}
          ${this.showWordCount ? html`<span>${this.getWordCount()} words</span>` : ''}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'wysiwyg-editor': WysiwygEditor;
  }
}
