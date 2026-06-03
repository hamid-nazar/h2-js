/**
 * SQL Lexer - Converts raw SQL text into a stream of tokens.
 *
 * The lexer scans character by character, recognizing:
 * - Keywords (SELECT, FROM, WHERE, etc.)
 * - Identifiers (table names, column names)
 * - Literals (numbers, strings, booleans, NULL)
 * - Operators (=, <, >, +, -, etc.)
 * - Punctuation ((, ), ,, ;)
 */

import { TokenKind, Token, KEYWORDS, createToken } from "./tokens.js";

export class LexerError extends Error {
  constructor(
    message: string,
    public line: number,
    public column: number
  ) {
    super(`${message} at line ${String(line)}, column ${String(column)}`);
    this.name = "LexerError";
  }
}

export class Lexer {
  private source: string;
  private tokens: Token[] = [];

  // Current position in source
  private start = 0; // Start of current token
  private current = 0; // Current character
  private line = 1; // Current line (1-indexed)
  private column = 1; // Current column (1-indexed)
  private startColumn = 1; // Column where current token started

  constructor(source: string) {
    this.source = source;
  }

  /**
   * Tokenize the entire input and return all tokens.
   */
  tokenize(): Token[] {
    while (!this.isAtEnd()) {
      // Mark the start of the next token
      this.start = this.current;
      this.startColumn = this.column;
      this.scanToken();
    }

    // Add EOF token
    this.tokens.push(createToken(TokenKind.EOF, "", this.line, this.column));
    return this.tokens;
  }

  /**
   * Scan a single token.
   */
  private scanToken(): void {
    const char = this.advance();

    switch (char) {
      // Single-character punctuation
      case "(":
        this.addToken(TokenKind.LPAREN);
        break;
      case ")":
        this.addToken(TokenKind.RPAREN);
        break;
      case ",":
        this.addToken(TokenKind.COMMA);
        break;
      case ";":
        this.addToken(TokenKind.SEMICOLON);
        break;

      // Arithmetic operators
      case "+":
        this.addToken(TokenKind.PLUS);
        break;
      case "-":
        // Check for single-line comment: --
        if (this.match("-")) {
          this.skipLineComment();
        } else {
          this.addToken(TokenKind.MINUS);
        }
        break;
      case "*":
        this.addToken(TokenKind.STAR);
        break;
      case "/":
        // Check for block comment: /* */
        if (this.match("*")) {
          this.skipBlockComment();
        } else {
          this.addToken(TokenKind.SLASH);
        }
        break;

      // Comparison operators
      case "=":
        this.addToken(TokenKind.EQUALS);
        break;
      case "<":
        if (this.match("=")) {
          this.addToken(TokenKind.LESS_THAN_OR_EQUAL);
        } else if (this.match(">")) {
          this.addToken(TokenKind.NOT_EQUALS);
        } else {
          this.addToken(TokenKind.LESS_THAN);
        }
        break;
      case ">":
        if (this.match("=")) {
          this.addToken(TokenKind.GREATER_THAN_OR_EQUAL);
        } else {
          this.addToken(TokenKind.GREATER_THAN);
        }
        break;
      case "!":
        if (this.match("=")) {
          this.addToken(TokenKind.NOT_EQUALS);
        } else {
          throw new LexerError(`Unexpected character '!'`, this.line, this.startColumn);
        }
        break;

      // Whitespace - skip it
      case " ":
      case "\t":
      case "\r":
        break;
      case "\n":
        this.line++;
        this.column = 1;
        break;

      // String literals
      case "'":
        this.string();
        break;

      default:
        if (this.isDigit(char)) {
          this.number();
        } else if (this.isAlpha(char)) {
          this.identifier();
        } else {
          throw new LexerError(`Unexpected character '${char}'`, this.line, this.startColumn);
        }
    }
  }

  /**
   * Scan a string literal (single-quoted).
   */
  private string(): void {
    while (!this.isAtEnd() && this.peek() !== "'") {
      if (this.peek() === "\n") {
        this.line++;
        this.column = 0; // Will be incremented by advance()
      }
      this.advance();
    }

    if (this.isAtEnd()) {
      throw new LexerError("Unterminated string", this.line, this.startColumn);
    }

    // Consume the closing quote
    this.advance();

    // Token includes the quotes
    this.addToken(TokenKind.STRING_LITERAL);
  }

  /**
   * Scan a number literal (integer or real).
   */
  private number(): void {
    // Consume integer part
    while (this.isDigit(this.peek())) {
      this.advance();
    }

    // Check for decimal part
    if (this.peek() === "." && this.isDigit(this.peekNext())) {
      // Consume the dot
      this.advance();

      // Consume decimal digits
      while (this.isDigit(this.peek())) {
        this.advance();
      }

      this.addToken(TokenKind.REAL_LITERAL);
    } else {
      this.addToken(TokenKind.INTEGER_LITERAL);
    }
  }

  /**
   * Scan an identifier or keyword.
   */
  private identifier(): void {
    while (this.isAlphaNumeric(this.peek())) {
      this.advance();
    }

    const text = this.source.slice(this.start, this.current);
    const upperText = text.toUpperCase();

    // Check if it's a reserved keyword
    const keywordKind = KEYWORDS.get(upperText);
    if (keywordKind !== undefined) {
      this.addToken(keywordKind);
    } else {
      this.addToken(TokenKind.IDENTIFIER);
    }
  }

  /**
   * Skip a single-line comment (-- to end of line).
   */
  private skipLineComment(): void {
    while (!this.isAtEnd() && this.peek() !== "\n") {
      this.advance();
    }
  }

  /**
   * Skip a block comment (from slash-star to star-slash).
   */
  private skipBlockComment(): void {
    while (!this.isAtEnd()) {
      if (this.peek() === "*" && this.peekNext() === "/") {
        this.advance(); // Consume *
        this.advance(); // Consume /
        return;
      }
      if (this.peek() === "\n") {
        this.line++;
        this.column = 0;
      }
      this.advance();
    }

    throw new LexerError("Unterminated block comment", this.line, this.startColumn);
  }

  // === Helper Methods ===

  /**
   * Check if we've reached the end of input.
   */
  private isAtEnd(): boolean {
    return this.current >= this.source.length;
  }

  /**
   * Consume and return the current character.
   */
  private advance(): string {
    const char = this.source[this.current];
    this.current++;
    this.column++;
    return char ?? "";
  }

  /**
   * Look at the current character without consuming it.
   */
  private peek(): string {
    if (this.isAtEnd()) return "\0";
    return this.source[this.current] ?? "\0";
  }

  /**
   * Look at the next character without consuming it.
   */
  private peekNext(): string {
    if (this.current + 1 >= this.source.length) return "\0";
    return this.source[this.current + 1] ?? "\0";
  }

  /**
   * Consume the current character if it matches expected.
   */
  private match(expected: string): boolean {
    if (this.isAtEnd()) return false;
    if (this.source[this.current] !== expected) return false;

    this.current++;
    this.column++;
    return true;
  }

  /**
   * Add a token with the current lexeme.
   */
  private addToken(kind: TokenKind): void {
    const lexeme = this.source.slice(this.start, this.current);
    this.tokens.push(createToken(kind, lexeme, this.line, this.startColumn));
  }

  /**
   * Check if a character is a digit (0-9).
   */
  private isDigit(char: string): boolean {
    return char >= "0" && char <= "9";
  }

  /**
   * Check if a character is alphabetic or underscore.
   */
  private isAlpha(char: string): boolean {
    return (char >= "a" && char <= "z") || (char >= "A" && char <= "Z") || char === "_";
  }

  /**
   * Check if a character is alphanumeric or underscore.
   */
  private isAlphaNumeric(char: string): boolean {
    return this.isAlpha(char) || this.isDigit(char);
  }
}
