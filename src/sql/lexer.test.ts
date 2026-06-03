import { describe, it, expect } from "vitest";
import { Lexer, LexerError } from "./lexer.js";
import { TokenKind } from "./tokens.js";

describe("Lexer", () => {
  describe("keywords", () => {
    it("should tokenize SELECT statement keywords", () => {
      const lexer = new Lexer("SELECT FROM WHERE");
      const tokens = lexer.tokenize();

      expect(tokens).toHaveLength(4); // 3 keywords + EOF
      expect(tokens[0]?.kind).toBe(TokenKind.SELECT);
      expect(tokens[1]?.kind).toBe(TokenKind.FROM);
      expect(tokens[2]?.kind).toBe(TokenKind.WHERE);
      expect(tokens[3]?.kind).toBe(TokenKind.EOF);
    });

    it("should be case-insensitive for keywords", () => {
      const lexer = new Lexer("select FROM Where");
      const tokens = lexer.tokenize();

      expect(tokens[0]?.kind).toBe(TokenKind.SELECT);
      expect(tokens[1]?.kind).toBe(TokenKind.FROM);
      expect(tokens[2]?.kind).toBe(TokenKind.WHERE);
    });
  });

  describe("identifiers", () => {
    it("should tokenize identifiers", () => {
      const lexer = new Lexer("users name age");
      const tokens = lexer.tokenize();

      expect(tokens[0]?.kind).toBe(TokenKind.IDENTIFIER);
      expect(tokens[0]?.lexeme).toBe("users");
      expect(tokens[1]?.kind).toBe(TokenKind.IDENTIFIER);
      expect(tokens[1]?.lexeme).toBe("name");
    });

    it("should handle identifiers with underscores", () => {
      const lexer = new Lexer("user_name _private id_123");
      const tokens = lexer.tokenize();

      expect(tokens[0]?.lexeme).toBe("user_name");
      expect(tokens[1]?.lexeme).toBe("_private");
      expect(tokens[2]?.lexeme).toBe("id_123");
    });
  });

  describe("literals", () => {
    it("should tokenize integer literals", () => {
      const lexer = new Lexer("42 0 12345");
      const tokens = lexer.tokenize();

      expect(tokens[0]?.kind).toBe(TokenKind.INTEGER_LITERAL);
      expect(tokens[0]?.lexeme).toBe("42");
      expect(tokens[1]?.kind).toBe(TokenKind.INTEGER_LITERAL);
      expect(tokens[2]?.kind).toBe(TokenKind.INTEGER_LITERAL);
    });

    it("should tokenize real literals", () => {
      const lexer = new Lexer("3.14 0.5 123.456");
      const tokens = lexer.tokenize();

      expect(tokens[0]?.kind).toBe(TokenKind.REAL_LITERAL);
      expect(tokens[0]?.lexeme).toBe("3.14");
      expect(tokens[1]?.kind).toBe(TokenKind.REAL_LITERAL);
      expect(tokens[2]?.kind).toBe(TokenKind.REAL_LITERAL);
    });

    it("should tokenize string literals", () => {
      const lexer = new Lexer("'hello' 'world'");
      const tokens = lexer.tokenize();

      expect(tokens[0]?.kind).toBe(TokenKind.STRING_LITERAL);
      expect(tokens[0]?.lexeme).toBe("'hello'");
      expect(tokens[1]?.kind).toBe(TokenKind.STRING_LITERAL);
      expect(tokens[1]?.lexeme).toBe("'world'");
    });

    it("should handle empty strings", () => {
      const lexer = new Lexer("''");
      const tokens = lexer.tokenize();

      expect(tokens[0]?.kind).toBe(TokenKind.STRING_LITERAL);
      expect(tokens[0]?.lexeme).toBe("''");
    });

    it("should tokenize boolean literals", () => {
      const lexer = new Lexer("TRUE FALSE true false");
      const tokens = lexer.tokenize();

      expect(tokens[0]?.kind).toBe(TokenKind.TRUE);
      expect(tokens[1]?.kind).toBe(TokenKind.FALSE);
      expect(tokens[2]?.kind).toBe(TokenKind.TRUE);
      expect(tokens[3]?.kind).toBe(TokenKind.FALSE);
    });

    it("should tokenize NULL", () => {
      const lexer = new Lexer("NULL null");
      const tokens = lexer.tokenize();

      expect(tokens[0]?.kind).toBe(TokenKind.NULL);
      expect(tokens[1]?.kind).toBe(TokenKind.NULL);
    });
  });

  describe("operators", () => {
    it("should tokenize comparison operators", () => {
      const lexer = new Lexer("= < > <= >= <> !=");
      const tokens = lexer.tokenize();

      expect(tokens[0]?.kind).toBe(TokenKind.EQUALS);
      expect(tokens[1]?.kind).toBe(TokenKind.LESS_THAN);
      expect(tokens[2]?.kind).toBe(TokenKind.GREATER_THAN);
      expect(tokens[3]?.kind).toBe(TokenKind.LESS_THAN_OR_EQUAL);
      expect(tokens[4]?.kind).toBe(TokenKind.GREATER_THAN_OR_EQUAL);
      expect(tokens[5]?.kind).toBe(TokenKind.NOT_EQUALS);
      expect(tokens[6]?.kind).toBe(TokenKind.NOT_EQUALS);
    });

    it("should tokenize arithmetic operators", () => {
      const lexer = new Lexer("+ - * /");
      const tokens = lexer.tokenize();

      expect(tokens[0]?.kind).toBe(TokenKind.PLUS);
      expect(tokens[1]?.kind).toBe(TokenKind.MINUS);
      expect(tokens[2]?.kind).toBe(TokenKind.STAR);
      expect(tokens[3]?.kind).toBe(TokenKind.SLASH);
    });
  });

  describe("punctuation", () => {
    it("should tokenize punctuation", () => {
      const lexer = new Lexer("( ) , ;");
      const tokens = lexer.tokenize();

      expect(tokens[0]?.kind).toBe(TokenKind.LPAREN);
      expect(tokens[1]?.kind).toBe(TokenKind.RPAREN);
      expect(tokens[2]?.kind).toBe(TokenKind.COMMA);
      expect(tokens[3]?.kind).toBe(TokenKind.SEMICOLON);
    });
  });

  describe("comments", () => {
    it("should skip single-line comments", () => {
      const lexer = new Lexer("SELECT -- this is a comment\nFROM");
      const tokens = lexer.tokenize();

      expect(tokens[0]?.kind).toBe(TokenKind.SELECT);
      expect(tokens[1]?.kind).toBe(TokenKind.FROM);
      expect(tokens[2]?.kind).toBe(TokenKind.EOF);
    });

    it("should skip block comments", () => {
      const lexer = new Lexer("SELECT /* comment */ FROM");
      const tokens = lexer.tokenize();

      expect(tokens[0]?.kind).toBe(TokenKind.SELECT);
      expect(tokens[1]?.kind).toBe(TokenKind.FROM);
      expect(tokens[2]?.kind).toBe(TokenKind.EOF);
    });

    it("should handle multi-line block comments", () => {
      const lexer = new Lexer("SELECT /* this\nis\nmulti-line */ FROM");
      const tokens = lexer.tokenize();

      expect(tokens[0]?.kind).toBe(TokenKind.SELECT);
      expect(tokens[1]?.kind).toBe(TokenKind.FROM);
    });
  });

  describe("position tracking", () => {
    it("should track line and column for tokens", () => {
      const lexer = new Lexer("SELECT name");
      const tokens = lexer.tokenize();

      expect(tokens[0]?.line).toBe(1);
      expect(tokens[0]?.column).toBe(1);
      expect(tokens[1]?.line).toBe(1);
      expect(tokens[1]?.column).toBe(8);
    });

    it("should track line numbers across newlines", () => {
      const lexer = new Lexer("SELECT\nFROM\nWHERE");
      const tokens = lexer.tokenize();

      expect(tokens[0]?.line).toBe(1);
      expect(tokens[1]?.line).toBe(2);
      expect(tokens[2]?.line).toBe(3);
    });

    it("should reset column after newline", () => {
      const lexer = new Lexer("SELECT\nFROM");
      const tokens = lexer.tokenize();

      expect(tokens[0]?.column).toBe(1);
      expect(tokens[1]?.column).toBe(1);
    });
  });

  describe("complete SQL statements", () => {
    it("should tokenize a SELECT statement", () => {
      const lexer = new Lexer("SELECT name, age FROM users WHERE age > 21");
      const tokens = lexer.tokenize();

      const kinds = tokens.map((t) => t.kind);
      expect(kinds).toEqual([
        TokenKind.SELECT,
        TokenKind.IDENTIFIER, // name
        TokenKind.COMMA,
        TokenKind.IDENTIFIER, // age
        TokenKind.FROM,
        TokenKind.IDENTIFIER, // users
        TokenKind.WHERE,
        TokenKind.IDENTIFIER, // age
        TokenKind.GREATER_THAN,
        TokenKind.INTEGER_LITERAL, // 21
        TokenKind.EOF,
      ]);
    });

    it("should tokenize a CREATE TABLE statement", () => {
      const lexer = new Lexer("CREATE TABLE users (id INTEGER, name TEXT)");
      const tokens = lexer.tokenize();

      const kinds = tokens.map((t) => t.kind);
      expect(kinds).toEqual([
        TokenKind.CREATE,
        TokenKind.TABLE,
        TokenKind.IDENTIFIER, // users
        TokenKind.LPAREN,
        TokenKind.IDENTIFIER, // id
        TokenKind.INTEGER, // INTEGER type
        TokenKind.COMMA,
        TokenKind.IDENTIFIER, // name
        TokenKind.TEXT, // TEXT type
        TokenKind.RPAREN,
        TokenKind.EOF,
      ]);
    });

    it("should tokenize an INSERT statement", () => {
      const lexer = new Lexer("INSERT INTO users (name, age) VALUES ('Alice', 30)");
      const tokens = lexer.tokenize();

      const kinds = tokens.map((t) => t.kind);
      expect(kinds).toEqual([
        TokenKind.INSERT,
        TokenKind.INTO,
        TokenKind.IDENTIFIER, // users
        TokenKind.LPAREN,
        TokenKind.IDENTIFIER, // name
        TokenKind.COMMA,
        TokenKind.IDENTIFIER, // age
        TokenKind.RPAREN,
        TokenKind.VALUES,
        TokenKind.LPAREN,
        TokenKind.STRING_LITERAL, // 'Alice'
        TokenKind.COMMA,
        TokenKind.INTEGER_LITERAL, // 30
        TokenKind.RPAREN,
        TokenKind.EOF,
      ]);
    });
  });

  describe("error handling", () => {
    it("should throw on unexpected character", () => {
      expect(() => new Lexer("SELECT @invalid").tokenize()).toThrow(LexerError);
      expect(() => new Lexer("SELECT @invalid").tokenize()).toThrow("Unexpected character '@'");
    });

    it("should throw on unterminated string", () => {
      expect(() => new Lexer("'unterminated").tokenize()).toThrow(LexerError);
      expect(() => new Lexer("'unterminated").tokenize()).toThrow("Unterminated string");
    });

    it("should throw on unterminated block comment", () => {
      expect(() => new Lexer("/* unterminated").tokenize()).toThrow(LexerError);
      expect(() => new Lexer("/* unterminated").tokenize()).toThrow("Unterminated block comment");
    });

    it("should include position in error message", () => {
      const lexer = new Lexer("SELECT @");

      try {
        lexer.tokenize();
      } catch (e) {
        expect(e).toBeInstanceOf(LexerError);
        const error = e as LexerError;
        expect(error.line).toBe(1);
        expect(error.column).toBe(8);
      }
    });
  });
});
