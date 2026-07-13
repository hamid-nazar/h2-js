/**
 * Query Executor
 *
 * Ties together the parser, evaluator, and operators to execute SQL queries.
 *
 * The executor:
 * 1. Takes a parsed Statement AST
 * 2. Builds an operator tree for SELECT queries
 * 3. Executes the tree and returns results
 */

import {
  Statement,
  SelectStatement,
  InsertStatement,
  UpdateStatement,
  DeleteStatement,
} from "../sql/ast.js";
import { Value } from "../types/value.js";
import { evaluate, RowContext } from "./evaluator.js";
import { Operator, Row, Scan, Filter, Project, Limit } from "./operator.js";
import { TableStore } from "./store.js";

// =============================================================================
// Execution Result
// =============================================================================

/**
 * Result of executing a query.
 */
export type ExecutionResult =
  | SelectResult
  | InsertResult
  | UpdateResult
  | DeleteResult
  | CreateTableResult
  | DropTableResult;

export interface SelectResult {
  type: "select";
  columns: string[];
  rows: Value[][];
}

export interface InsertResult {
  type: "insert";
  rowsAffected: number;
}

export interface UpdateResult {
  type: "update";
  rowsAffected: number;
}

export interface DeleteResult {
  type: "delete";
  rowsAffected: number;
}

export interface CreateTableResult {
  type: "createTable";
  tableName: string;
}

export interface DropTableResult {
  type: "dropTable";
  tableName: string;
}

// =============================================================================
// Operator Tree Builder
// =============================================================================

/**
 * Build an operator tree from a SELECT statement.
 *
 * The tree is built bottom-up:
 * 1. Scan (FROM)
 * 2. Filter (WHERE)
 * 3. Project (SELECT)
 * 4. Limit (LIMIT)
 */
export function buildSelectOperator(
  stmt: SelectStatement,
  store: TableStore
): Operator {
  // 1. Start with Scan
  const columnNames = store.getColumnNames(stmt.from);
  const rows = store.getRows(stmt.from);
  let op: Operator = new Scan(stmt.from, columnNames, rows);

  // 2. Add Filter if WHERE clause exists
  if (stmt.where) {
    op = new Filter(op, stmt.where);
  }

  // 3. Add Project for SELECT columns
  op = new Project(op, stmt.columns);

  // 4. Add Limit if LIMIT clause exists
  if (stmt.limit !== undefined) {
    op = new Limit(op, stmt.limit);
  }

  return op;
}

/**
 * Execute an operator tree and collect all rows.
 */
export function collectResults(op: Operator): { columns: string[]; rows: Value[][] } {
  const rows: Value[][] = [];
  op.open();

  let row: Row | null = op.next();
  while (row !== null) {
    rows.push(row.values);
    row = op.next();
  }

  const columns = op.getColumns();
  op.close();

  return { columns, rows };
}

// =============================================================================
// Query Executor
// =============================================================================

/**
 * Execute a SELECT statement and return results.
 */
export function executeSelect(
  stmt: SelectStatement,
  store: TableStore
): SelectResult {
  const op = buildSelectOperator(stmt, store);
  const { columns, rows } = collectResults(op);
  return { type: "select", columns, rows };
}

/**
 * Execute an INSERT statement.
 */
export function executeInsert(
  stmt: InsertStatement,
  store: TableStore
): InsertResult {
  const table = store.getTable(stmt.table);
  const tableColumns = table.metadata.columns.map((c) => c.name.toUpperCase());

  // Build a value array in table column order
  const values: (Value | undefined)[] = new Array<Value | undefined>(
    tableColumns.length
  ).fill(undefined);

  // Map provided columns to their positions
  for (let i = 0; i < stmt.columns.length; i++) {
    const stmtCol = stmt.columns[i];
    if (stmtCol === undefined) continue;

    const colName = stmtCol.toUpperCase();
    const colIndex = tableColumns.indexOf(colName);
    if (colIndex === -1) {
      throw new Error(`Unknown column '${stmtCol}' in table '${stmt.table}'`);
    }
    // Evaluate the expression to get the value
    const expr = stmt.values[i];
    if (!expr) {
      throw new Error(`Missing value for column '${stmtCol}'`);
    }
    const value = evaluate(expr, new RowContext());
    values[colIndex] = value;
  }

  // Check that all columns have values (or should have defaults - not implemented yet)
  const finalValues: Value[] = [];
  for (let i = 0; i < values.length; i++) {
    const val = values[i];
    if (val === undefined) {
      const colDef = table.metadata.columns[i];
      throw new Error(
        `No value provided for column '${colDef?.name ?? String(i)}'`
      );
    }
    finalValues.push(val);
  }

  store.insert(stmt.table, finalValues);
  return { type: "insert", rowsAffected: 1 };
}

/**
 * Execute an UPDATE statement.
 *
 * UPDATE table SET col1 = val1, col2 = val2 WHERE condition
 */
export function executeUpdate(
  stmt: UpdateStatement,
  store: TableStore
): UpdateResult {
  const table = store.getTable(stmt.table);
  const columnNames = table.metadata.columns.map((c) => c.name.toUpperCase());
  const rows = store.getRows(stmt.table);

  let rowsAffected = 0;

  // Iterate through all rows and update matching ones
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    // Build evaluation context for this row
    const ctx = new RowContext();
    for (let j = 0; j < columnNames.length; j++) {
      const colName = columnNames[j];
      const value = row[j];
      if (colName !== undefined && value !== undefined) {
        ctx.setColumn(colName, value);
      }
    }

    // Check if row matches WHERE clause (if present)
    let matches = true;
    if (stmt.where) {
      const whereResult = evaluate(stmt.where, ctx);
      // NULL or FALSE means no match
      if (whereResult.type !== "BOOLEAN" || !whereResult.value) {
        matches = false;
      }
    }

    if (matches) {
      // Apply assignments to create new row
      const newRow = [...row];
      for (const assignment of stmt.assignments) {
        const colIndex = columnNames.indexOf(assignment.column.toUpperCase());
        if (colIndex === -1) {
          throw new Error(
            `Unknown column '${assignment.column}' in table '${stmt.table}'`
          );
        }
        // Evaluate the new value in the context of the current row
        const newValue = evaluate(assignment.value, ctx);
        newRow[colIndex] = newValue;
      }
      store.updateRow(stmt.table, i, newRow);
      rowsAffected++;
    }
  }

  return { type: "update", rowsAffected };
}

/**
 * Execute a DELETE statement.
 *
 * DELETE FROM table WHERE condition
 */
export function executeDelete(
  stmt: DeleteStatement,
  store: TableStore
): DeleteResult {
  const table = store.getTable(stmt.table);
  const columnNames = table.metadata.columns.map((c) => c.name.toUpperCase());
  const rows = store.getRows(stmt.table);

  const indicesToDelete: number[] = [];

  // Find rows matching the WHERE clause
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    // Build evaluation context for this row
    const ctx = new RowContext();
    for (let j = 0; j < columnNames.length; j++) {
      const colName = columnNames[j];
      const value = row[j];
      if (colName !== undefined && value !== undefined) {
        ctx.setColumn(colName, value);
      }
    }

    // Check if row matches WHERE clause (if present)
    let matches = true;
    if (stmt.where) {
      const whereResult = evaluate(stmt.where, ctx);
      // NULL or FALSE means no match
      if (whereResult.type !== "BOOLEAN" || !whereResult.value) {
        matches = false;
      }
    }

    if (matches) {
      indicesToDelete.push(i);
    }
  }

  // Delete matching rows
  store.deleteRows(stmt.table, indicesToDelete);

  return { type: "delete", rowsAffected: indicesToDelete.length };
}

/**
 * Execute any statement.
 */
export function execute(stmt: Statement, store: TableStore): ExecutionResult {
  switch (stmt.type) {
    case "SelectStatement":
      return executeSelect(stmt, store);

    case "InsertStatement":
      return executeInsert(stmt, store);

    case "CreateTableStatement":
      store.createTable(stmt.table, stmt.columns);
      return { type: "createTable", tableName: stmt.table };

    case "DropTableStatement":
      store.dropTable(stmt.table);
      return { type: "dropTable", tableName: stmt.table };

    case "UpdateStatement":
      return executeUpdate(stmt, store);

    case "DeleteStatement":
      return executeDelete(stmt, store);

    case "BeginStatement":
      throw new Error("BEGIN not yet implemented");

    case "CommitStatement":
      throw new Error("COMMIT not yet implemented");

    case "RollbackStatement":
      throw new Error("ROLLBACK not yet implemented");
  }
}
