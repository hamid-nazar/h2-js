/**
 * Volcano-Model Operators
 *
 * The Volcano model (iterator model) is a pull-based execution model where:
 * - Each operator implements open/next/close methods
 * - Operators form a tree; the root pulls rows from children
 * - Data flows upward one row at a time
 *
 * This is memory-efficient (one row at a time) and composable (operators
 * snap together like building blocks).
 */

import { Value } from "../types/value.js";
import { Expression, SelectColumn } from "../sql/ast.js";
import {
  evaluate,
  evaluateToBoolean,
  EvaluationContext,
  RowContext,
} from "./evaluator.js";

// =============================================================================
// Row Type
// =============================================================================

/**
 * A row is an ordered array of column values with associated column names.
 *
 * We store both the values and the schema (column names) so operators
 * can look up columns by name and pass schema information downstream.
 */
export interface Row {
  /** Column names in order */
  columns: string[];
  /** Values in the same order as columns */
  values: Value[];
}

/**
 * Create a row from column names and values.
 */
export function createRow(columns: string[], values: Value[]): Row {
  if (columns.length !== values.length) {
    throw new Error(
      `Column count (${String(columns.length)}) doesn't match value count (${String(values.length)})`
    );
  }
  return { columns, values };
}

/**
 * Get a value from a row by column name (case-insensitive).
 */
export function getColumnValue(row: Row, column: string): Value | undefined {
  const upperColumn = column.toUpperCase();
  const index = row.columns.findIndex((c) => c.toUpperCase() === upperColumn);
  if (index === -1) return undefined;
  return row.values[index];
}

/**
 * Convert a Row to an EvaluationContext for expression evaluation.
 */
export function rowToContext(row: Row): EvaluationContext {
  const ctx = new RowContext();
  for (let i = 0; i < row.columns.length; i++) {
    const colName = row.columns[i];
    const value = row.values[i];
    if (colName !== undefined && value !== undefined) {
      ctx.setColumn(colName, value);
    }
  }
  return ctx;
}

// =============================================================================
// Operator Interface
// =============================================================================

/**
 * Base interface for all Volcano-model operators.
 *
 * The execution lifecycle:
 * 1. open() - initialize the operator and its children
 * 2. next() - repeatedly call to get rows until null
 * 3. close() - clean up resources
 */
export interface Operator {
  /**
   * Initialize the operator. Must be called before next().
   * Opens child operators recursively.
   */
  open(): void;

  /**
   * Get the next row, or null if no more rows.
   * Each call advances the operator's internal state.
   */
  next(): Row | null;

  /**
   * Clean up resources. Closes child operators recursively.
   */
  close(): void;

  /**
   * Get the output schema (column names) for this operator.
   * Available after open() is called.
   */
  getColumns(): string[];
}

// =============================================================================
// Scan Operator
// =============================================================================

/**
 * Scans an in-memory table, returning rows one at a time.
 *
 * This is the leaf operator - it doesn't have children, it reads from
 * a data source (for now, an in-memory array).
 */
export class Scan implements Operator {
  private index: number = 0;
  private isOpen: boolean = false;

  constructor(
    private tableName: string,
    private columns: string[],
    private rows: Value[][]
  ) {}

  open(): void {
    this.index = 0;
    this.isOpen = true;
  }

  next(): Row | null {
    if (!this.isOpen) {
      throw new Error("Operator not open");
    }
    if (this.index >= this.rows.length) {
      return null;
    }
    const values = this.rows[this.index];
    this.index++;
    // values is guaranteed to exist since we checked index bounds
    return createRow(this.columns, values as Value[]);
  }

  close(): void {
    this.isOpen = false;
  }

  getColumns(): string[] {
    return this.columns;
  }

  getTableName(): string {
    return this.tableName;
  }
}

// =============================================================================
// Filter Operator
// =============================================================================

/**
 * Filters rows based on a predicate expression (WHERE clause).
 *
 * Pulls rows from its child and only passes through rows where
 * the predicate evaluates to TRUE.
 */
export class Filter implements Operator {
  private isOpen: boolean = false;

  constructor(
    private child: Operator,
    private predicate: Expression
  ) {}

  open(): void {
    this.child.open();
    this.isOpen = true;
  }

  next(): Row | null {
    if (!this.isOpen) {
      throw new Error("Operator not open");
    }

    // Keep pulling rows until we find one that passes the predicate
    for (;;) {
      const row = this.child.next();
      if (row === null) {
        return null;
      }

      // Evaluate predicate in the context of this row
      const context = rowToContext(row);
      if (evaluateToBoolean(this.predicate, context)) {
        return row;
      }
      // Row filtered out, continue to next
    }
  }

  close(): void {
    this.child.close();
    this.isOpen = false;
  }

  getColumns(): string[] {
    return this.child.getColumns();
  }
}

// =============================================================================
// Project Operator
// =============================================================================

/**
 * Projects (selects) specific columns or computes expressions.
 *
 * Handles:
 * - SELECT * (all columns)
 * - SELECT col1, col2 (specific columns)
 * - SELECT col1, expr AS alias (computed columns)
 */
export class Project implements Operator {
  private isOpen: boolean = false;
  private outputColumns: string[] = [];

  constructor(
    private child: Operator,
    private selectColumns: SelectColumn[]
  ) {}

  open(): void {
    this.child.open();
    this.isOpen = true;
    this.outputColumns = this.computeOutputColumns();
  }

  private computeOutputColumns(): string[] {
    const columns: string[] = [];
    const childColumns = this.child.getColumns();

    for (const col of this.selectColumns) {
      if (col.type === "AllColumns") {
        // SELECT * - include all child columns
        columns.push(...childColumns);
      } else {
        // Expression with optional alias
        if (col.alias) {
          columns.push(col.alias);
        } else if (col.expression.type === "ColumnRef") {
          columns.push(col.expression.column);
        } else {
          // Computed expression without alias - use a generated name
          columns.push(`expr_${String(columns.length)}`);
        }
      }
    }

    return columns;
  }

  next(): Row | null {
    if (!this.isOpen) {
      throw new Error("Operator not open");
    }

    const row = this.child.next();
    if (row === null) {
      return null;
    }

    // Project the row to output columns
    const context = rowToContext(row);
    const values: Value[] = [];

    for (const col of this.selectColumns) {
      if (col.type === "AllColumns") {
        // SELECT * - include all values
        values.push(...row.values);
      } else {
        // Evaluate the expression
        const value = evaluate(col.expression, context);
        values.push(value);
      }
    }

    return createRow(this.outputColumns, values);
  }

  close(): void {
    this.child.close();
    this.isOpen = false;
  }

  getColumns(): string[] {
    return this.outputColumns;
  }
}

// =============================================================================
// Limit Operator
// =============================================================================

/**
 * Limits the number of rows returned (LIMIT clause).
 *
 * Returns at most `limit` rows, then stops.
 */
export class Limit implements Operator {
  private isOpen: boolean = false;
  private count: number = 0;

  constructor(
    private child: Operator,
    private limit: number
  ) {}

  open(): void {
    this.child.open();
    this.count = 0;
    this.isOpen = true;
  }

  next(): Row | null {
    if (!this.isOpen) {
      throw new Error("Operator not open");
    }

    if (this.count >= this.limit) {
      return null;
    }

    const row = this.child.next();
    if (row === null) {
      return null;
    }

    this.count++;
    return row;
  }

  close(): void {
    this.child.close();
    this.isOpen = false;
  }

  getColumns(): string[] {
    return this.child.getColumns();
  }
}
