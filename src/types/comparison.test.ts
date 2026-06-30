import { describe, it, expect } from "vitest";
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
  isNullCheck,
  isNotNullCheck,
  TypeError,
} from "./comparison.js";
import { integer, real, text, boolean, NULL, isNull } from "./value.js";

describe("Comparison", () => {
  describe("equals", () => {
    it("should compare integers", () => {
      expect(equals(integer(5), integer(5))).toEqual(boolean(true));
      expect(equals(integer(5), integer(3))).toEqual(boolean(false));
    });

    it("should compare reals", () => {
      expect(equals(real(3.14), real(3.14))).toEqual(boolean(true));
      expect(equals(real(3.14), real(2.71))).toEqual(boolean(false));
    });

    it("should compare text", () => {
      expect(equals(text("hello"), text("hello"))).toEqual(boolean(true));
      expect(equals(text("hello"), text("world"))).toEqual(boolean(false));
    });

    it("should compare booleans", () => {
      expect(equals(boolean(true), boolean(true))).toEqual(boolean(true));
      expect(equals(boolean(true), boolean(false))).toEqual(boolean(false));
    });

    it("should coerce INTEGER and REAL", () => {
      expect(equals(integer(5), real(5.0))).toEqual(boolean(true));
      expect(equals(real(5.0), integer(5))).toEqual(boolean(true));
      expect(equals(integer(5), real(5.1))).toEqual(boolean(false));
    });

    it("should return NULL when comparing with NULL", () => {
      expect(isNull(equals(integer(5), NULL))).toBe(true);
      expect(isNull(equals(NULL, integer(5)))).toBe(true);
      expect(isNull(equals(NULL, NULL))).toBe(true);
    });

    it("should throw on incompatible types", () => {
      expect(() => equals(integer(5), text("5"))).toThrow(TypeError);
      expect(() => equals(text("true"), boolean(true))).toThrow(TypeError);
    });
  });

  describe("notEquals", () => {
    it("should compare values", () => {
      expect(notEquals(integer(5), integer(3))).toEqual(boolean(true));
      expect(notEquals(integer(5), integer(5))).toEqual(boolean(false));
    });

    it("should return NULL when comparing with NULL", () => {
      expect(isNull(notEquals(integer(5), NULL))).toBe(true);
      expect(isNull(notEquals(NULL, NULL))).toBe(true);
    });
  });

  describe("lessThan", () => {
    it("should compare integers", () => {
      expect(lessThan(integer(3), integer(5))).toEqual(boolean(true));
      expect(lessThan(integer(5), integer(3))).toEqual(boolean(false));
      expect(lessThan(integer(5), integer(5))).toEqual(boolean(false));
    });

    it("should compare reals", () => {
      expect(lessThan(real(2.5), real(3.5))).toEqual(boolean(true));
      expect(lessThan(real(3.5), real(2.5))).toEqual(boolean(false));
    });

    it("should coerce INTEGER and REAL", () => {
      expect(lessThan(integer(3), real(3.5))).toEqual(boolean(true));
      expect(lessThan(real(2.5), integer(3))).toEqual(boolean(true));
    });

    it("should compare text lexicographically", () => {
      expect(lessThan(text("apple"), text("banana"))).toEqual(boolean(true));
      expect(lessThan(text("banana"), text("apple"))).toEqual(boolean(false));
    });

    it("should compare booleans (FALSE < TRUE)", () => {
      expect(lessThan(boolean(false), boolean(true))).toEqual(boolean(true));
      expect(lessThan(boolean(true), boolean(false))).toEqual(boolean(false));
      expect(lessThan(boolean(true), boolean(true))).toEqual(boolean(false));
    });

    it("should return NULL when comparing with NULL", () => {
      expect(isNull(lessThan(integer(5), NULL))).toBe(true);
      expect(isNull(lessThan(NULL, integer(5)))).toBe(true);
    });

    it("should throw on incompatible types", () => {
      expect(() => lessThan(integer(5), text("5"))).toThrow(TypeError);
    });
  });

  describe("greaterThan", () => {
    it("should compare integers", () => {
      expect(greaterThan(integer(5), integer(3))).toEqual(boolean(true));
      expect(greaterThan(integer(3), integer(5))).toEqual(boolean(false));
    });

    it("should return NULL when comparing with NULL", () => {
      expect(isNull(greaterThan(integer(5), NULL))).toBe(true);
    });
  });

  describe("lessThanOrEqual", () => {
    it("should compare integers", () => {
      expect(lessThanOrEqual(integer(3), integer(5))).toEqual(boolean(true));
      expect(lessThanOrEqual(integer(5), integer(5))).toEqual(boolean(true));
      expect(lessThanOrEqual(integer(5), integer(3))).toEqual(boolean(false));
    });

    it("should return NULL when comparing with NULL", () => {
      expect(isNull(lessThanOrEqual(integer(5), NULL))).toBe(true);
    });
  });

  describe("greaterThanOrEqual", () => {
    it("should compare integers", () => {
      expect(greaterThanOrEqual(integer(5), integer(3))).toEqual(boolean(true));
      expect(greaterThanOrEqual(integer(5), integer(5))).toEqual(boolean(true));
      expect(greaterThanOrEqual(integer(3), integer(5))).toEqual(boolean(false));
    });

    it("should return NULL when comparing with NULL", () => {
      expect(isNull(greaterThanOrEqual(integer(5), NULL))).toBe(true);
    });
  });
});

describe("Logical Operations (Three-Valued Logic)", () => {
  describe("and", () => {
    it("should follow standard AND logic for booleans", () => {
      expect(and(boolean(true), boolean(true))).toEqual(boolean(true));
      expect(and(boolean(true), boolean(false))).toEqual(boolean(false));
      expect(and(boolean(false), boolean(true))).toEqual(boolean(false));
      expect(and(boolean(false), boolean(false))).toEqual(boolean(false));
    });

    it("should handle NULL with TRUE (returns NULL)", () => {
      expect(isNull(and(boolean(true), NULL))).toBe(true);
      expect(isNull(and(NULL, boolean(true)))).toBe(true);
    });

    it("should handle NULL with FALSE (returns FALSE - special case!)", () => {
      expect(and(boolean(false), NULL)).toEqual(boolean(false));
      expect(and(NULL, boolean(false))).toEqual(boolean(false));
    });

    it("should handle NULL with NULL", () => {
      expect(isNull(and(NULL, NULL))).toBe(true);
    });

    it("should throw on non-boolean operands", () => {
      expect(() => and(integer(1), boolean(true))).toThrow(TypeError);
    });
  });

  describe("or", () => {
    it("should follow standard OR logic for booleans", () => {
      expect(or(boolean(true), boolean(true))).toEqual(boolean(true));
      expect(or(boolean(true), boolean(false))).toEqual(boolean(true));
      expect(or(boolean(false), boolean(true))).toEqual(boolean(true));
      expect(or(boolean(false), boolean(false))).toEqual(boolean(false));
    });

    it("should handle NULL with TRUE (returns TRUE - special case!)", () => {
      expect(or(boolean(true), NULL)).toEqual(boolean(true));
      expect(or(NULL, boolean(true))).toEqual(boolean(true));
    });

    it("should handle NULL with FALSE (returns NULL)", () => {
      expect(isNull(or(boolean(false), NULL))).toBe(true);
      expect(isNull(or(NULL, boolean(false)))).toBe(true);
    });

    it("should handle NULL with NULL", () => {
      expect(isNull(or(NULL, NULL))).toBe(true);
    });

    it("should throw on non-boolean operands", () => {
      expect(() => or(integer(1), boolean(true))).toThrow(TypeError);
    });
  });

  describe("not", () => {
    it("should negate boolean values", () => {
      expect(not(boolean(true))).toEqual(boolean(false));
      expect(not(boolean(false))).toEqual(boolean(true));
    });

    it("should return NULL for NULL", () => {
      expect(isNull(not(NULL))).toBe(true);
    });

    it("should throw on non-boolean operands", () => {
      expect(() => not(integer(1))).toThrow(TypeError);
    });
  });
});

describe("IS NULL / IS NOT NULL", () => {
  it("isNullCheck should return TRUE for NULL", () => {
    expect(isNullCheck(NULL)).toEqual(boolean(true));
  });

  it("isNullCheck should return FALSE for non-NULL", () => {
    expect(isNullCheck(integer(5))).toEqual(boolean(false));
    expect(isNullCheck(text(""))).toEqual(boolean(false));
    expect(isNullCheck(boolean(false))).toEqual(boolean(false));
  });

  it("isNotNullCheck should return FALSE for NULL", () => {
    expect(isNotNullCheck(NULL)).toEqual(boolean(false));
  });

  it("isNotNullCheck should return TRUE for non-NULL", () => {
    expect(isNotNullCheck(integer(5))).toEqual(boolean(true));
    expect(isNotNullCheck(text(""))).toEqual(boolean(true));
  });
});

describe("Type Coercion", () => {
  it("should allow INTEGER vs REAL comparison", () => {
    expect(lessThan(integer(3), real(3.5))).toEqual(boolean(true));
    expect(greaterThan(integer(4), real(3.5))).toEqual(boolean(true));
    expect(equals(integer(3), real(3.0))).toEqual(boolean(true));
  });

  it("should reject TEXT vs INTEGER comparison", () => {
    expect(() => equals(text("3"), integer(3))).toThrow(TypeError);
    expect(() => lessThan(text("3"), integer(3))).toThrow(TypeError);
  });

  it("should reject TEXT vs BOOLEAN comparison", () => {
    expect(() => equals(text("true"), boolean(true))).toThrow(TypeError);
  });

  it("should reject BOOLEAN vs INTEGER comparison", () => {
    expect(() => equals(boolean(true), integer(1))).toThrow(TypeError);
  });
});
