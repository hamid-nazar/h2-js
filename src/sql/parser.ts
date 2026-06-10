/**
 * SQL Parser - Converts a token stream into an Abstract Syntax Tree.
 *
 * Uses recursive descent parsing: each grammar rule becomes a function,
 * and functions call each other to build the tree from top (statements)
 * to bottom (literals).
 */

import { Token, TokenKind } from "./tokens.js";
import type { Statement } from "./ast.js";

export class ParserError extends Error {
  constructor(
    message: string,
    public token: Token
  ) {
    super(`${message} at line ${String(token.line)}, column ${String(token.column)}`);
    this.name = "ParserError";
  }
}

export class Parser {
  private tokens: Token[];
  private current: number = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  /**
   * Parse the token stream and return a statement AST node.
   *
   * Throws ParserError if:
   * - The tokens don't form a valid statement
   * - There are trailing tokens after the statement
   */
  parse(): Statement {
    const statement = this.parseStatement();

    // Ensure we've consumed all tokens (except EOF)
    if (!this.isAtEnd()) {
      throw new ParserError(
        `Unexpected token '${this.peek().lexeme}' after statement`,
        this.peek()
      );
    }

    return statement;
  }

  /**
   * Parse a single statement by dispatching on the leading keyword.
   */
  private parseStatement(): Statement {
    // Skip optional semicolons at the start
    while (this.match(TokenKind.SEMICOLON)) {
      // consume
    }

    if (this.isAtEnd()) {
      throw new ParserError("Expected statement but found end of input", this.peek());
    }

    const token = this.peek();

    switch (token.kind) {
      case TokenKind.SELECT:
        return this.parseSelectStatement();

      case TokenKind.INSERT:
        return this.parseInsertStatement();

      case TokenKind.UPDATE:
        return this.parseUpdateStatement();

      case TokenKind.DELETE:
        return this.parseDeleteStatement();

      case TokenKind.CREATE:
        return this.parseCreateTableStatement();

      case TokenKind.DROP:
        return this.parseDropTableStatement();

      case TokenKind.BEGIN:
        return this.parseBeginStatement();

      case TokenKind.COMMIT:
        return this.parseCommitStatement();

      case TokenKind.ROLLBACK:
        return this.parseRollbackStatement();

      default:
        throw new ParserError(`Expected statement, got '${token.lexeme}'`, token);
    }
  }

  // ===========================================================================
  // Statement Parsers (stubs - to be implemented in TASK-017)
  // ===========================================================================

  private parseSelectStatement(): Statement {
    // TODO: Implement in TASK-017
    throw new ParserError("SELECT not yet implemented", this.peek());
  }

  private parseInsertStatement(): Statement {
    // TODO: Implement in TASK-017
    throw new ParserError("INSERT not yet implemented", this.peek());
  }

  private parseUpdateStatement(): Statement {
    // TODO: Implement in TASK-017
    throw new ParserError("UPDATE not yet implemented", this.peek());
  }

  private parseDeleteStatement(): Statement {
    // TODO: Implement in TASK-017
    throw new ParserError("DELETE not yet implemented", this.peek());
  }

  private parseCreateTableStatement(): Statement {
    // TODO: Implement in TASK-017
    throw new ParserError("CREATE TABLE not yet implemented", this.peek());
  }

  private parseDropTableStatement(): Statement {
    // TODO: Implement in TASK-017
    throw new ParserError("DROP TABLE not yet implemented", this.peek());
  }

  private parseBeginStatement(): Statement {
    this.advance(); // consume BEGIN
    this.consumeOptionalSemicolon();
    return { type: "BeginStatement" };
  }

  private parseCommitStatement(): Statement {
    this.advance(); // consume COMMIT
    this.consumeOptionalSemicolon();
    return { type: "CommitStatement" };
  }

  private parseRollbackStatement(): Statement {
    this.advance(); // consume ROLLBACK
    this.consumeOptionalSemicolon();
    return { type: "RollbackStatement" };
  }

  // ===========================================================================
  // Token Navigation Helpers
  // ===========================================================================

  /**
   * Check if we've reached the end of the token stream.
   */
  private isAtEnd(): boolean {
    return this.peek().kind === TokenKind.EOF;
  }

  /**
   * Return the current token without consuming it.
   */
  private peek(): Token {
    const token = this.tokens[this.current];
    if (token === undefined) {
      // Safety: return a synthetic EOF if we somehow go past the end
      return { kind: TokenKind.EOF, lexeme: "", line: 0, column: 0 };
    }
    return token;
  }

  /**
   * Return the previous token (the one we just consumed).
   */
  private previous(): Token {
    const token = this.tokens[this.current - 1];
    if (token === undefined) {
      throw new Error("No previous token");
    }
    return token;
  }

  /**
   * Consume and return the current token.
   */
  private advance(): Token {
    if (!this.isAtEnd()) {
      this.current++;
    }
    return this.previous();
  }

  /**
   * Check if the current token matches the given kind.
   */
  private check(kind: TokenKind): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().kind === kind;
  }

  /**
   * If the current token matches any of the given kinds, consume it and return true.
   */
  private match(...kinds: TokenKind[]): boolean {
    for (const kind of kinds) {
      if (this.check(kind)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  /**
   * Consume the current token if it matches the expected kind, otherwise throw.
   */
  protected expect(kind: TokenKind, message?: string): Token {
    if (this.check(kind)) {
      return this.advance();
    }

    const token = this.peek();
    const errorMessage = message ?? `Expected ${kind}, got '${token.lexeme}'`;
    throw new ParserError(errorMessage, token);
  }

  /**
   * Consume an optional trailing semicolon.
   */
  private consumeOptionalSemicolon(): void {
    this.match(TokenKind.SEMICOLON);
  }
}
