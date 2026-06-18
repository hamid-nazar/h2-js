import { describe, it, expect } from "vitest";
import {
  add,
  subtract,
  multiply,
  divide,
  negate,
  ArithmeticError,
  DivisionByZeroError,
} from "./arithmetic.js";
import { integer, real, text, boolean, NULL, isNull } from "./value.js";

describe("Arithmetic Operations", () => {
  describe("add", () => {
    it("should add integers", () => {
      expect(add(integer(5), integer(3))).toEqual(integer(8));
      expect(add(integer(-5), integer(3))).toEqual(integer(-2));
    });

    it("should add reals", () => {
      expect(add(real(3.5), real(2.5))).toEqual(real(6.0));
    });

    it("should promote to REAL when mixing types", () => {
      const result = add(integer(5), real(2.5));
      expect(result.type).toBe("REAL");
      expect(result.value).toBe(7.5);
    });

    it("should return NULL when either operand is NULL", () => {
      expect(isNull(add(integer(5), NULL))).toBe(true);
      expect(isNull(add(NULL, integer(5)))).toBe(true);
      expect(isNull(add(NULL, NULL))).toBe(true);
    });

    it("should throw on non-numeric operands", () => {
      expect(() => add(text("5"), integer(3))).toThrow(ArithmeticError);
      expect(() => add(integer(5), boolean(true))).toThrow(ArithmeticError);
    });
  });

  describe("subtract", () => {
    it("should subtract integers", () => {
      expect(subtract(integer(10), integer(3))).toEqual(integer(7));
      expect(subtract(integer(3), integer(10))).toEqual(integer(-7));
    });

    it("should subtract reals", () => {
      expect(subtract(real(5.5), real(2.5))).toEqual(real(3.0));
    });

    it("should promote to REAL when mixing types", () => {
      const result = subtract(integer(10), real(2.5));
      expect(result.type).toBe("REAL");
      expect(result.value).toBe(7.5);
    });

    it("should return NULL when either operand is NULL", () => {
      expect(isNull(subtract(integer(5), NULL))).toBe(true);
      expect(isNull(subtract(NULL, integer(5)))).toBe(true);
    });

    it("should throw on non-numeric operands", () => {
      expect(() => subtract(text("5"), integer(3))).toThrow(ArithmeticError);
    });
  });

  describe("multiply", () => {
    it("should multiply integers", () => {
      expect(multiply(integer(5), integer(3))).toEqual(integer(15));
      expect(multiply(integer(-5), integer(3))).toEqual(integer(-15));
    });

    it("should multiply reals", () => {
      expect(multiply(real(2.5), real(4.0))).toEqual(real(10.0));
    });

    it("should promote to REAL when mixing types", () => {
      const result = multiply(integer(5), real(2.5));
      expect(result.type).toBe("REAL");
      expect(result.value).toBe(12.5);
    });

    it("should return NULL when either operand is NULL", () => {
      expect(isNull(multiply(integer(5), NULL))).toBe(true);
      expect(isNull(multiply(NULL, integer(5)))).toBe(true);
    });

    it("should throw on non-numeric operands", () => {
      expect(() => multiply(text("5"), integer(3))).toThrow(ArithmeticError);
    });
  });

  describe("divide", () => {
    it("should divide integers (integer division)", () => {
      expect(divide(integer(10), integer(3))).toEqual(integer(3)); // truncates
      expect(divide(integer(15), integer(3))).toEqual(integer(5));
    });

    it("should truncate toward zero for negative integer division", () => {
      expect(divide(integer(-10), integer(3))).toEqual(integer(-3));
      expect(divide(integer(10), integer(-3))).toEqual(integer(-3));
    });

    it("should divide reals", () => {
      expect(divide(real(10.0), real(4.0))).toEqual(real(2.5));
    });

    it("should promote to REAL when mixing types", () => {
      const result = divide(integer(10), real(4.0));
      expect(result.type).toBe("REAL");
      expect(result.value).toBe(2.5);
    });

    it("should return NULL when either operand is NULL", () => {
      expect(isNull(divide(integer(5), NULL))).toBe(true);
      expect(isNull(divide(NULL, integer(5)))).toBe(true);
    });

    it("should throw on division by zero", () => {
      expect(() => divide(integer(5), integer(0))).toThrow(DivisionByZeroError);
      expect(() => divide(real(5.0), real(0.0))).toThrow(DivisionByZeroError);
    });

    it("should not throw on division by zero when numerator is NULL", () => {
      // NULL / 0 = NULL (NULL propagates before zero check)
      expect(isNull(divide(NULL, integer(0)))).toBe(true);
    });

    it("should throw on non-numeric operands", () => {
      expect(() => divide(text("5"), integer(3))).toThrow(ArithmeticError);
    });
  });

  describe("negate", () => {
    it("should negate integers", () => {
      expect(negate(integer(5))).toEqual(integer(-5));
      expect(negate(integer(-5))).toEqual(integer(5));
      expect(negate(integer(0))).toEqual(integer(0));
    });

    it("should negate reals", () => {
      expect(negate(real(3.14))).toEqual(real(-3.14));
      expect(negate(real(-3.14))).toEqual(real(3.14));
    });

    it("should return NULL for NULL", () => {
      expect(isNull(negate(NULL))).toBe(true);
    });

    it("should throw on non-numeric operands", () => {
      expect(() => negate(text("5"))).toThrow(ArithmeticError);
      expect(() => negate(boolean(true))).toThrow(ArithmeticError);
    });
  });
});

describe("Type Promotion", () => {
  it("INTEGER + INTEGER = INTEGER", () => {
    expect(add(integer(5), integer(3)).type).toBe("INTEGER");
  });

  it("INTEGER + REAL = REAL", () => {
    expect(add(integer(5), real(3.0)).type).toBe("REAL");
  });

  it("REAL + INTEGER = REAL", () => {
    expect(add(real(5.0), integer(3)).type).toBe("REAL");
  });

  it("REAL + REAL = REAL", () => {
    expect(add(real(5.0), real(3.0)).type).toBe("REAL");
  });
});
