/**
 * Expression Evaluator
 *
 * Evaluates AST expressions against a row context to produce runtime Values.
 * This bridges the parser (AST) and the type system (Values).
 *
 * The evaluator:
 * - Recursively traverses expression trees
 * - Looks up column values from the current row
 * - Applies operators using the comparison and arithmetic modules
 * - Handles NULL propagation per SQL semantics
 */

import {
  Expression,
  BinaryOperator,
  UnaryOperator,
  LiteralExpression,
} from "../sql/ast.js";

import {
  Value,
  NULL,
  integer,
  real,
  text,
  boolean,
  isBoolean,
  isNull,
} from "../types/value.js";

import {
  equals,
  notEquals,
  lessThan,
  greaterThan,
  lessThanOrEqual,
  greaterThanOrEqual,
  and,
  or,
  not,
} from "../types/comparison.js";

import { add, subtract, multiply, divide, negate } from "../types/arithmetic.js";

// =============================================================================
// Evaluation Context
// =============================================================================

/**
 * The evaluation context provides column values for the current row.
 *
 * When evaluating an expression like `price * quantity`, the evaluator
 * looks up "price" and "quantity" in this context to get their Values.
 */
export interface EvaluationContext {
  /**
   * Get the value of a column in the current row.
   * Returns undefined if the column doesn't exist.
   */
  getColumn(name: string, table?: string): Value | undefined;
}

/**
 * A simple Map-based evaluation context.
 *
 * Column names are case-insensitive (converted to uppercase for lookup).
 */
export class RowContext implements EvaluationContext {
  private columns: Map<string, Value>;

  constructor(columns?: Record<string, Value>) {
    this.columns = new Map();
    if (columns) {
      for (const [name, value] of Object.entries(columns)) {
        this.columns.set(name.toUpperCase(), value);
      }
    }
  }

  getColumn(name: string): Value | undefined {
    return this.columns.get(name.toUpperCase());
  }

  /**
   * Set a column value.
   */
  setColumn(name: string, value: Value): void {
    this.columns.set(name.toUpperCase(), value);
  }
}

// =============================================================================
// Evaluation Errors
// =============================================================================

export class EvaluationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EvaluationError";
  }
}

// =============================================================================
// Expression Evaluator
// =============================================================================

/**
 * Evaluate an expression in the given context.
 *
 * @param expr - The AST expression to evaluate
 * @param context - The row context providing column values
 * @returns The computed Value
 * @throws EvaluationError if evaluation fails
 */
export function evaluate(expr: Expression, context: EvaluationContext): Value {
  switch (expr.type) {
    case "Literal":
      return evaluateLiteral(expr);

    case "ColumnRef":
      return evaluateColumnRef(expr.column, expr.table, context);

    case "Binary":
      return evaluateBinary(expr.operator, expr.left, expr.right, context);

    case "Unary":
      return evaluateUnary(expr.operator, expr.operand, context);

    case "FunctionCall":
      // Function calls will be implemented later (aggregates, scalar functions)
      throw new EvaluationError(
        `Function '${expr.name}' is not yet implemented`
      );
  }
}

// =============================================================================
// Literal Evaluation
// =============================================================================

/**
 * Convert an AST literal to a runtime Value.
 */
function evaluateLiteral(expr: LiteralExpression): Value {
  if (expr.dataType === "NULL" || expr.value === null) {
    return NULL;
  }

  switch (expr.dataType) {
    case "INTEGER":
      return integer(expr.value as number);
    case "REAL":
      return real(expr.value as number);
    case "TEXT":
      return text(expr.value as string);
    case "BOOLEAN":
      return boolean(expr.value as boolean);
  }
}

// =============================================================================
// Column Reference Evaluation
// =============================================================================

/**
 * Look up a column value in the context.
 */
function evaluateColumnRef(
  column: string,
  table: string | undefined,
  context: EvaluationContext
): Value {
  const value = context.getColumn(column, table);
  if (value === undefined) {
    throw new EvaluationError(
      table
        ? `Unknown column '${table}.${column}'`
        : `Unknown column '${column}'`
    );
  }
  return value;
}

// =============================================================================
// Binary Expression Evaluation
// =============================================================================

/**
 * Evaluate a binary operation.
 */
function evaluateBinary(
  operator: BinaryOperator,
  left: Expression,
  right: Expression,
  context: EvaluationContext
): Value {
  // Evaluate both operands first
  const leftValue = evaluate(left, context);
  const rightValue = evaluate(right, context);

  // Apply the operator
  switch (operator) {
    // Comparison operators
    case "=":
      return equals(leftValue, rightValue);
    case "<>":
      return notEquals(leftValue, rightValue);
    case "<":
      return lessThan(leftValue, rightValue);
    case ">":
      return greaterThan(leftValue, rightValue);
    case "<=":
      return lessThanOrEqual(leftValue, rightValue);
    case ">=":
      return greaterThanOrEqual(leftValue, rightValue);

    // Arithmetic operators
    case "+":
      return add(leftValue, rightValue);
    case "-":
      return subtract(leftValue, rightValue);
    case "*":
      return multiply(leftValue, rightValue);
    case "/":
      return divide(leftValue, rightValue);

    // Logical operators
    case "AND":
      return and(leftValue, rightValue);
    case "OR":
      return or(leftValue, rightValue);
  }
}

// =============================================================================
// Unary Expression Evaluation
// =============================================================================

/**
 * Evaluate a unary operation.
 */
function evaluateUnary(
  operator: UnaryOperator,
  operand: Expression,
  context: EvaluationContext
): Value {
  const value = evaluate(operand, context);

  switch (operator) {
    case "NOT":
      return not(value);
    case "-":
      return negate(value);
  }
}

// =============================================================================
// Helper: Evaluate to Boolean
// =============================================================================

/**
 * Evaluate an expression and expect a boolean result.
 * Used for WHERE clauses where we need TRUE/FALSE/NULL.
 *
 * @returns true if the result is TRUE, false if FALSE or NULL
 */
export function evaluateToBoolean(
  expr: Expression,
  context: EvaluationContext
): boolean {
  const value = evaluate(expr, context);

  if (isNull(value)) {
    // NULL is treated as FALSE in WHERE clauses
    return false;
  }

  if (!isBoolean(value)) {
    throw new EvaluationError(
      `WHERE clause requires BOOLEAN expression, got ${value.type}`
    );
  }

  return value.value;
}
