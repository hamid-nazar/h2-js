/**
 * Aggregate Functions
 *
 * Aggregates consume multiple rows and produce a single summary value.
 * Unlike row-by-row operators, they must see all input before producing output.
 *
 * Supported aggregates:
 * - COUNT(*) - count all rows
 * - COUNT(expr) - count non-NULL values
 * - SUM(expr) - sum of numeric values
 * - AVG(expr) - average of numeric values
 * - MIN(expr) - minimum value
 * - MAX(expr) - maximum value
 */

import {
  Value,
  NULL,
  integer,
  real,
  isNull,
  isReal,
  isNumeric,
} from "../types/value.js";
import { lessThan, greaterThan } from "../types/comparison.js";

// =============================================================================
// Aggregate Interface
// =============================================================================

/**
 * Interface for aggregate functions.
 *
 * Lifecycle:
 * 1. init() - reset state for a new aggregation
 * 2. accumulate(value) - called once per input row
 * 3. finalize() - return the final result
 */
export interface Aggregate {
  /** Reset the aggregate state */
  init(): void;

  /** Process one value from the input */
  accumulate(value: Value): void;

  /** Return the final aggregated result */
  finalize(): Value;
}

// =============================================================================
// COUNT Aggregate
// =============================================================================

/**
 * COUNT(*) - counts all rows
 * COUNT(expr) - counts non-NULL values
 */
export class CountAggregate implements Aggregate {
  private count: number = 0;
  private countStar: boolean;

  /**
   * @param countStar - true for COUNT(*), false for COUNT(expr)
   */
  constructor(countStar: boolean = false) {
    this.countStar = countStar;
  }

  init(): void {
    this.count = 0;
  }

  accumulate(value: Value): void {
    // COUNT(*) counts all rows, COUNT(expr) skips NULLs
    if (this.countStar || !isNull(value)) {
      this.count++;
    }
  }

  finalize(): Value {
    return integer(this.count);
  }
}

// =============================================================================
// SUM Aggregate
// =============================================================================

/**
 * SUM(expr) - sum of numeric values
 *
 * Returns NULL if all values are NULL.
 * Returns INTEGER if all inputs are INTEGER, REAL otherwise.
 */
export class SumAggregate implements Aggregate {
  private sum: number = 0;
  private hasValue: boolean = false;
  private hasReal: boolean = false;

  init(): void {
    this.sum = 0;
    this.hasValue = false;
    this.hasReal = false;
  }

  accumulate(value: Value): void {
    if (isNull(value)) {
      return; // NULL values are ignored
    }

    if (!isNumeric(value)) {
      throw new Error(`SUM requires numeric values, got ${value.type}`);
    }

    this.sum += value.value;
    this.hasValue = true;

    if (isReal(value)) {
      this.hasReal = true;
    }
  }

  finalize(): Value {
    if (!this.hasValue) {
      return NULL; // All values were NULL
    }
    return this.hasReal ? real(this.sum) : integer(this.sum);
  }
}

// =============================================================================
// AVG Aggregate
// =============================================================================

/**
 * AVG(expr) - average of numeric values
 *
 * Returns NULL if all values are NULL.
 * Always returns REAL.
 */
export class AvgAggregate implements Aggregate {
  private sum: number = 0;
  private count: number = 0;

  init(): void {
    this.sum = 0;
    this.count = 0;
  }

  accumulate(value: Value): void {
    if (isNull(value)) {
      return; // NULL values are ignored
    }

    if (!isNumeric(value)) {
      throw new Error(`AVG requires numeric values, got ${value.type}`);
    }

    this.sum += value.value;
    this.count++;
  }

  finalize(): Value {
    if (this.count === 0) {
      return NULL; // All values were NULL
    }
    return real(this.sum / this.count);
  }
}

// =============================================================================
// MIN Aggregate
// =============================================================================

/**
 * MIN(expr) - minimum value
 *
 * Returns NULL if all values are NULL.
 * Works with any comparable type.
 */
export class MinAggregate implements Aggregate {
  private min: Value | null = null;

  init(): void {
    this.min = null;
  }

  accumulate(value: Value): void {
    if (isNull(value)) {
      return; // NULL values are ignored
    }

    if (this.min === null) {
      this.min = value;
      return;
    }

    // Check if value < min
    try {
      const result = lessThan(value, this.min);
      if (result.type === "BOOLEAN" && result.value) {
        this.min = value;
      }
    } catch {
      // Types not comparable, keep current min
    }
  }

  finalize(): Value {
    return this.min ?? NULL;
  }
}

// =============================================================================
// MAX Aggregate
// =============================================================================

/**
 * MAX(expr) - maximum value
 *
 * Returns NULL if all values are NULL.
 * Works with any comparable type.
 */
export class MaxAggregate implements Aggregate {
  private max: Value | null = null;

  init(): void {
    this.max = null;
  }

  accumulate(value: Value): void {
    if (isNull(value)) {
      return; // NULL values are ignored
    }

    if (this.max === null) {
      this.max = value;
      return;
    }

    // Check if value > max
    try {
      const result = greaterThan(value, this.max);
      if (result.type === "BOOLEAN" && result.value) {
        this.max = value;
      }
    } catch {
      // Types not comparable, keep current max
    }
  }

  finalize(): Value {
    return this.max ?? NULL;
  }
}

// =============================================================================
// Aggregate Factory
// =============================================================================

/**
 * Create an aggregate instance by name.
 *
 * @param name - Aggregate function name (case-insensitive)
 * @param isCountStar - For COUNT, whether it's COUNT(*)
 */
export function createAggregate(name: string, isCountStar: boolean = false): Aggregate {
  switch (name.toUpperCase()) {
    case "COUNT":
      return new CountAggregate(isCountStar);
    case "SUM":
      return new SumAggregate();
    case "AVG":
      return new AvgAggregate();
    case "MIN":
      return new MinAggregate();
    case "MAX":
      return new MaxAggregate();
    default:
      throw new Error(`Unknown aggregate function: ${name}`);
  }
}

/**
 * Check if a function name is an aggregate function.
 */
export function isAggregateFunction(name: string): boolean {
  const upperName = name.toUpperCase();
  return ["COUNT", "SUM", "AVG", "MIN", "MAX"].includes(upperName);
}
