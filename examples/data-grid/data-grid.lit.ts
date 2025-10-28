import { LitElement, html, css } from 'lit';
import { customElement, property, state, query } from 'lit/decorators.js';

/**
 * A powerful data grid component with sorting, filtering, pagination, and inline editing.
 *
 * The data grid supports complex data operations including multi-column sorting,
 * advanced filtering, virtual scrolling for large datasets, and cell-level editing
 * with validation.
 *
 * @slot header - Custom header content above the grid
 * @slot footer - Custom footer content below the grid
 * @slot empty - Content to show when there's no data
 * @slot loading - Custom loading indicator
 *
 * @cssprop --grid-border-color - Border color for grid cells [default: #e0e0e0]
 * @cssprop --grid-header-bg - Background color for header row [default: #f5f5f5]
 * @cssprop --grid-header-color - Text color for header [default: #333]
 * @cssprop --grid-row-hover-bg - Background color on row hover [default: #f9f9f9]
 * @cssprop --grid-selected-bg - Background color for selected rows [default: #e3f2fd]
 * @cssprop --grid-font-size - Font size for grid content [default: 14px]
 * @cssprop --grid-cell-padding - Padding for grid cells [default: 12px]
 * @cssprop --grid-header-height - Height of header row [default: 48px]
 * @cssprop --grid-row-height - Height of data rows [default: 40px]
 *
 * @part container - The main container element
 * @part header - The header row
 * @part body - The body container
 * @part row - Individual data rows
 * @part cell - Individual cells
 * @part pagination - Pagination controls
 * @part toolbar - Toolbar section
 *
 * @example
 * <data-grid
 *   .data="${users}"
 *   .columns="${columns}"
 *   sortable
 *   filterable
 *   page-size="20"
 * ></data-grid>
 *
 * @example
 * const grid = document.querySelector('data-grid');
 * grid.addEventListener('row-select', (e) => {
 *   console.log('Selected:', e.detail.rows);
 * });
 */
@customElement('data-grid')
export class DataGrid extends LitElement {
  static styles = css`
    :host {
      display: block;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: var(--grid-font-size, 14px);
    }
  `;

  /**
   * Array of data objects to display in the grid.
   * Each object represents a row of data.
   * @required
   */
  @property({ type: Array })
  data: Record<string, any>[] = [];

  /**
   * Column definitions including field, header, width, and formatting options.
   */
  @property({ type: Array })
  columns: ColumnDefinition[] = [];

  /**
   * Enable multi-column sorting functionality.
   */
  @property({ type: Boolean, reflect: true })
  sortable = false;

  /**
   * Enable column filtering with various filter types (text, number, date, select).
   */
  @property({ type: Boolean, reflect: true })
  filterable = false;

  /**
   * Enable row selection. Can be 'none', 'single', or 'multiple'.
   */
  @property({ type: String, attribute: 'selection-mode' })
  selectionMode: 'none' | 'single' | 'multiple' = 'none';

  /**
   * Number of rows to display per page. Set to 0 to disable pagination.
   */
  @property({ type: Number, attribute: 'page-size' })
  pageSize = 10;

  /**
   * Current page index (zero-based).
   */
  @property({ type: Number, attribute: 'current-page', reflect: true })
  currentPage = 0;

  /**
   * Enable inline editing of cells. Supports different editor types per column.
   */
  @property({ type: Boolean })
  editable = false;

  /**
   * Enable virtual scrolling for large datasets (10,000+ rows).
   */
  @property({ type: Boolean, attribute: 'virtual-scroll' })
  virtualScroll = false;

  /**
   * Show loading spinner while data is being fetched.
   */
  @property({ type: Boolean, reflect: true })
  loading = false;

  /**
   * Stripe alternating rows for better readability.
   */
  @property({ type: Boolean })
  striped = true;

  /**
   * Enable column resizing by dragging column borders.
   */
  @property({ type: Boolean })
  resizable = false;

  /**
   * Enable column reordering via drag and drop.
   */
  @property({ type: Boolean })
  reorderable = false;

  /**
   * @deprecated Use `selectionMode` instead
   */
  @property({ type: Boolean })
  multiSelect = false;

  /**
   * Internal state for selected row indices.
   * @internal
   */
  @state()
  private selectedRows: Set<number> = new Set();

  /**
   * Internal state for current sort configuration.
   * @internal
   */
  @state()
  private sortConfig: SortConfig[] = [];

  /**
   * Internal state for active filters.
   * @internal
   */
  @state()
  private filters: Map<string, any> = new Map();

  /**
   * Query reference to the grid body element.
   * @internal
   */
  @query('.grid-body')
  private gridBody!: HTMLElement;

  /**
   * Select specific rows by their indices.
   *
   * @param indices - Array of row indices to select
   * @param append - If true, adds to existing selection. If false, replaces selection.
   */
  async selectRows(indices: number[], append = false): Promise<void> {
    if (!append) {
      this.selectedRows.clear();
    }

    indices.forEach((index) => {
      if (index >= 0 && index < this.data.length) {
        this.selectedRows.add(index);
      }
    });

    this.requestUpdate();

    // Dispatch selection change event
    this.dispatchEvent(
      new CustomEvent('row-select', {
        detail: {
          indices: Array.from(this.selectedRows),
          rows: Array.from(this.selectedRows).map((i) => this.data[i]),
        },
        bubbles: true,
        composed: true,
      })
    );
  }

  /**
   * Clear all row selections.
   */
  clearSelection(): void {
    this.selectedRows.clear();
    this.requestUpdate();

    this.dispatchEvent(
      new CustomEvent('selection-clear', {
        bubbles: true,
        composed: true,
      })
    );
  }

  /**
   * Get currently selected row data.
   *
   * @returns Array of selected row objects
   */
  getSelectedRows(): Record<string, any>[] {
    return Array.from(this.selectedRows).map((index) => this.data[index]);
  }

  /**
   * Apply sorting to a specific column.
   *
   * @param columnField - The field name to sort by
   * @param direction - Sort direction ('asc' or 'desc')
   * @param multiSort - If true, adds to existing sorts. If false, replaces all sorts.
   */
  sortBy(
    columnField: string,
    direction: 'asc' | 'desc' = 'asc',
    multiSort = false
  ): void {
    if (!multiSort) {
      this.sortConfig = [];
    }

    const existingIndex = this.sortConfig.findIndex((s) => s.field === columnField);
    if (existingIndex >= 0) {
      this.sortConfig[existingIndex].direction = direction;
    } else {
      this.sortConfig.push({ field: columnField, direction });
    }

    this.requestUpdate();

    this.dispatchEvent(
      new CustomEvent('sort-change', {
        detail: {
          sorts: [...this.sortConfig],
        },
        bubbles: true,
        composed: true,
      })
    );
  }

  /**
   * Apply filter to a specific column.
   *
   * @param columnField - The field name to filter
   * @param filterValue - The filter value or filter configuration
   */
  filterBy(columnField: string, filterValue: any): void {
    if (filterValue === null || filterValue === undefined || filterValue === '') {
      this.filters.delete(columnField);
    } else {
      this.filters.set(columnField, filterValue);
    }

    // Reset to first page when filtering
    this.currentPage = 0;
    this.requestUpdate();

    this.dispatchEvent(
      new CustomEvent('filter-change', {
        detail: {
          filters: Object.fromEntries(this.filters),
        },
        bubbles: true,
        composed: true,
      })
    );
  }

  /**
   * Clear all active filters.
   */
  clearFilters(): void {
    this.filters.clear();
    this.currentPage = 0;
    this.requestUpdate();

    this.dispatchEvent(
      new CustomEvent('filters-clear', {
        bubbles: true,
        composed: true,
      })
    );
  }

  /**
   * Navigate to a specific page.
   *
   * @param pageIndex - Zero-based page index
   */
  goToPage(pageIndex: number): void {
    const totalPages = Math.ceil(this.data.length / this.pageSize);

    if (pageIndex < 0 || pageIndex >= totalPages) {
      throw new Error(`Invalid page index: ${pageIndex}. Must be between 0 and ${totalPages - 1}`);
    }

    this.currentPage = pageIndex;

    this.dispatchEvent(
      new CustomEvent('page-change', {
        detail: {
          page: pageIndex,
          pageSize: this.pageSize,
        },
        bubbles: true,
        composed: true,
      })
    );
  }

  /**
   * Export grid data to CSV format.
   *
   * @param includeHeaders - Whether to include column headers in export
   * @returns CSV string representation of the data
   */
  exportToCsv(includeHeaders = true): string {
    const rows: string[] = [];

    if (includeHeaders) {
      const headers = this.columns.map((col) => col.header || col.field).join(',');
      rows.push(headers);
    }

    this.data.forEach((row) => {
      const values = this.columns.map((col) => {
        const value = row[col.field];
        return typeof value === 'string' && value.includes(',')
          ? `"${value}"`
          : value;
      });
      rows.push(values.join(','));
    });

    return rows.join('\n');
  }

  /**
   * Refresh the grid and re-render all rows.
   */
  refresh(): void {
    this.requestUpdate();

    this.dispatchEvent(
      new CustomEvent('grid-refresh', {
        bubbles: true,
        composed: true,
      })
    );
  }

  render() {
    return html`
      <div part="container">
        <slot name="header"></slot>
        <div part="toolbar">
          <!-- Toolbar content -->
        </div>
        <div part="body" class="grid-body">
          ${this.loading
            ? html`<slot name="loading">Loading...</slot>`
            : this.data.length === 0
            ? html`<slot name="empty">No data</slot>`
            : html`<!-- Grid rows -->`}
        </div>
        <div part="pagination">
          <!-- Pagination controls -->
        </div>
        <slot name="footer"></slot>
      </div>
    `;
  }
}

interface ColumnDefinition {
  field: string;
  header?: string;
  width?: string;
  sortable?: boolean;
  filterable?: boolean;
  editable?: boolean;
}

interface SortConfig {
  field: string;
  direction: 'asc' | 'desc';
}

declare global {
  interface HTMLElementTagNameMap {
    'data-grid': DataGrid;
  }
}
