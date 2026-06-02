import { describe, it, expect } from "vitest";
import { TokenKind, KEYWORDS, createToken, type Token } from "./tokens.js";

describe("TokenKind", () => {
  it("should have all SQL keywords", () => {
    expect(TokenKind.SELECT).toBe("SELECT");
    expect(TokenKind.FROM).toBe("FROM");
    expect(TokenKind.WHERE).toBe("WHERE");
    expect(TokenKind.INSERT).toBe("INSERT");
    expect(TokenKind.CREATE).toBe("CREATE");
    expect(TokenKind.TABLE).toBe("TABLE");
  });

  it("should have literal types", () => {
    expect(TokenKind.INTEGER_LITERAL).toBe("INTEGER_LITERAL");
    expect(TokenKind.STRING_LITERAL).toBe("STRING_LITERAL");
    expect(TokenKind.REAL_LITERAL).toBe("REAL_LITERAL");
  });

  it("should have operators", () => {
    expect(TokenKind.EQUALS).toBe("EQUALS");
    expect(TokenKind.LESS_THAN).toBe("LESS_THAN");
    expect(TokenKind.GREATER_THAN).toBe("GREATER_THAN");
    expect(TokenKind.PLUS).toBe("PLUS");
    expect(TokenKind.STAR).toBe("STAR");
  });

  it("should have punctuation", () => {
    expect(TokenKind.LPAREN).toBe("LPAREN");
    expect(TokenKind.RPAREN).toBe("RPAREN");
    expect(TokenKind.COMMA).toBe("COMMA");
    expect(TokenKind.SEMICOLON).toBe("SEMICOLON");
  });

  it("should have EOF", () => {
    expect(TokenKind.EOF).toBe("EOF");
  });
});

describe("KEYWORDS", () => {
  it("should map keyword strings to token kinds", () => {
    expect(KEYWORDS.get("SELECT")).toBe(TokenKind.SELECT);
    expect(KEYWORDS.get("FROM")).toBe(TokenKind.FROM);
    expect(KEYWORDS.get("WHERE")).toBe(TokenKind.WHERE);
  });

  it("should distinguish keywords from identifiers", () => {
    // Keywords are in the map
    expect(KEYWORDS.has("SELECT")).toBe(true);
    expect(KEYWORDS.has("CREATE")).toBe(true);

    // Random identifiers are not
    expect(KEYWORDS.has("users")).toBe(false);
    expect(KEYWORDS.has("myTable")).toBe(false);
  });

  it("should be case-sensitive (keywords are uppercase)", () => {
    expect(KEYWORDS.has("SELECT")).toBe(true);
    expect(KEYWORDS.has("select")).toBe(false);
    expect(KEYWORDS.has("Select")).toBe(false);
  });
});

describe("createToken", () => {
  it("should create a token with all fields", () => {
    const token: Token = createToken(TokenKind.SELECT, "SELECT", 1, 5);

    expect(token.kind).toBe(TokenKind.SELECT);
    expect(token.lexeme).toBe("SELECT");
    expect(token.line).toBe(1);
    expect(token.column).toBe(5);
  });

  it("should create identifier tokens", () => {
    const token = createToken(TokenKind.IDENTIFIER, "users", 3, 10);

    expect(token.kind).toBe(TokenKind.IDENTIFIER);
    expect(token.lexeme).toBe("users");
    expect(token.line).toBe(3);
    expect(token.column).toBe(10);
  });

  it("should create literal tokens", () => {
    const intToken = createToken(TokenKind.INTEGER_LITERAL, "42", 1, 1);
    const strToken = createToken(TokenKind.STRING_LITERAL, "'hello'", 1, 5);

    expect(intToken.kind).toBe(TokenKind.INTEGER_LITERAL);
    expect(intToken.lexeme).toBe("42");

    expect(strToken.kind).toBe(TokenKind.STRING_LITERAL);
    expect(strToken.lexeme).toBe("'hello'");
  });
});
