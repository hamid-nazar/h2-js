/**
 * Value Comparison and Coercion
 *
 * Implements SQL comparison semantics:
 * - Three-valued logic: comparisons with NULL return NULL
 * - Type coercion: INTEGER can be promoted to REAL for comparison
 * - Type checking: incompatible types raise errors
 */

import {
  Value,
  NullValue,
  BooleanValue,
  NULL,
  boolean,
  isNull,
  isNumeric,
  isText,
  isBoolean,
} from "./value.js";

// =============================================================================
// Comparison Result Type
// =============================================================================

/**
 * Result of a comparison: either a BOOLEAN or NULL.
 * NULL propagates through comparisons per SQL three-valued logic.
 */
export type ComparisonResult = BooleanValue | NullValue;

// =============================================================================
// Comparison Error
// =============================================================================

export class TypeError extends Error {
  constructor(
    message: string,
    public leftType: string,
    public rightType: string
  ) {
    super(message);
    this.name = "TypeError";
  }
}

// =============================================================================
// Equality Comparisons
// =============================================================================

/**
 * SQL equality (=).
 *
 * Returns NULL if either operand is NULL.
 * Returns TRUE/FALSE for compatible types.
 * Throws TypeError for incompatible types.
 */
export function equals(left: Value, right: Value): ComparisonResult {
  // NULL propagation
  if (isNull(left) || isNull(right)) {
    return NULL;
  }

  // Same type comparison
  if (left.type === right.type) {
    return boolean(left.value === right.value);
  }

  // Numeric coercion: INTEGER and REAL can be compared
  if (isNumeric(left) && isNumeric(right)) {
    return boolean(left.value === right.value);
  }

  // Incompatible types
  throw new TypeError(
    `Cannot compare ${left.type} with ${right.type}`,
    left.type,
    right.type
  );
}

/**
 * SQL inequality (<>).
 *
 * Returns NULL if either operand is NULL.
 */
export function notEquals(left: Value, right: Value): ComparisonResult {
  // NULL propagation
  if (isNull(left) || isNull(right)) {
    return NULL;
  }

  // Same type comparison
  if (left.type === right.type) {
    return boolean(left.value !== right.value);
  }

  // Numeric coercion
  if (isNumeric(left) && isNumeric(right)) {
    return boolean(left.value !== right.value);
  }

  // Incompatible types
  throw new TypeError(
    `Cannot compare ${left.type} with ${right.type}`,
    left.type,
    right.type
  );
}

// =============================================================================
// Ordering Comparisons
// =============================================================================

/**
 * SQL less than (<).
 *
 * Returns NULL if either operand is NULL.
 */
export function lessThan(left: Value, right: Value): ComparisonResult {
  // NULL propagation
  if (isNull(left) || isNull(right)) {
    return NULL;
  }

  // Numeric comparison (handles INTEGER vs REAL coercion)
  if (isNumeric(left) && isNumeric(right)) {
    return boolean(left.value < right.value);
  }

  // Text comparison (lexicographic)
  if (isText(left) && isText(right)) {
    return boolean(left.value < right.value);
  }

  // Boolean comparison (FALSE < TRUE)
  if (isBoolean(left) && isBoolean(right)) {
    return boolean(!left.value && right.value);
  }

  // Incompatible types
  throw new TypeError(
    `Cannot compare ${left.type} with ${right.type}`,
    left.type,
    right.type
  );
}

/**
 * SQL greater than (>).
 *
 * Returns NULL if either operand is NULL.
 */
export function greaterThan(left: Value, right: Value): ComparisonResult {
  // NULL propagation
  if (isNull(left) || isNull(right)) {
    return NULL;
  }

  // Numeric comparison
  if (isNumeric(left) && isNumeric(right)) {
    return boolean(left.value > right.value);
  }

  // Text comparison
  if (isText(left) && isText(right)) {
    return boolean(left.value > right.value);
  }

  // Boolean comparison (TRUE > FALSE)
  if (isBoolean(left) && isBoolean(right)) {
    return boolean(left.value && !right.value);
  }

  // Incompatible types
  throw new TypeError(
    `Cannot compare ${left.type} with ${right.type}`,
    left.type,
    right.type
  );
}

/**
 * SQL less than or equal (<=).
 *
 * Returns NULL if either operand is NULL.
 */
export function lessThanOrEqual(left: Value, right: Value): ComparisonResult {
  // NULL propagation
  if (isNull(left) || isNull(right)) {
    return NULL;
  }

  // Numeric comparison
  if (isNumeric(left) && isNumeric(right)) {
    return boolean(left.value <= right.value);
  }

  // Text comparison
  if (isText(left) && isText(right)) {
    return boolean(left.value <= right.value);
  }

  // Boolean comparison
  if (isBoolean(left) && isBoolean(right)) {
    return boolean(!left.value || right.value);
  }

  // Incompatible types
  throw new TypeError(
    `Cannot compare ${left.type} with ${right.type}`,
    left.type,
    right.type
  );
}

/**
 * SQL greater than or equal (>=).
 *
 * Returns NULL if either operand is NULL.
 */
export function greaterThanOrEqual(left: Value, right: Value): ComparisonResult {
  // NULL propagation
  if (isNull(left) || isNull(right)) {
    return NULL;
  }

  // Numeric comparison
  if (isNumeric(left) && isNumeric(right)) {
    return boolean(left.value >= right.value);
  }

  // Text comparison
  if (isText(left) && isText(right)) {
    return boolean(left.value >= right.value);
  }

  // Boolean comparison
  if (isBoolean(left) && isBoolean(right)) {
    return boolean(left.value || !right.value);
  }

  // Incompatible types
  throw new TypeError(
    `Cannot compare ${left.type} with ${right.type}`,
    left.type,
    right.type
  );
}

// =============================================================================
// Logical Operations (for AND/OR with NULL)
// =============================================================================

/**
 * SQL AND with three-valued logic.
 *
 * Truth table:
 *   TRUE  AND TRUE  = TRUE
 *   TRUE  AND FALSE = FALSE
 *   FALSE AND TRUE  = FALSE
 *   FALSE AND FALSE = FALSE
 *   TRUE  AND NULL  = NULL
 *   NULL  AND TRUE  = NULL
 *   FALSE AND NULL  = FALSE  (special case!)
 *   NULL  AND FALSE = FALSE  (special case!)
 *   NULL  AND NULL  = NULL
 */
export function and(left: Value, right: Value): ComparisonResult {
  // Type check: both operands must be BOOLEAN or NULL
  const leftValid = isBoolean(left) || isNull(left);
  const rightValid = isBoolean(right) || isNull(right);

  if (!leftValid || !rightValid) {
    throw new TypeError(
      `AND requires BOOLEAN operands, got ${left.type} and ${right.type}`,
      left.type,
      right.type
    );
  }

  // If either is FALSE, result is FALSE (even with NULL)
  if (isBoolean(left) && !left.value) {
    return boolean(false);
  }
  if (isBoolean(right) && !right.value) {
    return boolean(false);
  }

  // NULL propagation (neither is FALSE at this point)
  if (isNull(left) || isNull(right)) {
    return NULL;
  }

  // Both must be BOOLEAN and TRUE at this point
  return boolean(left.value && right.value);
}

/**
 * SQL OR with three-valued logic.
 *
 * Truth table:
 *   TRUE  OR TRUE  = TRUE
 *   TRUE  OR FALSE = TRUE
 *   FALSE OR TRUE  = TRUE
 *   FALSE OR FALSE = FALSE
 *   TRUE  OR NULL  = TRUE   (special case!)
 *   NULL  OR TRUE  = TRUE   (special case!)
 *   FALSE OR NULL  = NULL
 *   NULL  OR FALSE = NULL
 *   NULL  OR NULL  = NULL
 */
export function or(left: Value, right: Value): ComparisonResult {
  // Type check: both operands must be BOOLEAN or NULL
  const leftValid = isBoolean(left) || isNull(left);
  const rightValid = isBoolean(right) || isNull(right);

  if (!leftValid || !rightValid) {
    throw new TypeError(
      `OR requires BOOLEAN operands, got ${left.type} and ${right.type}`,
      left.type,
      right.type
    );
  }

  // If either is TRUE, result is TRUE (even with NULL)
  if (isBoolean(left) && left.value) {
    return boolean(true);
  }
  if (isBoolean(right) && right.value) {
    return boolean(true);
  }

  // NULL propagation (neither is TRUE at this point)
  if (isNull(left) || isNull(right)) {
    return NULL;
  }

  // Both must be BOOLEAN and FALSE at this point
  return boolean(left.value || right.value);
}

/**
 * SQL NOT with three-valued logic.
 *
 * NOT TRUE  = FALSE
 * NOT FALSE = TRUE
 * NOT NULL  = NULL
 */
export function not(value: Value): ComparisonResult {
  if (isNull(value)) {
    return NULL;
  }

  if (isBoolean(value)) {
    return boolean(!value.value);
  }

  throw new TypeError(`NOT requires BOOLEAN operand, got ${value.type}`, value.type, "BOOLEAN");
}

// =============================================================================
// IS NULL / IS NOT NULL (special comparisons that don't propagate NULL)
// =============================================================================

/**
 * SQL IS NULL - returns TRUE if value is NULL, FALSE otherwise.
 * Unlike other comparisons, this never returns NULL.
 */
export function isNullCheck(value: Value): BooleanValue {
  return boolean(isNull(value));
}

/**
 * SQL IS NOT NULL - returns TRUE if value is not NULL, FALSE otherwise.
 * Unlike other comparisons, this never returns NULL.
 */
export function isNotNullCheck(value: Value): BooleanValue {
  return boolean(!isNull(value));
}
