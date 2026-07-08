/**
 * In-Memory Table Store
 *
 * A simple storage layer for tables during query execution.
 * This is a temporary implementation for testing the executor;
 * it will later be replaced by the proper storage engine with
 * B+ trees and disk persistence.
 */

import { Value } from "../types/value.js";
import { ColumnDefinition } from "../sql/ast.js";

// =============================================================================
// Table Metadata
// =============================================================================

/**
 * Metadata about a table's structure.
 */
export interface TableMetadata {
  name: string;
  columns: ColumnDefinition[];
}

/**
 * A table with its metadata and row data.
 */
export interface Table {
  metadata: TableMetadata;
  rows: Value[][];
}

// =============================================================================
// Table Store
// =============================================================================

/**
 * In-memory storage for tables.
 *
 * Provides basic CRUD operations for testing the query executor.
 */
export class TableStore {
  private tables: Map<string, Table> = new Map();

  /**
   * Create a new table.
   *
   * @param name - Table name (case-insensitive, stored uppercase)
   * @param columns - Column definitions
   * @throws Error if table already exists
   */
  createTable(name: string, columns: ColumnDefinition[]): void {
    const upperName = name.toUpperCase();
    if (this.tables.has(upperName)) {
      throw new Error(`Table '${name}' already exists`);
    }
    this.tables.set(upperName, {
      metadata: { name: upperName, columns },
      rows: [],
    });
  }

  /**
   * Drop a table.
   *
   * @param name - Table name
   * @throws Error if table doesn't exist
   */
  dropTable(name: string): void {
    const upperName = name.toUpperCase();
    if (!this.tables.has(upperName)) {
      throw new Error(`Table '${name}' does not exist`);
    }
    this.tables.delete(upperName);
  }

  /**
   * Check if a table exists.
   */
  hasTable(name: string): boolean {
    return this.tables.has(name.toUpperCase());
  }

  /**
   * Get a table by name.
   *
   * @throws Error if table doesn't exist
   */
  getTable(name: string): Table {
    const upperName = name.toUpperCase();
    const table = this.tables.get(upperName);
    if (!table) {
      throw new Error(`Table '${name}' does not exist`);
    }
    return table;
  }

  /**
   * Get column names for a table.
   */
  getColumnNames(name: string): string[] {
    const table = this.getTable(name);
    return table.metadata.columns.map((c) => c.name);
  }

  /**
   * Get all rows from a table.
   */
  getRows(name: string): Value[][] {
    return this.getTable(name).rows;
  }

  /**
   * Insert a row into a table.
   *
   * @param name - Table name
   * @param values - Row values (must match column count)
   * @throws Error if value count doesn't match column count
   */
  insert(name: string, values: Value[]): void {
    const table = this.getTable(name);
    const expectedCount = table.metadata.columns.length;
    if (values.length !== expectedCount) {
      throw new Error(
        `Expected ${String(expectedCount)} values, got ${String(values.length)}`
      );
    }
    table.rows.push(values);
  }

  /**
   * Clear all rows from a table (for testing).
   */
  truncate(name: string): void {
    const table = this.getTable(name);
    table.rows = [];
  }

  /**
   * Update a row at a specific index.
   *
   * @param name - Table name
   * @param index - Row index
   * @param values - New row values
   */
  updateRow(name: string, index: number, values: Value[]): void {
    const table = this.getTable(name);
    if (index < 0 || index >= table.rows.length) {
      throw new Error(`Row index ${String(index)} out of bounds`);
    }
    table.rows[index] = values;
  }

  /**
   * Delete rows at specified indices.
   * Indices should be sorted in descending order to avoid shifting issues.
   *
   * @param name - Table name
   * @param indices - Row indices to delete (will be sorted descending)
   */
  deleteRows(name: string, indices: number[]): void {
    const table = this.getTable(name);
    // Sort descending so we delete from end first (avoids index shifting)
    const sortedIndices = [...indices].sort((a, b) => b - a);
    for (const index of sortedIndices) {
      if (index >= 0 && index < table.rows.length) {
        table.rows.splice(index, 1);
      }
    }
  }

  /**
   * List all table names.
   */
  listTables(): string[] {
    return Array.from(this.tables.keys());
  }
}
