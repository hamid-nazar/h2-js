/**
 * Arithmetic Operations
 *
 * Implements SQL arithmetic with:
 * - Three-valued logic: operations with NULL return NULL
 * - Type coercion: INTEGER + REAL promotes to REAL
 * - Type checking: arithmetic only on numeric types
 */

import {
  Value,
  NullValue,
  IntegerValue,
  RealValue,
  NULL,
  integer,
  real,
  isNull,
  isInteger,
  isNumeric,
} from "./value.js";

// =============================================================================
// Arithmetic Result Type
// =============================================================================

/**
 * Result of an arithmetic operation: either a numeric value or NULL.
 */
export type ArithmeticResult = IntegerValue | RealValue | NullValue;

// =============================================================================
// Arithmetic Error
// =============================================================================

export class ArithmeticError extends Error {
  constructor(
    message: string,
    public leftType: string,
    public rightType: string
  ) {
    super(message);
    this.name = "ArithmeticError";
  }
}

export class DivisionByZeroError extends Error {
  constructor() {
    super("Division by zero");
    this.name = "DivisionByZeroError";
  }
}

// =============================================================================
// Helper: Check numeric types
// =============================================================================

function requireNumeric(left: Value, right: Value, op: string): void {
  if (!isNull(left) && !isNumeric(left)) {
    throw new ArithmeticError(
      `${op} requires numeric operands, got ${left.type}`,
      left.type,
      right.type
    );
  }
  if (!isNull(right) && !isNumeric(right)) {
    throw new ArithmeticError(
      `${op} requires numeric operands, got ${right.type}`,
      left.type,
      right.type
    );
  }
}

/**
 * Determine if result should be REAL (if either operand is REAL).
 */
function shouldPromoteToReal(left: Value, right: Value): boolean {
  return !isInteger(left) || !isInteger(right);
}

// =============================================================================
// Arithmetic Operations
// =============================================================================

/**
 * SQL addition (+).
 *
 * Returns NULL if either operand is NULL.
 * Returns REAL if either operand is REAL, otherwise INTEGER.
 */
export function add(left: Value, right: Value): ArithmeticResult {
  requireNumeric(left, right, "+");

  if (isNull(left) || isNull(right)) {
    return NULL;
  }

  // At this point both are numeric (guaranteed by requireNumeric)
  const leftNum = left as IntegerValue | RealValue;
  const rightNum = right as IntegerValue | RealValue;
  const result = leftNum.value + rightNum.value;

  return shouldPromoteToReal(left, right) ? real(result) : integer(result);
}

/**
 * SQL subtraction (-).
 *
 * Returns NULL if either operand is NULL.
 */
export function subtract(left: Value, right: Value): ArithmeticResult {
  requireNumeric(left, right, "-");

  if (isNull(left) || isNull(right)) {
    return NULL;
  }

  const leftNum = left as IntegerValue | RealValue;
  const rightNum = right as IntegerValue | RealValue;
  const result = leftNum.value - rightNum.value;

  return shouldPromoteToReal(left, right) ? real(result) : integer(result);
}

/**
 * SQL multiplication (*).
 *
 * Returns NULL if either operand is NULL.
 */
export function multiply(left: Value, right: Value): ArithmeticResult {
  requireNumeric(left, right, "*");

  if (isNull(left) || isNull(right)) {
    return NULL;
  }

  const leftNum = left as IntegerValue | RealValue;
  const rightNum = right as IntegerValue | RealValue;
  const result = leftNum.value * rightNum.value;

  return shouldPromoteToReal(left, right) ? real(result) : integer(result);
}

/**
 * SQL division (/).
 *
 * Returns NULL if either operand is NULL.
 * Throws DivisionByZeroError if dividing by zero.
 *
 * Note: In SQL, integer division typically returns integer (truncated).
 * We follow this convention: 5 / 2 = 2, but 5.0 / 2 = 2.5
 */
export function divide(left: Value, right: Value): ArithmeticResult {
  requireNumeric(left, right, "/");

  if (isNull(left) || isNull(right)) {
    return NULL;
  }

  const leftNum = left as IntegerValue | RealValue;
  const rightNum = right as IntegerValue | RealValue;

  if (rightNum.value === 0) {
    throw new DivisionByZeroError();
  }

  const result = leftNum.value / rightNum.value;

  if (shouldPromoteToReal(left, right)) {
    return real(result);
  }
  // Integer division: truncate toward zero
  return integer(Math.trunc(result));
}

/**
 * SQL unary minus (-value).
 *
 * Returns NULL if operand is NULL.
 */
export function negate(value: Value): ArithmeticResult {
  if (isNull(value)) {
    return NULL;
  }

  if (!isNumeric(value)) {
    throw new ArithmeticError(
      `Unary minus requires numeric operand, got ${value.type}`,
      value.type,
      "numeric"
    );
  }

  // Handle -0 case: return 0 instead of -0
  const negated = value.value === 0 ? 0 : -value.value;

  if (isInteger(value)) {
    return integer(negated);
  }
  return real(negated);
}
