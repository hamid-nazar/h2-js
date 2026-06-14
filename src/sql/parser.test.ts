import { describe, it, expect } from "vitest";
import { Parser, ParserError } from "./parser.js";
import { Lexer } from "./lexer.js";
import { TokenKind, createToken } from "./tokens.js";
import type {
  Expression,
  BinaryExpression,
  SelectStatement,
  InsertStatement,
  CreateTableStatement,
  UpdateStatement,
  DeleteStatement,
  DropTableStatement,
} from "./ast.js";

/**
 * Helper to parse SQL string directly.
 */
function parse(sql: string) {
  const lexer = new Lexer(sql);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  return parser.parse();
}

/**
 * Helper to parse an expression directly.
 */
function parseExpr(sql: string): Expression {
  const lexer = new Lexer(sql);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  return parser.parseExpression();
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

    it("should dispatch SELECT to select parser", () => {
      const stmt = parse("SELECT * FROM users");
      expect(stmt.type).toBe("SelectStatement");
    });

    it("should dispatch INSERT to insert parser", () => {
      const stmt = parse("INSERT INTO users (name) VALUES ('Alice')");
      expect(stmt.type).toBe("InsertStatement");
    });

    it("should dispatch CREATE to create table parser", () => {
      const stmt = parse("CREATE TABLE users (id INTEGER)");
      expect(stmt.type).toBe("CreateTableStatement");
    });

    it("should dispatch UPDATE to update parser", () => {
      const stmt = parse("UPDATE users SET name = 'Bob'");
      expect(stmt.type).toBe("UpdateStatement");
    });

    it("should dispatch DELETE to delete parser", () => {
      const stmt = parse("DELETE FROM users");
      expect(stmt.type).toBe("DeleteStatement");
    });

    it("should dispatch DROP to drop table parser", () => {
      const stmt = parse("DROP TABLE users");
      expect(stmt.type).toBe("DropTableStatement");
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

describe("Expression Parser", () => {
  describe("literals", () => {
    it("should parse integer literals", () => {
      const expr = parseExpr("42");
      expect(expr).toEqual({ type: "Literal", value: 42, dataType: "INTEGER" });
    });

    it("should parse real literals", () => {
      const expr = parseExpr("3.14");
      expect(expr).toEqual({ type: "Literal", value: 3.14, dataType: "REAL" });
    });

    it("should parse string literals", () => {
      const expr = parseExpr("'hello'");
      expect(expr).toEqual({ type: "Literal", value: "hello", dataType: "TEXT" });
    });

    it("should parse string with escaped quotes", () => {
      const expr = parseExpr("'it''s'");
      expect(expr).toEqual({ type: "Literal", value: "it's", dataType: "TEXT" });
    });

    it("should parse TRUE", () => {
      const expr = parseExpr("TRUE");
      expect(expr).toEqual({ type: "Literal", value: true, dataType: "BOOLEAN" });
    });

    it("should parse FALSE", () => {
      const expr = parseExpr("FALSE");
      expect(expr).toEqual({ type: "Literal", value: false, dataType: "BOOLEAN" });
    });

    it("should parse NULL", () => {
      const expr = parseExpr("NULL");
      expect(expr).toEqual({ type: "Literal", value: null, dataType: "NULL" });
    });
  });

  describe("column references", () => {
    it("should parse simple column reference", () => {
      const expr = parseExpr("name");
      expect(expr).toEqual({ type: "ColumnRef", column: "name" });
    });

    it("should parse column with underscore", () => {
      const expr = parseExpr("user_name");
      expect(expr).toEqual({ type: "ColumnRef", column: "user_name" });
    });
  });

  describe("binary operators", () => {
    it("should parse addition", () => {
      const expr = parseExpr("a + b") as BinaryExpression;
      expect(expr.type).toBe("Binary");
      expect(expr.operator).toBe("+");
      expect(expr.left).toEqual({ type: "ColumnRef", column: "a" });
      expect(expr.right).toEqual({ type: "ColumnRef", column: "b" });
    });

    it("should parse comparison", () => {
      const expr = parseExpr("age > 21") as BinaryExpression;
      expect(expr.operator).toBe(">");
      expect(expr.left).toEqual({ type: "ColumnRef", column: "age" });
      expect(expr.right).toEqual({ type: "Literal", value: 21, dataType: "INTEGER" });
    });

    it("should parse equality", () => {
      const expr = parseExpr("name = 'Alice'") as BinaryExpression;
      expect(expr.operator).toBe("=");
    });

    it("should parse not equals", () => {
      const expr = parseExpr("a <> b") as BinaryExpression;
      expect(expr.operator).toBe("<>");
    });

    it("should parse logical AND", () => {
      const expr = parseExpr("a AND b") as BinaryExpression;
      expect(expr.operator).toBe("AND");
    });

    it("should parse logical OR", () => {
      const expr = parseExpr("a OR b") as BinaryExpression;
      expect(expr.operator).toBe("OR");
    });
  });

  describe("operator precedence", () => {
    it("should bind * tighter than +", () => {
      // a + b * c should parse as a + (b * c)
      const expr = parseExpr("a + b * c") as BinaryExpression;

      expect(expr.operator).toBe("+");
      expect(expr.left).toEqual({ type: "ColumnRef", column: "a" });

      const right = expr.right as BinaryExpression;
      expect(right.operator).toBe("*");
      expect(right.left).toEqual({ type: "ColumnRef", column: "b" });
      expect(right.right).toEqual({ type: "ColumnRef", column: "c" });
    });

    it("should bind * tighter than -", () => {
      // a - b * c should parse as a - (b * c)
      const expr = parseExpr("a - b * c") as BinaryExpression;

      expect(expr.operator).toBe("-");
      const right = expr.right as BinaryExpression;
      expect(right.operator).toBe("*");
    });

    it("should bind / tighter than +", () => {
      // a + b / c should parse as a + (b / c)
      const expr = parseExpr("a + b / c") as BinaryExpression;

      expect(expr.operator).toBe("+");
      const right = expr.right as BinaryExpression;
      expect(right.operator).toBe("/");
    });

    it("should bind AND tighter than OR", () => {
      // a OR b AND c should parse as a OR (b AND c)
      const expr = parseExpr("a OR b AND c") as BinaryExpression;

      expect(expr.operator).toBe("OR");
      const right = expr.right as BinaryExpression;
      expect(right.operator).toBe("AND");
    });

    it("should bind comparison tighter than AND", () => {
      // a > 1 AND b < 2 should parse as (a > 1) AND (b < 2)
      const expr = parseExpr("a > 1 AND b < 2") as BinaryExpression;

      expect(expr.operator).toBe("AND");
      expect((expr.left as BinaryExpression).operator).toBe(">");
      expect((expr.right as BinaryExpression).operator).toBe("<");
    });

    it("should handle left-to-right associativity for same precedence", () => {
      // a + b + c should parse as (a + b) + c
      const expr = parseExpr("a + b + c") as BinaryExpression;

      expect(expr.operator).toBe("+");
      expect(expr.right).toEqual({ type: "ColumnRef", column: "c" });

      const left = expr.left as BinaryExpression;
      expect(left.operator).toBe("+");
      expect(left.left).toEqual({ type: "ColumnRef", column: "a" });
      expect(left.right).toEqual({ type: "ColumnRef", column: "b" });
    });
  });

  describe("parentheses", () => {
    it("should override precedence with parentheses", () => {
      // (a + b) * c should parse as (a + b) * c
      const expr = parseExpr("(a + b) * c") as BinaryExpression;

      expect(expr.operator).toBe("*");
      expect(expr.right).toEqual({ type: "ColumnRef", column: "c" });

      const left = expr.left as BinaryExpression;
      expect(left.operator).toBe("+");
    });

    it("should handle nested parentheses", () => {
      const expr = parseExpr("((a + b))") as BinaryExpression;
      expect(expr.operator).toBe("+");
    });

    it("should handle complex parenthesized expression", () => {
      // (a + b) * (c - d)
      const expr = parseExpr("(a + b) * (c - d)") as BinaryExpression;

      expect(expr.operator).toBe("*");
      expect((expr.left as BinaryExpression).operator).toBe("+");
      expect((expr.right as BinaryExpression).operator).toBe("-");
    });
  });

  describe("unary operators", () => {
    it("should parse unary NOT", () => {
      const expr = parseExpr("NOT active");
      expect(expr).toEqual({
        type: "Unary",
        operator: "NOT",
        operand: { type: "ColumnRef", column: "active" },
      });
    });

    it("should parse unary minus", () => {
      const expr = parseExpr("-price");
      expect(expr).toEqual({
        type: "Unary",
        operator: "-",
        operand: { type: "ColumnRef", column: "price" },
      });
    });

    it("should bind unary tighter than binary", () => {
      // -a + b should parse as (-a) + b
      const expr = parseExpr("-a + b") as BinaryExpression;

      expect(expr.operator).toBe("+");
      expect(expr.left).toEqual({
        type: "Unary",
        operator: "-",
        operand: { type: "ColumnRef", column: "a" },
      });
    });
  });

  describe("function calls", () => {
    it("should parse function with no arguments", () => {
      const expr = parseExpr("NOW()");
      expect(expr).toEqual({
        type: "FunctionCall",
        name: "NOW",
        args: [],
      });
    });

    it("should parse function with one argument", () => {
      const expr = parseExpr("UPPER(name)");
      expect(expr).toEqual({
        type: "FunctionCall",
        name: "UPPER",
        args: [{ type: "ColumnRef", column: "name" }],
      });
    });

    it("should parse function with multiple arguments", () => {
      const expr = parseExpr("SUBSTR(name, 1, 5)");
      expect(expr).toEqual({
        type: "FunctionCall",
        name: "SUBSTR",
        args: [
          { type: "ColumnRef", column: "name" },
          { type: "Literal", value: 1, dataType: "INTEGER" },
          { type: "Literal", value: 5, dataType: "INTEGER" },
        ],
      });
    });

    it("should parse COUNT(*)", () => {
      const expr = parseExpr("COUNT(*)");
      expect(expr).toEqual({
        type: "FunctionCall",
        name: "COUNT",
        args: [{ type: "ColumnRef", column: "*" }],
      });
    });

    it("should parse nested function calls", () => {
      const expr = parseExpr("UPPER(TRIM(name))");
      expect(expr.type).toBe("FunctionCall");
    });

    it("should parse function with expression argument", () => {
      const expr = parseExpr("ABS(a - b)");
      expect(expr.type).toBe("FunctionCall");
    });
  });

  describe("complex expressions", () => {
    it("should parse WHERE-like condition", () => {
      const expr = parseExpr("age > 21 AND name = 'Alice'") as BinaryExpression;

      expect(expr.operator).toBe("AND");
      expect((expr.left as BinaryExpression).operator).toBe(">");
      expect((expr.right as BinaryExpression).operator).toBe("=");
    });

    it("should parse arithmetic in comparison", () => {
      // price * quantity > 100
      const expr = parseExpr("price * quantity > 100") as BinaryExpression;

      expect(expr.operator).toBe(">");
      expect((expr.left as BinaryExpression).operator).toBe("*");
    });
  });
});

describe("SELECT Statement", () => {
  it("should parse SELECT *", () => {
    const stmt = parse("SELECT * FROM users") as SelectStatement;

    expect(stmt.type).toBe("SelectStatement");
    expect(stmt.columns).toEqual([{ type: "AllColumns" }]);
    expect(stmt.from).toBe("users");
  });

  it("should parse SELECT with column list", () => {
    const stmt = parse("SELECT name, age FROM users") as SelectStatement;

    expect(stmt.columns).toHaveLength(2);
    expect(stmt.columns[0]?.type).toBe("Expression");
  });

  it("should parse SELECT with WHERE clause", () => {
    const stmt = parse("SELECT * FROM users WHERE age > 21") as SelectStatement;

    expect(stmt.where).toBeDefined();
    expect(stmt.where?.type).toBe("Binary");
  });

  it("should parse SELECT with ORDER BY", () => {
    const stmt = parse("SELECT * FROM users ORDER BY name") as SelectStatement;

    expect(stmt.orderBy).toHaveLength(1);
    expect(stmt.orderBy?.[0]?.direction).toBe("ASC");
  });

  it("should parse SELECT with ORDER BY DESC", () => {
    const stmt = parse("SELECT * FROM users ORDER BY age DESC") as SelectStatement;

    expect(stmt.orderBy?.[0]?.direction).toBe("DESC");
  });

  it("should parse SELECT with multiple ORDER BY columns", () => {
    const stmt = parse("SELECT * FROM users ORDER BY name ASC, age DESC") as SelectStatement;

    expect(stmt.orderBy).toHaveLength(2);
    expect(stmt.orderBy?.[0]?.direction).toBe("ASC");
    expect(stmt.orderBy?.[1]?.direction).toBe("DESC");
  });

  it("should parse SELECT with LIMIT", () => {
    const stmt = parse("SELECT * FROM users LIMIT 10") as SelectStatement;

    expect(stmt.limit).toBe(10);
  });

  it("should parse SELECT with all clauses", () => {
    const stmt = parse(
      "SELECT name, age FROM users WHERE active = TRUE ORDER BY name LIMIT 5"
    ) as SelectStatement;

    expect(stmt.columns).toHaveLength(2);
    expect(stmt.from).toBe("users");
    expect(stmt.where).toBeDefined();
    expect(stmt.orderBy).toHaveLength(1);
    expect(stmt.limit).toBe(5);
  });
});

describe("INSERT Statement", () => {
  it("should parse INSERT with single value", () => {
    const stmt = parse("INSERT INTO users (name) VALUES ('Alice')") as InsertStatement;

    expect(stmt.type).toBe("InsertStatement");
    expect(stmt.table).toBe("users");
    expect(stmt.columns).toEqual(["name"]);
    expect(stmt.values).toHaveLength(1);
  });

  it("should parse INSERT with multiple columns", () => {
    const stmt = parse(
      "INSERT INTO users (name, age, active) VALUES ('Bob', 30, TRUE)"
    ) as InsertStatement;

    expect(stmt.columns).toEqual(["name", "age", "active"]);
    expect(stmt.values).toHaveLength(3);
  });

  it("should parse INSERT with expressions", () => {
    const stmt = parse("INSERT INTO orders (total) VALUES (price * quantity)") as InsertStatement;

    expect(stmt.values[0]?.type).toBe("Binary");
  });
});

describe("CREATE TABLE Statement", () => {
  it("should parse CREATE TABLE with single column", () => {
    const stmt = parse("CREATE TABLE users (id INTEGER)") as CreateTableStatement;

    expect(stmt.type).toBe("CreateTableStatement");
    expect(stmt.table).toBe("users");
    expect(stmt.columns).toHaveLength(1);
    expect(stmt.columns[0]).toEqual({ name: "id", dataType: "INTEGER", primaryKey: undefined });
  });

  it("should parse CREATE TABLE with multiple columns", () => {
    const stmt = parse(
      "CREATE TABLE users (id INTEGER, name TEXT, active BOOLEAN, balance REAL)"
    ) as CreateTableStatement;

    expect(stmt.columns).toHaveLength(4);
    expect(stmt.columns[0]?.dataType).toBe("INTEGER");
    expect(stmt.columns[1]?.dataType).toBe("TEXT");
    expect(stmt.columns[2]?.dataType).toBe("BOOLEAN");
    expect(stmt.columns[3]?.dataType).toBe("REAL");
  });

  it("should parse CREATE TABLE with PRIMARY KEY", () => {
    const stmt = parse(
      "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)"
    ) as CreateTableStatement;

    expect(stmt.columns[0]?.primaryKey).toBe(true);
    expect(stmt.columns[1]?.primaryKey).toBeUndefined();
  });
});

describe("UPDATE Statement", () => {
  it("should parse UPDATE with single assignment", () => {
    const stmt = parse("UPDATE users SET name = 'Alice'") as UpdateStatement;

    expect(stmt.type).toBe("UpdateStatement");
    expect(stmt.table).toBe("users");
    expect(stmt.assignments).toHaveLength(1);
    expect(stmt.assignments[0]?.column).toBe("name");
  });

  it("should parse UPDATE with multiple assignments", () => {
    const stmt = parse("UPDATE users SET name = 'Bob', age = 30") as UpdateStatement;

    expect(stmt.assignments).toHaveLength(2);
  });

  it("should parse UPDATE with WHERE clause", () => {
    const stmt = parse("UPDATE users SET name = 'Alice' WHERE id = 1") as UpdateStatement;

    expect(stmt.where).toBeDefined();
    expect(stmt.where?.type).toBe("Binary");
  });

  it("should parse UPDATE with expression value", () => {
    const stmt = parse("UPDATE products SET price = price * 1.1") as UpdateStatement;

    expect(stmt.assignments[0]?.value.type).toBe("Binary");
  });
});

describe("DELETE Statement", () => {
  it("should parse DELETE without WHERE", () => {
    const stmt = parse("DELETE FROM users") as DeleteStatement;

    expect(stmt.type).toBe("DeleteStatement");
    expect(stmt.table).toBe("users");
    expect(stmt.where).toBeUndefined();
  });

  it("should parse DELETE with WHERE", () => {
    const stmt = parse("DELETE FROM users WHERE id = 1") as DeleteStatement;

    expect(stmt.where).toBeDefined();
  });

  it("should parse DELETE with complex WHERE", () => {
    const stmt = parse("DELETE FROM users WHERE age < 18 OR inactive = TRUE") as DeleteStatement;

    expect(stmt.where?.type).toBe("Binary");
  });
});

describe("DROP TABLE Statement", () => {
  it("should parse DROP TABLE", () => {
    const stmt = parse("DROP TABLE users") as DropTableStatement;

    expect(stmt.type).toBe("DropTableStatement");
    expect(stmt.table).toBe("users");
  });
});
