/**
 * SQL Parser - Converts a token stream into an Abstract Syntax Tree.
 *
 * Uses recursive descent parsing: each grammar rule becomes a function,
 * and functions call each other to build the tree from top (statements)
 * to bottom (literals).
 */

import { Token, TokenKind } from "./tokens.js";
import type {
  Statement,
  Expression,
  BinaryOperator,
  SelectStatement,
  SelectColumn,
  OrderByItem,
  InsertStatement,
  CreateTableStatement,
  ColumnDefinition,
  DataType,
  UpdateStatement,
  Assignment,
  DeleteStatement,
  DropTableStatement,
} from "./ast.js";

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
  // Statement Parsers
  // ===========================================================================

  /**
   * Parse SELECT statement.
   *
   * SELECT columns | * FROM table [WHERE expr] [ORDER BY ...] [LIMIT n]
   */
  private parseSelectStatement(): SelectStatement {
    this.expect(TokenKind.SELECT, "Expected SELECT");

    // Parse column list
    const columns = this.parseSelectColumns();

    // Parse FROM clause
    this.expect(TokenKind.FROM, "Expected FROM");
    const from = this.expect(TokenKind.IDENTIFIER, "Expected table name").lexeme;

    // Parse optional WHERE clause
    let where: Expression | undefined;
    if (this.match(TokenKind.WHERE)) {
      where = this.parseExpression();
    }

    // Parse optional ORDER BY clause
    let orderBy: OrderByItem[] | undefined;
    if (this.match(TokenKind.ORDER)) {
      this.expect(TokenKind.BY, "Expected BY after ORDER");
      orderBy = this.parseOrderByList();
    }

    // Parse optional LIMIT clause
    let limit: number | undefined;
    if (this.match(TokenKind.LIMIT)) {
      const limitToken = this.expect(TokenKind.INTEGER_LITERAL, "Expected number after LIMIT");
      limit = parseInt(limitToken.lexeme, 10);
    }

    this.consumeOptionalSemicolon();

    return {
      type: "SelectStatement",
      columns,
      from,
      where,
      orderBy,
      limit,
    };
  }

  /**
   * Parse SELECT column list: * | expression [[AS] alias], ...
   */
  private parseSelectColumns(): SelectColumn[] {
    const columns: SelectColumn[] = [];

    // Check for SELECT *
    if (this.match(TokenKind.STAR)) {
      columns.push({ type: "AllColumns" });
      return columns;
    }

    // Parse comma-separated expressions
    do {
      const expression = this.parseExpression();

      // Check for optional alias (AS keyword is optional)
      let alias: string | undefined;
      if (this.match(TokenKind.IDENTIFIER)) {
        // Could be AS keyword or direct alias
        const token = this.previous();
        if (token.lexeme.toUpperCase() === "AS") {
          alias = this.expect(TokenKind.IDENTIFIER, "Expected alias after AS").lexeme;
        } else {
          alias = token.lexeme;
        }
      }

      columns.push({ type: "Expression", expression, alias });
    } while (this.match(TokenKind.COMMA));

    return columns;
  }

  /**
   * Parse ORDER BY list: expression [ASC|DESC], ...
   */
  private parseOrderByList(): OrderByItem[] {
    const items: OrderByItem[] = [];

    do {
      const expression = this.parseExpression();

      let direction: "ASC" | "DESC" = "ASC"; // Default
      if (this.match(TokenKind.ASC)) {
        direction = "ASC";
      } else if (this.match(TokenKind.DESC)) {
        direction = "DESC";
      }

      items.push({ expression, direction });
    } while (this.match(TokenKind.COMMA));

    return items;
  }

  /**
   * Parse INSERT statement.
   *
   * INSERT INTO table (columns...) VALUES (values...)
   */
  private parseInsertStatement(): InsertStatement {
    this.expect(TokenKind.INSERT, "Expected INSERT");
    this.expect(TokenKind.INTO, "Expected INTO");

    const table = this.expect(TokenKind.IDENTIFIER, "Expected table name").lexeme;

    // Parse column list
    this.expect(TokenKind.LPAREN, "Expected '(' after table name");
    const columns = this.parseIdentifierList();
    this.expect(TokenKind.RPAREN, "Expected ')' after column list");

    // Parse VALUES
    this.expect(TokenKind.VALUES, "Expected VALUES");
    this.expect(TokenKind.LPAREN, "Expected '(' after VALUES");
    const values = this.parseExpressionList();
    this.expect(TokenKind.RPAREN, "Expected ')' after values");

    this.consumeOptionalSemicolon();

    return {
      type: "InsertStatement",
      table,
      columns,
      values,
    };
  }

  /**
   * Parse a comma-separated list of identifiers.
   */
  private parseIdentifierList(): string[] {
    const identifiers: string[] = [];

    do {
      identifiers.push(this.expect(TokenKind.IDENTIFIER, "Expected identifier").lexeme);
    } while (this.match(TokenKind.COMMA));

    return identifiers;
  }

  /**
   * Parse a comma-separated list of expressions.
   */
  private parseExpressionList(): Expression[] {
    const expressions: Expression[] = [];

    do {
      expressions.push(this.parseExpression());
    } while (this.match(TokenKind.COMMA));

    return expressions;
  }

  /**
   * Parse UPDATE statement.
   *
   * UPDATE table SET column = value, ... [WHERE expr]
   */
  private parseUpdateStatement(): UpdateStatement {
    this.expect(TokenKind.UPDATE, "Expected UPDATE");

    const table = this.expect(TokenKind.IDENTIFIER, "Expected table name").lexeme;

    this.expect(TokenKind.SET, "Expected SET");

    // Parse assignments
    const assignments = this.parseAssignmentList();

    // Parse optional WHERE clause
    let where: Expression | undefined;
    if (this.match(TokenKind.WHERE)) {
      where = this.parseExpression();
    }

    this.consumeOptionalSemicolon();

    return {
      type: "UpdateStatement",
      table,
      assignments,
      where,
    };
  }

  /**
   * Parse assignment list: column = value, ...
   */
  private parseAssignmentList(): Assignment[] {
    const assignments: Assignment[] = [];

    do {
      const column = this.expect(TokenKind.IDENTIFIER, "Expected column name").lexeme;
      this.expect(TokenKind.EQUALS, "Expected '=' in assignment");
      const value = this.parseExpression();

      assignments.push({ column, value });
    } while (this.match(TokenKind.COMMA));

    return assignments;
  }

  /**
   * Parse DELETE statement.
   *
   * DELETE FROM table [WHERE expr]
   */
  private parseDeleteStatement(): DeleteStatement {
    this.expect(TokenKind.DELETE, "Expected DELETE");
    this.expect(TokenKind.FROM, "Expected FROM");

    const table = this.expect(TokenKind.IDENTIFIER, "Expected table name").lexeme;

    // Parse optional WHERE clause
    let where: Expression | undefined;
    if (this.match(TokenKind.WHERE)) {
      where = this.parseExpression();
    }

    this.consumeOptionalSemicolon();

    return {
      type: "DeleteStatement",
      table,
      where,
    };
  }

  /**
   * Parse CREATE TABLE statement.
   *
   * CREATE TABLE name (column_def, ...)
   */
  private parseCreateTableStatement(): CreateTableStatement {
    this.expect(TokenKind.CREATE, "Expected CREATE");
    this.expect(TokenKind.TABLE, "Expected TABLE");

    const table = this.expect(TokenKind.IDENTIFIER, "Expected table name").lexeme;

    this.expect(TokenKind.LPAREN, "Expected '(' after table name");
    const columns = this.parseColumnDefinitions();
    this.expect(TokenKind.RPAREN, "Expected ')' after column definitions");

    this.consumeOptionalSemicolon();

    return {
      type: "CreateTableStatement",
      table,
      columns,
    };
  }

  /**
   * Parse column definitions: name TYPE [PRIMARY KEY], ...
   */
  private parseColumnDefinitions(): ColumnDefinition[] {
    const columns: ColumnDefinition[] = [];

    do {
      const name = this.expect(TokenKind.IDENTIFIER, "Expected column name").lexeme;
      const dataType = this.parseDataType();

      // Check for PRIMARY KEY
      let primaryKey = false;
      if (this.match(TokenKind.PRIMARY)) {
        this.expect(TokenKind.KEY, "Expected KEY after PRIMARY");
        primaryKey = true;
      }

      columns.push({ name, dataType, primaryKey: primaryKey || undefined });
    } while (this.match(TokenKind.COMMA));

    return columns;
  }

  /**
   * Parse a data type: INTEGER | TEXT | BOOLEAN | REAL
   */
  private parseDataType(): DataType {
    if (this.match(TokenKind.INTEGER)) return "INTEGER";
    if (this.match(TokenKind.TEXT)) return "TEXT";
    if (this.match(TokenKind.BOOLEAN)) return "BOOLEAN";
    if (this.match(TokenKind.REAL)) return "REAL";

    throw new ParserError(
      `Expected data type (INTEGER, TEXT, BOOLEAN, REAL), got '${this.peek().lexeme}'`,
      this.peek()
    );
  }

  /**
   * Parse DROP TABLE statement.
   *
   * DROP TABLE name
   */
  private parseDropTableStatement(): DropTableStatement {
    this.expect(TokenKind.DROP, "Expected DROP");
    this.expect(TokenKind.TABLE, "Expected TABLE");

    const table = this.expect(TokenKind.IDENTIFIER, "Expected table name").lexeme;

    this.consumeOptionalSemicolon();

    return {
      type: "DropTableStatement",
      table,
    };
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
  // Expression Parser (Pratt / Top-Down Operator Precedence)
  // ===========================================================================

  /**
   * Binding power (precedence) for operators.
   * Higher number = binds tighter = evaluated first.
   */
  private static readonly BINDING_POWER: Record<string, number> = {
    // Logical OR (lowest precedence)
    OR: 10,
    // Logical AND
    AND: 20,
    // Comparison operators
    "=": 30,
    "<>": 30,
    "<": 30,
    ">": 30,
    "<=": 30,
    ">=": 30,
    // Addition and subtraction
    "+": 40,
    "-": 40,
    // Multiplication and division (highest binary precedence)
    "*": 50,
    "/": 50,
  };

  /**
   * Prefix binding power for unary operators.
   */
  private static readonly PREFIX_BINDING_POWER: Record<string, number> = {
    NOT: 60,
    "-": 60,
  };

  /**
   * Parse an expression using Pratt parsing.
   *
   * @param minBindingPower - Minimum binding power to continue parsing
   */
  parseExpression(minBindingPower: number = 0): Expression {
    // Parse the left-hand side (primary expression or prefix operator)
    let left = this.parsePrefixExpression();

    // While the next token is an infix operator with sufficient binding power
    let operator = this.peekBinaryOperator();
    while (operator !== null) {
      const power = Parser.BINDING_POWER[operator];
      if (power === undefined || power <= minBindingPower) break;

      // Consume the operator token
      this.advance();

      // Parse the right-hand side with this operator's binding power
      const right = this.parseExpression(power);

      // Build the binary expression
      left = {
        type: "Binary",
        operator: operator as BinaryOperator,
        left,
        right,
      };

      // Check for next operator
      operator = this.peekBinaryOperator();
    }

    return left;
  }

  /**
   * Parse a prefix expression (unary operator or primary).
   */
  private parsePrefixExpression(): Expression {
    // Unary NOT
    if (this.match(TokenKind.NOT)) {
      const operand = this.parseExpression(Parser.PREFIX_BINDING_POWER["NOT"] ?? 60);
      return { type: "Unary", operator: "NOT", operand };
    }

    // Unary minus
    if (this.match(TokenKind.MINUS)) {
      const operand = this.parseExpression(Parser.PREFIX_BINDING_POWER["-"] ?? 60);
      return { type: "Unary", operator: "-", operand };
    }

    return this.parsePrimary();
  }

  /**
   * Parse a primary expression (literal, identifier, function call, or parenthesized).
   */
  private parsePrimary(): Expression {
    const token = this.peek();

    // Parenthesized expression
    if (this.match(TokenKind.LPAREN)) {
      const expr = this.parseExpression(0);
      this.expect(TokenKind.RPAREN, "Expected ')' after expression");
      return expr;
    }

    // Integer literal
    if (this.match(TokenKind.INTEGER_LITERAL)) {
      return {
        type: "Literal",
        value: parseInt(this.previous().lexeme, 10),
        dataType: "INTEGER",
      };
    }

    // Real literal
    if (this.match(TokenKind.REAL_LITERAL)) {
      return {
        type: "Literal",
        value: parseFloat(this.previous().lexeme),
        dataType: "REAL",
      };
    }

    // String literal
    if (this.match(TokenKind.STRING_LITERAL)) {
      const lexeme = this.previous().lexeme;
      // Remove surrounding quotes and unescape doubled quotes
      const value = lexeme.slice(1, -1).replace(/''/g, "'");
      return {
        type: "Literal",
        value,
        dataType: "TEXT",
      };
    }

    // Boolean TRUE
    if (this.match(TokenKind.TRUE)) {
      return { type: "Literal", value: true, dataType: "BOOLEAN" };
    }

    // Boolean FALSE
    if (this.match(TokenKind.FALSE)) {
      return { type: "Literal", value: false, dataType: "BOOLEAN" };
    }

    // NULL
    if (this.match(TokenKind.NULL)) {
      return { type: "Literal", value: null, dataType: "NULL" };
    }

    // Identifier (column reference or function call)
    if (this.match(TokenKind.IDENTIFIER)) {
      const name = this.previous().lexeme;

      // Check for function call: identifier followed by '('
      if (this.match(TokenKind.LPAREN)) {
        return this.parseFunctionCall(name);
      }

      // Simple column reference
      return { type: "ColumnRef", column: name };
    }

    throw new ParserError(`Expected expression, got '${token.lexeme}'`, token);
  }

  /**
   * Parse function arguments after the opening parenthesis.
   */
  private parseFunctionCall(name: string): Expression {
    const args: Expression[] = [];

    // Handle empty argument list
    if (!this.check(TokenKind.RPAREN)) {
      do {
        // Special case: COUNT(*) - we'll represent * as a special marker
        if (this.check(TokenKind.STAR)) {
          this.advance();
          // Represent * in aggregate as a special column ref
          args.push({ type: "ColumnRef", column: "*" });
        } else {
          args.push(this.parseExpression(0));
        }
      } while (this.match(TokenKind.COMMA));
    }

    this.expect(TokenKind.RPAREN, `Expected ')' after function arguments`);

    return {
      type: "FunctionCall",
      name: name.toUpperCase(),
      args,
    };
  }

  /**
   * Check if the current token is a binary operator and return its string form.
   */
  private peekBinaryOperator(): string | null {
    const token = this.peek();

    switch (token.kind) {
      // Comparison
      case TokenKind.EQUALS:
        return "=";
      case TokenKind.NOT_EQUALS:
        return "<>";
      case TokenKind.LESS_THAN:
        return "<";
      case TokenKind.GREATER_THAN:
        return ">";
      case TokenKind.LESS_THAN_OR_EQUAL:
        return "<=";
      case TokenKind.GREATER_THAN_OR_EQUAL:
        return ">=";
      // Arithmetic
      case TokenKind.PLUS:
        return "+";
      case TokenKind.MINUS:
        return "-";
      case TokenKind.STAR:
        return "*";
      case TokenKind.SLASH:
        return "/";
      // Logical
      case TokenKind.AND:
        return "AND";
      case TokenKind.OR:
        return "OR";
      default:
        return null;
    }
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
