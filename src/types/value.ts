/**
 * Runtime Value Types for the Database Engine
 *
 * These types represent values at runtime, independent of TypeScript's
 * static type system. Each value carries a type tag so we can:
 * - Distinguish INTEGER from REAL (both are JS numbers)
 * - Handle NULL according to SQL three-valued logic
 * - Perform type-safe comparisons and operations
 */

// =============================================================================
// Value Type Definitions
// =============================================================================

/**
 * An INTEGER value (whole number).
 */
export interface IntegerValue {
  type: "INTEGER";
  value: number;
}

/**
 * A REAL value (floating-point number).
 */
export interface RealValue {
  type: "REAL";
  value: number;
}

/**
 * A TEXT value (string).
 */
export interface TextValue {
  type: "TEXT";
  value: string;
}

/**
 * A BOOLEAN value (true/false).
 */
export interface BooleanValue {
  type: "BOOLEAN";
  value: boolean;
}

/**
 * NULL - represents the absence of a value.
 *
 * NULL is special in SQL:
 * - NULL = NULL is NULL (unknown), not TRUE
 * - NULL propagates through most operations
 * - NULL requires special handling in comparisons
 */
export interface NullValue {
  type: "NULL";
}

/**
 * A database value - one of the supported types or NULL.
 *
 * This is a discriminated union; use the `type` field to determine
 * which variant you have and access the appropriate `value` field.
 */
export type Value = IntegerValue | RealValue | TextValue | BooleanValue | NullValue;

/**
 * Type names for runtime type checking.
 */
export type ValueType = "INTEGER" | "REAL" | "TEXT" | "BOOLEAN" | "NULL";

// =============================================================================
// Value Constructors
// =============================================================================

/**
 * Create an INTEGER value.
 */
export function integer(value: number): IntegerValue {
  return { type: "INTEGER", value: Math.trunc(value) };
}

/**
 * Create a REAL value.
 */
export function real(value: number): RealValue {
  return { type: "REAL", value };
}

/**
 * Create a TEXT value.
 */
export function text(value: string): TextValue {
  return { type: "TEXT", value };
}

/**
 * Create a BOOLEAN value.
 */
export function boolean(value: boolean): BooleanValue {
  return { type: "BOOLEAN", value };
}

/**
 * The NULL value singleton.
 */
export const NULL: NullValue = { type: "NULL" };

// =============================================================================
// Type Checking Utilities
// =============================================================================

/**
 * Check if a value is NULL.
 */
export function isNull(value: Value): value is NullValue {
  return value.type === "NULL";
}

/**
 * Check if a value is not NULL.
 */
export function isNotNull(value: Value): value is Exclude<Value, NullValue> {
  return value.type !== "NULL";
}

/**
 * Check if a value is an INTEGER.
 */
export function isInteger(value: Value): value is IntegerValue {
  return value.type === "INTEGER";
}

/**
 * Check if a value is a REAL.
 */
export function isReal(value: Value): value is RealValue {
  return value.type === "REAL";
}

/**
 * Check if a value is numeric (INTEGER or REAL).
 */
export function isNumeric(value: Value): value is IntegerValue | RealValue {
  return value.type === "INTEGER" || value.type === "REAL";
}

/**
 * Check if a value is TEXT.
 */
export function isText(value: Value): value is TextValue {
  return value.type === "TEXT";
}

/**
 * Check if a value is BOOLEAN.
 */
export function isBoolean(value: Value): value is BooleanValue {
  return value.type === "BOOLEAN";
}

// =============================================================================
// Value Extraction
// =============================================================================

/**
 * Get the raw JavaScript value from a Value.
 * Returns undefined for NULL.
 */
export function unwrap(value: Value): number | string | boolean | undefined {
  if (value.type === "NULL") {
    return undefined;
  }
  return value.value;
}

/**
 * Get the numeric value, or undefined if not numeric or NULL.
 */
export function toNumber(value: Value): number | undefined {
  if (value.type === "INTEGER" || value.type === "REAL") {
    return value.value;
  }
  return undefined;
}

// =============================================================================
// Display
// =============================================================================

/**
 * Convert a value to a display string.
 */
export function valueToString(value: Value): string {
  switch (value.type) {
    case "NULL":
      return "NULL";
    case "INTEGER":
      return String(value.value);
    case "REAL":
      return String(value.value);
    case "TEXT":
      return value.value;
    case "BOOLEAN":
      return value.value ? "TRUE" : "FALSE";
  }
}
