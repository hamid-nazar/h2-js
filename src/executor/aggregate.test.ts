import { describe, it, expect } from "vitest";
import {
  CountAggregate,
  SumAggregate,
  AvgAggregate,
  MinAggregate,
  MaxAggregate,
  createAggregate,
  isAggregateFunction,
} from "./aggregate.js";
import { integer, real, text, NULL, isNull } from "../types/value.js";

describe("Aggregate Functions", () => {
  describe("COUNT", () => {
    it("should count all values with COUNT(*)", () => {
      const count = new CountAggregate(true);
      count.init();
      count.accumulate(integer(1));
      count.accumulate(NULL);
      count.accumulate(integer(3));
      expect(count.finalize()).toEqual(integer(3));
    });

    it("should count non-NULL values with COUNT(expr)", () => {
      const count = new CountAggregate(false);
      count.init();
      count.accumulate(integer(1));
      count.accumulate(NULL);
      count.accumulate(integer(3));
      expect(count.finalize()).toEqual(integer(2));
    });

    it("should return 0 for empty input", () => {
      const count = new CountAggregate(true);
      count.init();
      expect(count.finalize()).toEqual(integer(0));
    });
  });

  describe("SUM", () => {
    it("should sum integers", () => {
      const sum = new SumAggregate();
      sum.init();
      sum.accumulate(integer(10));
      sum.accumulate(integer(20));
      sum.accumulate(integer(30));
      expect(sum.finalize()).toEqual(integer(60));
    });

    it("should sum reals", () => {
      const sum = new SumAggregate();
      sum.init();
      sum.accumulate(real(1.5));
      sum.accumulate(real(2.5));
      expect(sum.finalize()).toEqual(real(4.0));
    });

    it("should promote to REAL when mixing types", () => {
      const sum = new SumAggregate();
      sum.init();
      sum.accumulate(integer(10));
      sum.accumulate(real(5.5));
      const result = sum.finalize();
      expect(result.type).toBe("REAL");
      expect(result.value).toBe(15.5);
    });

    it("should ignore NULL values", () => {
      const sum = new SumAggregate();
      sum.init();
      sum.accumulate(integer(10));
      sum.accumulate(NULL);
      sum.accumulate(integer(20));
      expect(sum.finalize()).toEqual(integer(30));
    });

    it("should return NULL for all-NULL input", () => {
      const sum = new SumAggregate();
      sum.init();
      sum.accumulate(NULL);
      sum.accumulate(NULL);
      expect(isNull(sum.finalize())).toBe(true);
    });

    it("should return NULL for empty input", () => {
      const sum = new SumAggregate();
      sum.init();
      expect(isNull(sum.finalize())).toBe(true);
    });
  });

  describe("AVG", () => {
    it("should compute average of integers", () => {
      const avg = new AvgAggregate();
      avg.init();
      avg.accumulate(integer(10));
      avg.accumulate(integer(20));
      avg.accumulate(integer(30));
      expect(avg.finalize()).toEqual(real(20));
    });

    it("should always return REAL", () => {
      const avg = new AvgAggregate();
      avg.init();
      avg.accumulate(integer(10));
      avg.accumulate(integer(10));
      const result = avg.finalize();
      expect(result.type).toBe("REAL");
    });

    it("should ignore NULL values", () => {
      const avg = new AvgAggregate();
      avg.init();
      avg.accumulate(integer(10));
      avg.accumulate(NULL);
      avg.accumulate(integer(20));
      // Average of 10 and 20 = 15 (NULL ignored)
      expect(avg.finalize()).toEqual(real(15));
    });

    it("should return NULL for empty input", () => {
      const avg = new AvgAggregate();
      avg.init();
      expect(isNull(avg.finalize())).toBe(true);
    });
  });

  describe("MIN", () => {
    it("should find minimum integer", () => {
      const min = new MinAggregate();
      min.init();
      min.accumulate(integer(30));
      min.accumulate(integer(10));
      min.accumulate(integer(20));
      expect(min.finalize()).toEqual(integer(10));
    });

    it("should find minimum real", () => {
      const min = new MinAggregate();
      min.init();
      min.accumulate(real(3.5));
      min.accumulate(real(1.5));
      min.accumulate(real(2.5));
      expect(min.finalize()).toEqual(real(1.5));
    });

    it("should find minimum text (alphabetically)", () => {
      const min = new MinAggregate();
      min.init();
      min.accumulate(text("Charlie"));
      min.accumulate(text("Alice"));
      min.accumulate(text("Bob"));
      expect(min.finalize()).toEqual(text("Alice"));
    });

    it("should ignore NULL values", () => {
      const min = new MinAggregate();
      min.init();
      min.accumulate(integer(30));
      min.accumulate(NULL);
      min.accumulate(integer(10));
      expect(min.finalize()).toEqual(integer(10));
    });

    it("should return NULL for empty input", () => {
      const min = new MinAggregate();
      min.init();
      expect(isNull(min.finalize())).toBe(true);
    });
  });

  describe("MAX", () => {
    it("should find maximum integer", () => {
      const max = new MaxAggregate();
      max.init();
      max.accumulate(integer(10));
      max.accumulate(integer(30));
      max.accumulate(integer(20));
      expect(max.finalize()).toEqual(integer(30));
    });

    it("should find maximum text (alphabetically)", () => {
      const max = new MaxAggregate();
      max.init();
      max.accumulate(text("Alice"));
      max.accumulate(text("Charlie"));
      max.accumulate(text("Bob"));
      expect(max.finalize()).toEqual(text("Charlie"));
    });

    it("should ignore NULL values", () => {
      const max = new MaxAggregate();
      max.init();
      max.accumulate(integer(10));
      max.accumulate(NULL);
      max.accumulate(integer(30));
      expect(max.finalize()).toEqual(integer(30));
    });

    it("should return NULL for empty input", () => {
      const max = new MaxAggregate();
      max.init();
      expect(isNull(max.finalize())).toBe(true);
    });
  });

  describe("createAggregate", () => {
    it("should create COUNT aggregate", () => {
      const agg = createAggregate("COUNT", false);
      expect(agg).toBeInstanceOf(CountAggregate);
    });

    it("should create SUM aggregate", () => {
      const agg = createAggregate("SUM");
      expect(agg).toBeInstanceOf(SumAggregate);
    });

    it("should create AVG aggregate", () => {
      const agg = createAggregate("AVG");
      expect(agg).toBeInstanceOf(AvgAggregate);
    });

    it("should create MIN aggregate", () => {
      const agg = createAggregate("MIN");
      expect(agg).toBeInstanceOf(MinAggregate);
    });

    it("should create MAX aggregate", () => {
      const agg = createAggregate("MAX");
      expect(agg).toBeInstanceOf(MaxAggregate);
    });

    it("should be case-insensitive", () => {
      expect(createAggregate("count")).toBeInstanceOf(CountAggregate);
      expect(createAggregate("Sum")).toBeInstanceOf(SumAggregate);
    });

    it("should throw for unknown aggregate", () => {
      expect(() => createAggregate("UNKNOWN")).toThrow("Unknown aggregate");
    });
  });

  describe("isAggregateFunction", () => {
    it("should return true for aggregate functions", () => {
      expect(isAggregateFunction("COUNT")).toBe(true);
      expect(isAggregateFunction("SUM")).toBe(true);
      expect(isAggregateFunction("AVG")).toBe(true);
      expect(isAggregateFunction("MIN")).toBe(true);
      expect(isAggregateFunction("MAX")).toBe(true);
    });

    it("should be case-insensitive", () => {
      expect(isAggregateFunction("count")).toBe(true);
      expect(isAggregateFunction("Sum")).toBe(true);
    });

    it("should return false for non-aggregate functions", () => {
      expect(isAggregateFunction("UPPER")).toBe(false);
      expect(isAggregateFunction("CONCAT")).toBe(false);
    });
  });
});
