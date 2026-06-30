import { describe, it, expect } from "vitest";
import {
  evaluate,
  evaluateToBoolean,
  RowContext,
  EvaluationError,
} from "./evaluator.js";
import { Expression } from "../sql/ast.js";
import { integer, real, text, boolean, NULL, isNull } from "../types/value.js";
import { TypeError } from "../types/comparison.js";
import { DivisionByZeroError } from "../types/arithmetic.js";

// =============================================================================
// Helper: Create expressions
// =============================================================================

function literal(
  value: string | number | boolean | null,
  dataType: "INTEGER" | "REAL" | "TEXT" | "BOOLEAN" | "NULL"
): Expression {
  return { type: "Literal", value, dataType };
}

function col(column: string, table?: string): Expression {
  return { type: "ColumnRef", column, table };
}

function binary(
  operator:
    | "="
    | "<>"
    | "<"
    | ">"
    | "<="
    | ">="
    | "+"
    | "-"
    | "*"
    | "/"
    | "AND"
    | "OR",
  left: Expression,
  right: Expression
): Expression {
  return { type: "Binary", operator, left, right };
}

function unary(operator: "NOT" | "-", operand: Expression): Expression {
  return { type: "Unary", operator, operand };
}

// =============================================================================
// Tests
// =============================================================================

describe("Expression Evaluator", () => {
  describe("Literal Evaluation", () => {
    const ctx = new RowContext();

    it("should evaluate INTEGER literals", () => {
      expect(evaluate(literal(42, "INTEGER"), ctx)).toEqual(integer(42));
    });

    it("should evaluate REAL literals", () => {
      expect(evaluate(literal(3.14, "REAL"), ctx)).toEqual(real(3.14));
    });

    it("should evaluate TEXT literals", () => {
      expect(evaluate(literal("hello", "TEXT"), ctx)).toEqual(text("hello"));
    });

    it("should evaluate BOOLEAN literals", () => {
      expect(evaluate(literal(true, "BOOLEAN"), ctx)).toEqual(boolean(true));
      expect(evaluate(literal(false, "BOOLEAN"), ctx)).toEqual(boolean(false));
    });

    it("should evaluate NULL literals", () => {
      expect(isNull(evaluate(literal(null, "NULL"), ctx))).toBe(true);
    });
  });

  describe("Column Reference Evaluation", () => {
    it("should look up column values", () => {
      const ctx = new RowContext({
        name: text("Alice"),
        age: integer(30),
        active: boolean(true),
      });

      expect(evaluate(col("name"), ctx)).toEqual(text("Alice"));
      expect(evaluate(col("age"), ctx)).toEqual(integer(30));
      expect(evaluate(col("active"), ctx)).toEqual(boolean(true));
    });

    it("should be case-insensitive", () => {
      const ctx = new RowContext({
        Name: text("Alice"),
      });

      expect(evaluate(col("name"), ctx)).toEqual(text("Alice"));
      expect(evaluate(col("NAME"), ctx)).toEqual(text("Alice"));
      expect(evaluate(col("NaMe"), ctx)).toEqual(text("Alice"));
    });

    it("should throw for unknown columns", () => {
      const ctx = new RowContext({ name: text("Alice") });
      expect(() => evaluate(col("unknown"), ctx)).toThrow(EvaluationError);
      expect(() => evaluate(col("unknown"), ctx)).toThrow("Unknown column");
    });
  });

  describe("Comparison Operations", () => {
    const ctx = new RowContext({
      x: integer(10),
      y: integer(5),
    });

    it("should evaluate equality (=)", () => {
      expect(evaluate(binary("=", col("x"), literal(10, "INTEGER")), ctx)).toEqual(
        boolean(true)
      );
      expect(evaluate(binary("=", col("x"), col("y")), ctx)).toEqual(
        boolean(false)
      );
    });

    it("should evaluate inequality (<>)", () => {
      expect(evaluate(binary("<>", col("x"), col("y")), ctx)).toEqual(
        boolean(true)
      );
    });

    it("should evaluate less than (<)", () => {
      expect(evaluate(binary("<", col("y"), col("x")), ctx)).toEqual(
        boolean(true)
      );
      expect(evaluate(binary("<", col("x"), col("y")), ctx)).toEqual(
        boolean(false)
      );
    });

    it("should evaluate greater than (>)", () => {
      expect(evaluate(binary(">", col("x"), col("y")), ctx)).toEqual(
        boolean(true)
      );
    });

    it("should evaluate less than or equal (<=)", () => {
      expect(
        evaluate(binary("<=", literal(5, "INTEGER"), col("y")), ctx)
      ).toEqual(boolean(true));
    });

    it("should evaluate greater than or equal (>=)", () => {
      expect(
        evaluate(binary(">=", col("x"), literal(10, "INTEGER")), ctx)
      ).toEqual(boolean(true));
    });
  });

  describe("Arithmetic Operations", () => {
    const ctx = new RowContext({
      a: integer(10),
      b: integer(3),
      price: real(19.99),
    });

    it("should evaluate addition (+)", () => {
      expect(evaluate(binary("+", col("a"), col("b")), ctx)).toEqual(
        integer(13)
      );
    });

    it("should evaluate subtraction (-)", () => {
      expect(evaluate(binary("-", col("a"), col("b")), ctx)).toEqual(integer(7));
    });

    it("should evaluate multiplication (*)", () => {
      expect(evaluate(binary("*", col("a"), col("b")), ctx)).toEqual(
        integer(30)
      );
    });

    it("should evaluate division (/)", () => {
      expect(evaluate(binary("/", col("a"), col("b")), ctx)).toEqual(integer(3));
    });

    it("should promote to REAL when mixing types", () => {
      const result = evaluate(
        binary("*", col("price"), literal(2, "INTEGER")),
        ctx
      );
      expect(result.type).toBe("REAL");
      expect((result as { value: number }).value).toBeCloseTo(39.98);
    });

    it("should throw on division by zero", () => {
      expect(() =>
        evaluate(binary("/", col("a"), literal(0, "INTEGER")), ctx)
      ).toThrow(DivisionByZeroError);
    });
  });

  describe("Logical Operations", () => {
    const ctx = new RowContext({
      active: boolean(true),
      admin: boolean(false),
    });

    it("should evaluate AND", () => {
      expect(evaluate(binary("AND", col("active"), col("admin")), ctx)).toEqual(
        boolean(false)
      );
      expect(
        evaluate(
          binary("AND", col("active"), literal(true, "BOOLEAN")),
          ctx
        )
      ).toEqual(boolean(true));
    });

    it("should evaluate OR", () => {
      expect(evaluate(binary("OR", col("active"), col("admin")), ctx)).toEqual(
        boolean(true)
      );
      expect(
        evaluate(
          binary("OR", col("admin"), literal(false, "BOOLEAN")),
          ctx
        )
      ).toEqual(boolean(false));
    });

    it("should evaluate NOT", () => {
      expect(evaluate(unary("NOT", col("active")), ctx)).toEqual(boolean(false));
      expect(evaluate(unary("NOT", col("admin")), ctx)).toEqual(boolean(true));
    });
  });

  describe("Unary Minus", () => {
    const ctx = new RowContext({
      x: integer(5),
      y: real(3.14),
    });

    it("should negate integers", () => {
      expect(evaluate(unary("-", col("x")), ctx)).toEqual(integer(-5));
    });

    it("should negate reals", () => {
      expect(evaluate(unary("-", col("y")), ctx)).toEqual(real(-3.14));
    });

    it("should work with literals", () => {
      expect(evaluate(unary("-", literal(42, "INTEGER")), ctx)).toEqual(
        integer(-42)
      );
    });
  });

  describe("NULL Propagation", () => {
    const ctx = new RowContext({
      x: integer(10),
      n: NULL,
    });

    it("should propagate NULL through arithmetic", () => {
      expect(isNull(evaluate(binary("+", col("x"), col("n")), ctx))).toBe(true);
      expect(isNull(evaluate(binary("*", col("n"), col("x")), ctx))).toBe(true);
    });

    it("should propagate NULL through comparisons", () => {
      expect(isNull(evaluate(binary("=", col("x"), col("n")), ctx))).toBe(true);
      expect(isNull(evaluate(binary(">", col("n"), col("x")), ctx))).toBe(true);
    });

    it("should handle NULL in logical operations (three-valued logic)", () => {
      // FALSE AND NULL = FALSE
      expect(
        evaluate(binary("AND", literal(false, "BOOLEAN"), col("n")), ctx)
      ).toEqual(boolean(false));

      // TRUE OR NULL = TRUE
      expect(
        evaluate(binary("OR", literal(true, "BOOLEAN"), col("n")), ctx)
      ).toEqual(boolean(true));

      // TRUE AND NULL = NULL
      expect(
        isNull(evaluate(binary("AND", literal(true, "BOOLEAN"), col("n")), ctx))
      ).toBe(true);

      // FALSE OR NULL = NULL
      expect(
        isNull(evaluate(binary("OR", literal(false, "BOOLEAN"), col("n")), ctx))
      ).toBe(true);
    });

    it("should propagate NULL through NOT", () => {
      expect(isNull(evaluate(unary("NOT", col("n")), ctx))).toBe(true);
    });

    it("should propagate NULL through unary minus", () => {
      expect(isNull(evaluate(unary("-", col("n")), ctx))).toBe(true);
    });
  });

  describe("Complex Expressions", () => {
    const ctx = new RowContext({
      price: real(100.0),
      quantity: integer(5),
      discount: real(0.1),
      active: boolean(true),
      minQty: integer(3),
    });

    it("should evaluate nested arithmetic: price * quantity * (1 - discount)", () => {
      // (price * quantity) * (1 - discount)
      // = (100 * 5) * (1 - 0.1)
      // = 500 * 0.9
      // = 450
      const expr = binary(
        "*",
        binary("*", col("price"), col("quantity")),
        binary("-", literal(1, "REAL"), col("discount"))
      );
      const result = evaluate(expr, ctx);
      expect(result.type).toBe("REAL");
      expect((result as { value: number }).value).toBeCloseTo(450);
    });

    it("should evaluate complex WHERE conditions", () => {
      // active = TRUE AND quantity > minQty
      const expr = binary(
        "AND",
        binary("=", col("active"), literal(true, "BOOLEAN")),
        binary(">", col("quantity"), col("minQty"))
      );
      expect(evaluate(expr, ctx)).toEqual(boolean(true));
    });

    it("should evaluate OR with AND precedence preserved in tree", () => {
      // active AND quantity > 10 OR price < 50
      // With tree: (active AND (quantity > 10)) OR (price < 50)
      // = (true AND false) OR false
      // = false OR false
      // = false
      const expr = binary(
        "OR",
        binary(
          "AND",
          col("active"),
          binary(">", col("quantity"), literal(10, "INTEGER"))
        ),
        binary("<", col("price"), literal(50, "REAL"))
      );
      expect(evaluate(expr, ctx)).toEqual(boolean(false));
    });
  });

  describe("Type Errors", () => {
    const ctx = new RowContext({
      name: text("Alice"),
      age: integer(30),
    });

    it("should throw on comparing incompatible types", () => {
      expect(() =>
        evaluate(binary("=", col("name"), col("age")), ctx)
      ).toThrow(TypeError);
    });

    it("should throw on arithmetic with non-numeric types", () => {
      expect(() =>
        evaluate(binary("+", col("name"), col("age")), ctx)
      ).toThrow();
    });

    it("should throw on logical operations with non-boolean types", () => {
      expect(() =>
        evaluate(binary("AND", col("age"), literal(true, "BOOLEAN")), ctx)
      ).toThrow(TypeError);
    });
  });

  describe("evaluateToBoolean", () => {
    const ctx = new RowContext({
      active: boolean(true),
      disabled: boolean(false),
      n: NULL,
      age: integer(30),
    });

    it("should return true for TRUE", () => {
      expect(evaluateToBoolean(col("active"), ctx)).toBe(true);
    });

    it("should return false for FALSE", () => {
      expect(evaluateToBoolean(col("disabled"), ctx)).toBe(false);
    });

    it("should return false for NULL", () => {
      expect(evaluateToBoolean(col("n"), ctx)).toBe(false);
    });

    it("should work with comparison expressions", () => {
      expect(
        evaluateToBoolean(binary(">", col("age"), literal(18, "INTEGER")), ctx)
      ).toBe(true);
      expect(
        evaluateToBoolean(binary("<", col("age"), literal(18, "INTEGER")), ctx)
      ).toBe(false);
    });

    it("should throw for non-boolean results", () => {
      expect(() => evaluateToBoolean(col("age"), ctx)).toThrow(EvaluationError);
      expect(() => evaluateToBoolean(col("age"), ctx)).toThrow(
        "requires BOOLEAN"
      );
    });
  });

  describe("RowContext", () => {
    it("should allow setting columns", () => {
      const ctx = new RowContext();
      ctx.setColumn("name", text("Alice"));
      ctx.setColumn("age", integer(30));

      expect(evaluate(col("name"), ctx)).toEqual(text("Alice"));
      expect(evaluate(col("age"), ctx)).toEqual(integer(30));
    });

    it("should allow initialization with record", () => {
      const ctx = new RowContext({
        name: text("Bob"),
        score: integer(100),
      });

      expect(evaluate(col("name"), ctx)).toEqual(text("Bob"));
      expect(evaluate(col("score"), ctx)).toEqual(integer(100));
    });
  });
});
