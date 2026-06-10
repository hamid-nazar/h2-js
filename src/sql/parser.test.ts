import { describe, it, expect } from "vitest";
import { Parser, ParserError } from "./parser.js";
import { Lexer } from "./lexer.js";
import { TokenKind, createToken } from "./tokens.js";

/**
 * Helper to parse SQL string directly.
 */
function parse(sql: string) {
  const lexer = new Lexer(sql);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  return parser.parse();
}

describe("Parser", () => {
  describe("statement dispatch", () => {
    it("should dispatch BEGIN to transaction parser", () => {
      const stmt = parse("BEGIN");
      expect(stmt.type).toBe("BeginStatement");
    });

    it("should dispatch COMMIT to transaction parser", () => {
      const stmt = parse("COMMIT");
      expect(stmt.type).toBe("CommitStatement");
    });

    it("should dispatch ROLLBACK to transaction parser", () => {
      const stmt = parse("ROLLBACK");
      expect(stmt.type).toBe("RollbackStatement");
    });

    it("should throw on SELECT (not yet implemented)", () => {
      expect(() => parse("SELECT * FROM users")).toThrow(ParserError);
      expect(() => parse("SELECT * FROM users")).toThrow("SELECT not yet implemented");
    });

    it("should throw on INSERT (not yet implemented)", () => {
      expect(() => parse("INSERT INTO users VALUES (1)")).toThrow(ParserError);
      expect(() => parse("INSERT INTO users VALUES (1)")).toThrow("INSERT not yet implemented");
    });

    it("should throw on CREATE (not yet implemented)", () => {
      expect(() => parse("CREATE TABLE users (id INTEGER)")).toThrow(ParserError);
      expect(() => parse("CREATE TABLE users (id INTEGER)")).toThrow(
        "CREATE TABLE not yet implemented"
      );
    });

    it("should throw on unknown statement", () => {
      // Using a bare identifier as a statement
      const tokens = [
        createToken(TokenKind.IDENTIFIER, "foo", 1, 1),
        createToken(TokenKind.EOF, "", 1, 4),
      ];
      const parser = new Parser(tokens);

      expect(() => parser.parse()).toThrow(ParserError);
      expect(() => parser.parse()).toThrow("Expected statement");
    });
  });

  describe("trailing tokens", () => {
    it("should reject trailing tokens after complete statement", () => {
      // BEGIN followed by garbage
      const makeParser = () => {
        const tokens = [
          createToken(TokenKind.BEGIN, "BEGIN", 1, 1),
          createToken(TokenKind.IDENTIFIER, "garbage", 1, 7),
          createToken(TokenKind.EOF, "", 1, 14),
        ];
        return new Parser(tokens);
      };

      expect(() => makeParser().parse()).toThrow(ParserError);
      expect(() => makeParser().parse()).toThrow("Unexpected token 'garbage' after statement");
    });

    it("should allow trailing semicolon", () => {
      const stmt = parse("BEGIN;");
      expect(stmt.type).toBe("BeginStatement");
    });

    it("should reject multiple statements without explicit handling", () => {
      // Two statements: BEGIN; COMMIT
      // Our parser only handles one statement, so COMMIT becomes "trailing"
      expect(() => parse("BEGIN; COMMIT")).toThrow(ParserError);
      expect(() => parse("BEGIN; COMMIT")).toThrow("Unexpected token");
    });
  });

  describe("empty input", () => {
    it("should throw on empty input", () => {
      expect(() => parse("")).toThrow(ParserError);
      expect(() => parse("")).toThrow("Expected statement but found end of input");
    });

    it("should throw on only semicolons", () => {
      expect(() => parse(";;;")).toThrow(ParserError);
      expect(() => parse(";;;")).toThrow("Expected statement but found end of input");
    });

    it("should throw on only whitespace", () => {
      expect(() => parse("   \n\t  ")).toThrow(ParserError);
    });
  });

  describe("error messages", () => {
    it("should include line and column in error", () => {
      const tokens = [
        createToken(TokenKind.IDENTIFIER, "bad", 5, 10),
        createToken(TokenKind.EOF, "", 5, 13),
      ];
      const parser = new Parser(tokens);

      try {
        parser.parse();
        expect.fail("Should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(ParserError);
        const error = e as ParserError;
        expect(error.token.line).toBe(5);
        expect(error.token.column).toBe(10);
        expect(error.message).toContain("line 5");
        expect(error.message).toContain("column 10");
      }
    });
  });

  describe("transaction statements", () => {
    it("should parse BEGIN", () => {
      const stmt = parse("BEGIN");
      expect(stmt).toEqual({ type: "BeginStatement" });
    });

    it("should parse COMMIT", () => {
      const stmt = parse("COMMIT");
      expect(stmt).toEqual({ type: "CommitStatement" });
    });

    it("should parse ROLLBACK", () => {
      const stmt = parse("ROLLBACK");
      expect(stmt).toEqual({ type: "RollbackStatement" });
    });

    it("should be case-insensitive", () => {
      expect(parse("begin").type).toBe("BeginStatement");
      expect(parse("Commit").type).toBe("CommitStatement");
      expect(parse("ROLLBACK").type).toBe("RollbackStatement");
    });
  });
});
