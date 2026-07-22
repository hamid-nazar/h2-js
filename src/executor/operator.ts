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

import { Value, isNull } from "../types/value.js";
import { Expression, SelectColumn, OrderByItem } from "../sql/ast.js";
import { lessThan } from "../types/comparison.js";
import {
  evaluate,
  evaluateToBoolean,
  EvaluationContext,
  RowContext,
} from "./evaluator.js";
import {
  Aggregate as AggregateFunction,
  createAggregate,
  isAggregateFunction,
} from "./aggregate.js";

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
// Sort Operator
// =============================================================================

/**
 * Sorts rows based on ORDER BY expressions.
 *
 * Unlike other operators, Sort must materialize all rows from its child
 * before returning any. This breaks the streaming property but is inherent
 * to sorting.
 *
 * NULL handling follows SQL standard:
 * - ASC: NULLs sort last
 * - DESC: NULLs sort first
 */
export class Sort implements Operator {
  private isOpen: boolean = false;
  private sortedRows: Row[] = [];
  private index: number = 0;

  constructor(
    private child: Operator,
    private orderBy: OrderByItem[]
  ) {}

  open(): void {
    this.child.open();
    this.isOpen = true;

    // Materialize all rows from child
    const rows: Row[] = [];
    let row = this.child.next();
    while (row !== null) {
      rows.push(row);
      row = this.child.next();
    }

    // Sort rows
    this.sortedRows = this.sortRows(rows);
    this.index = 0;
  }

  private sortRows(rows: Row[]): Row[] {
    return [...rows].sort((a, b) => this.compareRows(a, b));
  }

  private compareRows(a: Row, b: Row): number {
    for (const item of this.orderBy) {
      const ctxA = rowToContext(a);
      const ctxB = rowToContext(b);

      const valueA = evaluate(item.expression, ctxA);
      const valueB = evaluate(item.expression, ctxB);

      const cmp = this.compareValues(valueA, valueB, item.direction);
      if (cmp !== 0) {
        return cmp;
      }
      // Values are equal, continue to next sort key
    }
    return 0; // All sort keys are equal
  }

  private compareValues(a: Value, b: Value, direction: "ASC" | "DESC"): number {
    const aIsNull = isNull(a);
    const bIsNull = isNull(b);

    // Handle NULL sorting (SQL standard: NULLs last for ASC, first for DESC)
    if (aIsNull && bIsNull) return 0;
    if (aIsNull) return direction === "ASC" ? 1 : -1;
    if (bIsNull) return direction === "ASC" ? -1 : 1;

    // Compare non-NULL values using lessThan
    try {
      const aLessThanB = lessThan(a, b);
      const bLessThanA = lessThan(b, a);

      // lessThan returns BooleanValue or NullValue
      const aLtB = aLessThanB.type === "BOOLEAN" && aLessThanB.value;
      const bLtA = bLessThanA.type === "BOOLEAN" && bLessThanA.value;

      let result: number;
      if (aLtB) {
        result = -1;
      } else if (bLtA) {
        result = 1;
      } else {
        result = 0;
      }

      // Reverse for DESC
      return direction === "DESC" ? -result : result;
    } catch {
      // Types not comparable, treat as equal
      return 0;
    }
  }

  next(): Row | null {
    if (!this.isOpen) {
      throw new Error("Operator not open");
    }

    if (this.index >= this.sortedRows.length) {
      return null;
    }

    const row = this.sortedRows[this.index];
    this.index++;
    return row ?? null;
  }

  close(): void {
    this.child.close();
    this.sortedRows = [];
    this.isOpen = false;
  }

  getColumns(): string[] {
    return this.child.getColumns();
  }
}

// =============================================================================
// Aggregate Operator
// =============================================================================

/**
 * Specification for an aggregate computation.
 */
export interface AggregateSpec {
  /** The aggregate function name (COUNT, SUM, etc.) */
  name: string;
  /** The expression to aggregate (null for COUNT(*)) */
  expression: Expression | null;
  /** Output column name */
  outputName: string;
}

/**
 * Aggregates rows into a single summary row.
 *
 * Unlike other operators, Aggregate must consume ALL input rows before
 * producing output. It always produces exactly one row (or zero if the
 * input is empty and there are no aggregates).
 *
 * Example: SELECT COUNT(*), SUM(price), AVG(quantity) FROM products
 */
export class Aggregate implements Operator {
  private isOpen: boolean = false;
  private resultRow: Row | null = null;
  private returned: boolean = false;

  constructor(
    private child: Operator,
    private specs: AggregateSpec[]
  ) {}

  open(): void {
    this.child.open();
    this.isOpen = true;
    this.returned = false;

    // Create aggregate instances
    const aggregates: AggregateFunction[] = this.specs.map((spec) => {
      const isCountStar = spec.name.toUpperCase() === "COUNT" && spec.expression === null;
      return createAggregate(spec.name, isCountStar);
    });

    // Initialize all aggregates
    for (const agg of aggregates) {
      agg.init();
    }

    // Process all input rows
    let row = this.child.next();
    let hasRows = false;

    while (row !== null) {
      hasRows = true;
      const context = rowToContext(row);

      // Accumulate each aggregate
      for (let i = 0; i < this.specs.length; i++) {
        const spec = this.specs[i];
        const agg = aggregates[i];

        if (spec && agg) {
          if (spec.expression === null) {
            // COUNT(*) - pass a dummy non-null value
            agg.accumulate({ type: "INTEGER", value: 1 });
          } else {
            const value = evaluate(spec.expression, context);
            agg.accumulate(value);
          }
        }
      }

      row = this.child.next();
    }

    // Build result row (even for empty input, aggregates return values)
    // COUNT(*) returns 0 for empty input, others return NULL
    const columns = this.specs.map((spec) => spec.outputName);
    const values = aggregates.map((agg) => agg.finalize());

    // For empty input with no aggregates, return no rows
    // For empty input with aggregates, return one row with results
    if (this.specs.length > 0 || hasRows) {
      this.resultRow = createRow(columns, values);
    } else {
      this.resultRow = null;
    }
  }

  next(): Row | null {
    if (!this.isOpen) {
      throw new Error("Operator not open");
    }

    if (this.returned || this.resultRow === null) {
      return null;
    }

    this.returned = true;
    return this.resultRow;
  }

  close(): void {
    this.child.close();
    this.resultRow = null;
    this.isOpen = false;
  }

  getColumns(): string[] {
    return this.specs.map((spec) => spec.outputName);
  }
}

/**
 * Check if a SelectColumn contains an aggregate function.
 */
export function hasAggregateInColumn(col: SelectColumn): boolean {
  if (col.type === "AllColumns") {
    return false;
  }
  return hasAggregateInExpression(col.expression);
}

/**
 * Check if an expression contains an aggregate function.
 */
export function hasAggregateInExpression(expr: Expression): boolean {
  switch (expr.type) {
    case "Literal":
    case "ColumnRef":
      return false;

    case "FunctionCall":
      return isAggregateFunction(expr.name);

    case "Binary":
      return (
        hasAggregateInExpression(expr.left) ||
        hasAggregateInExpression(expr.right)
      );

    case "Unary":
      return hasAggregateInExpression(expr.operand);
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
