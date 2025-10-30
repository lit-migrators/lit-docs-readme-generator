import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';

interface DataItem {
  id: string;
  value: number;
}

interface FetchOptions {
  timeout?: number;
  retries?: number;
}

/**
 * A component with complex method signatures.
 */
@customElement('data-manager')
export class DataManager extends LitElement {
  /**
   * Current data items.
   */
  @property({ type: Array })
  items: DataItem[] = [];

  /**
   * Fetches data from a remote source.
   *
   * @param url - The URL to fetch from
   * @param options - Optional fetch configuration
   * @returns Promise resolving to fetched data
   */
  public async fetchData(url: string, options?: FetchOptions): Promise<DataItem[]> {
    const timeout = options?.timeout ?? 5000;
    const retries = options?.retries ?? 3;

    // Simulate fetch
    await new Promise((resolve) => setTimeout(resolve, timeout));

    return this.items;
  }

  /**
   * Filters items based on a predicate function.
   *
   * @param predicate - Function to test each item
   * @param limit - Maximum number of results
   * @returns Filtered array of items
   */
  public filter(predicate: (item: DataItem) => boolean, limit = 10): DataItem[] {
    return this.items.filter(predicate).slice(0, limit);
  }

  /**
   * Adds a new item to the collection.
   *
   * @param item - The item to add
   */
  public addItem(item: DataItem): void {
    this.items = [...this.items, item];
    this.dispatchEvent(new CustomEvent<DataItem>('item-added', {
      detail: item,
      bubbles: true,
    }));
  }

  /**
   * Removes an item by ID.
   *
   * @param id - The ID of the item to remove
   * @returns True if item was found and removed
   */
  public removeItem(id: string): boolean {
    const initialLength = this.items.length;
    this.items = this.items.filter((item) => item.id !== id);
    return this.items.length < initialLength;
  }

  /**
   * Calculates aggregate statistics.
   *
   * @param field - Optional field to aggregate (defaults to 'value')
   * @returns Object containing min, max, and average
   */
  public calculateStats(field: keyof DataItem = 'value'): { min: number; max: number; avg: number } {
    const values = this.items.map((item) => Number(item[field]));

    if (values.length === 0) {
      return { min: 0, max: 0, avg: 0 };
    }

    return {
      min: Math.min(...values),
      max: Math.max(...values),
      avg: values.reduce((a, b) => a + b, 0) / values.length,
    };
  }

  /**
   * Transforms items using a mapper function.
   *
   * @param mapper - Transformation function
   * @param onProgress - Optional progress callback
   * @returns Promise resolving when transformation completes
   */
  public async transform<T>(
    mapper: (item: DataItem, index: number) => T,
    onProgress?: (progress: number) => void
  ): Promise<T[]> {
    const results: T[] = [];

    for (let i = 0; i < this.items.length; i++) {
      results.push(mapper(this.items[i], i));

      if (onProgress) {
        onProgress((i + 1) / this.items.length);
      }
    }

    return results;
  }

  render() {
    return html`<div>${this.items.length} items</div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'data-manager': DataManager;
  }
}
