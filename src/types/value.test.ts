import { describe, it, expect } from "vitest";
import {
  integer,
  real,
  text,
  boolean,
  NULL,
  isNull,
  isNotNull,
  isInteger,
  isReal,
  isNumeric,
  isText,
  isBoolean,
  unwrap,
  toNumber,
  valueToString,
  type Value,
} from "./value.js";

describe("Value Types", () => {
  describe("constructors", () => {
    it("should create INTEGER values", () => {
      const val = integer(42);
      expect(val.type).toBe("INTEGER");
      expect(val.value).toBe(42);
    });

    it("should truncate INTEGER values", () => {
      const val = integer(3.7);
      expect(val.value).toBe(3);
    });

    it("should create REAL values", () => {
      const val = real(3.14);
      expect(val.type).toBe("REAL");
      expect(val.value).toBe(3.14);
    });

    it("should create TEXT values", () => {
      const val = text("hello");
      expect(val.type).toBe("TEXT");
      expect(val.value).toBe("hello");
    });

    it("should create BOOLEAN values", () => {
      const trueVal = boolean(true);
      const falseVal = boolean(false);

      expect(trueVal.type).toBe("BOOLEAN");
      expect(trueVal.value).toBe(true);
      expect(falseVal.value).toBe(false);
    });

    it("should have NULL singleton", () => {
      expect(NULL.type).toBe("NULL");
    });
  });

  describe("type checking", () => {
    it("isNull should identify NULL values", () => {
      expect(isNull(NULL)).toBe(true);
      expect(isNull(integer(42))).toBe(false);
      expect(isNull(text(""))).toBe(false);
    });

    it("isNotNull should identify non-NULL values", () => {
      expect(isNotNull(NULL)).toBe(false);
      expect(isNotNull(integer(42))).toBe(true);
      expect(isNotNull(text("hello"))).toBe(true);
    });

    it("isInteger should identify INTEGER values", () => {
      expect(isInteger(integer(42))).toBe(true);
      expect(isInteger(real(3.14))).toBe(false);
      expect(isInteger(NULL)).toBe(false);
    });

    it("isReal should identify REAL values", () => {
      expect(isReal(real(3.14))).toBe(true);
      expect(isReal(integer(42))).toBe(false);
      expect(isReal(NULL)).toBe(false);
    });

    it("isNumeric should identify numeric values", () => {
      expect(isNumeric(integer(42))).toBe(true);
      expect(isNumeric(real(3.14))).toBe(true);
      expect(isNumeric(text("42"))).toBe(false);
      expect(isNumeric(NULL)).toBe(false);
    });

    it("isText should identify TEXT values", () => {
      expect(isText(text("hello"))).toBe(true);
      expect(isText(integer(42))).toBe(false);
      expect(isText(NULL)).toBe(false);
    });

    it("isBoolean should identify BOOLEAN values", () => {
      expect(isBoolean(boolean(true))).toBe(true);
      expect(isBoolean(boolean(false))).toBe(true);
      expect(isBoolean(integer(1))).toBe(false);
      expect(isBoolean(NULL)).toBe(false);
    });
  });

  describe("unwrap", () => {
    it("should extract raw values", () => {
      expect(unwrap(integer(42))).toBe(42);
      expect(unwrap(real(3.14))).toBe(3.14);
      expect(unwrap(text("hello"))).toBe("hello");
      expect(unwrap(boolean(true))).toBe(true);
    });

    it("should return undefined for NULL", () => {
      expect(unwrap(NULL)).toBeUndefined();
    });
  });

  describe("toNumber", () => {
    it("should extract numeric values", () => {
      expect(toNumber(integer(42))).toBe(42);
      expect(toNumber(real(3.14))).toBe(3.14);
    });

    it("should return undefined for non-numeric values", () => {
      expect(toNumber(text("42"))).toBeUndefined();
      expect(toNumber(boolean(true))).toBeUndefined();
      expect(toNumber(NULL)).toBeUndefined();
    });
  });

  describe("valueToString", () => {
    it("should format INTEGER", () => {
      expect(valueToString(integer(42))).toBe("42");
    });

    it("should format REAL", () => {
      expect(valueToString(real(3.14))).toBe("3.14");
    });

    it("should format TEXT", () => {
      expect(valueToString(text("hello"))).toBe("hello");
    });

    it("should format BOOLEAN", () => {
      expect(valueToString(boolean(true))).toBe("TRUE");
      expect(valueToString(boolean(false))).toBe("FALSE");
    });

    it("should format NULL", () => {
      expect(valueToString(NULL)).toBe("NULL");
    });
  });

  describe("discriminated union", () => {
    it("should allow exhaustive type checking", () => {
      const values: Value[] = [
        integer(42),
        real(3.14),
        text("hello"),
        boolean(true),
        NULL,
      ];

      const types = values.map((v) => {
        switch (v.type) {
          case "INTEGER":
            return `int:${String(v.value)}`;
          case "REAL":
            return `real:${String(v.value)}`;
          case "TEXT":
            return `text:${v.value}`;
          case "BOOLEAN":
            return `bool:${String(v.value)}`;
          case "NULL":
            return "null";
        }
      });

      expect(types).toEqual(["int:42", "real:3.14", "text:hello", "bool:true", "null"]);
    });
  });
});
