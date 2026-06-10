import { describe, it, expect } from "vitest";
import type {
  Statement,
  SelectStatement,
  InsertStatement,
  UpdateStatement,
  DeleteStatement,
  CreateTableStatement,
  DropTableStatement,
  BeginStatement,
  CommitStatement,
  RollbackStatement,
  LiteralExpression,
  ColumnRefExpression,
  BinaryExpression,
  FunctionCallExpression,
} from "./ast.js";

describe("AST Statement Types", () => {
  describe("SelectStatement", () => {
    it("should capture all SELECT clauses", () => {
      const stmt: SelectStatement = {
        type: "SelectStatement",
        columns: [
          { type: "Expression", expression: { type: "ColumnRef", column: "name" } },
          { type: "Expression", expression: { type: "ColumnRef", column: "age" }, alias: "years" },
        ],
        from: "users",
        where: {
          type: "Binary",
          operator: ">",
          left: { type: "ColumnRef", column: "age" },
          right: { type: "Literal", value: 21, dataType: "INTEGER" },
        },
        orderBy: [{ expression: { type: "ColumnRef", column: "name" }, direction: "ASC" }],
        limit: 10,
      };

      expect(stmt.type).toBe("SelectStatement");
      expect(stmt.columns).toHaveLength(2);
      expect(stmt.from).toBe("users");
      expect(stmt.where).toBeDefined();
      expect(stmt.orderBy).toHaveLength(1);
      expect(stmt.limit).toBe(10);
    });

    it("should support SELECT *", () => {
      const stmt: SelectStatement = {
        type: "SelectStatement",
        columns: [{ type: "AllColumns" }],
        from: "users",
      };

      expect(stmt.columns[0]?.type).toBe("AllColumns");
    });
  });

  describe("InsertStatement", () => {
    it("should capture table, columns, and values", () => {
      const stmt: InsertStatement = {
        type: "InsertStatement",
        table: "users",
        columns: ["name", "age"],
        values: [
          { type: "Literal", value: "Alice", dataType: "TEXT" },
          { type: "Literal", value: 30, dataType: "INTEGER" },
        ],
      };

      expect(stmt.type).toBe("InsertStatement");
      expect(stmt.table).toBe("users");
      expect(stmt.columns).toEqual(["name", "age"]);
      expect(stmt.values).toHaveLength(2);
    });
  });

  describe("UpdateStatement", () => {
    it("should capture table, assignments, and optional where", () => {
      const stmt: UpdateStatement = {
        type: "UpdateStatement",
        table: "users",
        assignments: [
          {
            column: "age",
            value: { type: "Literal", value: 31, dataType: "INTEGER" },
          },
        ],
        where: {
          type: "Binary",
          operator: "=",
          left: { type: "ColumnRef", column: "id" },
          right: { type: "Literal", value: 1, dataType: "INTEGER" },
        },
      };

      expect(stmt.type).toBe("UpdateStatement");
      expect(stmt.table).toBe("users");
      expect(stmt.assignments).toHaveLength(1);
      expect(stmt.where).toBeDefined();
    });
  });

  describe("DeleteStatement", () => {
    it("should capture table and optional where", () => {
      const stmt: DeleteStatement = {
        type: "DeleteStatement",
        table: "users",
        where: {
          type: "Binary",
          operator: "=",
          left: { type: "ColumnRef", column: "id" },
          right: { type: "Literal", value: 1, dataType: "INTEGER" },
        },
      };

      expect(stmt.type).toBe("DeleteStatement");
      expect(stmt.table).toBe("users");
      expect(stmt.where).toBeDefined();
    });
  });

  describe("CreateTableStatement", () => {
    it("should capture table name and column definitions", () => {
      const stmt: CreateTableStatement = {
        type: "CreateTableStatement",
        table: "users",
        columns: [
          { name: "id", dataType: "INTEGER" },
          { name: "name", dataType: "TEXT" },
          { name: "active", dataType: "BOOLEAN" },
          { name: "balance", dataType: "REAL" },
        ],
      };

      expect(stmt.type).toBe("CreateTableStatement");
      expect(stmt.table).toBe("users");
      expect(stmt.columns).toHaveLength(4);
      expect(stmt.columns[0]).toEqual({ name: "id", dataType: "INTEGER" });
    });
  });

  describe("DropTableStatement", () => {
    it("should capture table name", () => {
      const stmt: DropTableStatement = {
        type: "DropTableStatement",
        table: "users",
      };

      expect(stmt.type).toBe("DropTableStatement");
      expect(stmt.table).toBe("users");
    });
  });

  describe("Transaction Statements", () => {
    it("should represent BEGIN", () => {
      const stmt: BeginStatement = { type: "BeginStatement" };
      expect(stmt.type).toBe("BeginStatement");
    });

    it("should represent COMMIT", () => {
      const stmt: CommitStatement = { type: "CommitStatement" };
      expect(stmt.type).toBe("CommitStatement");
    });

    it("should represent ROLLBACK", () => {
      const stmt: RollbackStatement = { type: "RollbackStatement" };
      expect(stmt.type).toBe("RollbackStatement");
    });
  });

  describe("Discriminated Union", () => {
    it("should allow exhaustive pattern matching", () => {
      const statements: Statement[] = [
        { type: "SelectStatement", columns: [{ type: "AllColumns" }], from: "t" },
        { type: "InsertStatement", table: "t", columns: ["c"], values: [] },
        { type: "UpdateStatement", table: "t", assignments: [] },
        { type: "DeleteStatement", table: "t" },
        { type: "CreateTableStatement", table: "t", columns: [] },
        { type: "DropTableStatement", table: "t" },
        { type: "BeginStatement" },
        { type: "CommitStatement" },
        { type: "RollbackStatement" },
      ];

      // This function demonstrates exhaustive handling
      function getStatementName(stmt: Statement): string {
        switch (stmt.type) {
          case "SelectStatement":
            return "SELECT";
          case "InsertStatement":
            return "INSERT";
          case "UpdateStatement":
            return "UPDATE";
          case "DeleteStatement":
            return "DELETE";
          case "CreateTableStatement":
            return "CREATE TABLE";
          case "DropTableStatement":
            return "DROP TABLE";
          case "BeginStatement":
            return "BEGIN";
          case "CommitStatement":
            return "COMMIT";
          case "RollbackStatement":
            return "ROLLBACK";
        }
      }

      const names = statements.map(getStatementName);
      expect(names).toEqual([
        "SELECT",
        "INSERT",
        "UPDATE",
        "DELETE",
        "CREATE TABLE",
        "DROP TABLE",
        "BEGIN",
        "COMMIT",
        "ROLLBACK",
      ]);
    });
  });
});

describe("AST Expression Types", () => {
  describe("LiteralExpression", () => {
    it("should represent different literal types", () => {
      const intLiteral: LiteralExpression = { type: "Literal", value: 42, dataType: "INTEGER" };
      const textLiteral: LiteralExpression = { type: "Literal", value: "hello", dataType: "TEXT" };
      const boolLiteral: LiteralExpression = { type: "Literal", value: true, dataType: "BOOLEAN" };
      const nullLiteral: LiteralExpression = { type: "Literal", value: null, dataType: "NULL" };

      expect(intLiteral.value).toBe(42);
      expect(textLiteral.value).toBe("hello");
      expect(boolLiteral.value).toBe(true);
      expect(nullLiteral.value).toBeNull();
    });
  });

  describe("ColumnRefExpression", () => {
    it("should represent simple column reference", () => {
      const col: ColumnRefExpression = { type: "ColumnRef", column: "name" };
      expect(col.column).toBe("name");
      expect(col.table).toBeUndefined();
    });

    it("should represent qualified column reference", () => {
      const col: ColumnRefExpression = { type: "ColumnRef", table: "users", column: "id" };
      expect(col.table).toBe("users");
      expect(col.column).toBe("id");
    });
  });

  describe("BinaryExpression", () => {
    it("should support nested expressions", () => {
      // Represents: (a + b) * c
      const expr: BinaryExpression = {
        type: "Binary",
        operator: "*",
        left: {
          type: "Binary",
          operator: "+",
          left: { type: "ColumnRef", column: "a" },
          right: { type: "ColumnRef", column: "b" },
        },
        right: { type: "ColumnRef", column: "c" },
      };

      expect(expr.operator).toBe("*");
      expect(expr.left.type).toBe("Binary");
      expect((expr.left as BinaryExpression).operator).toBe("+");
    });
  });

  describe("FunctionCallExpression", () => {
    it("should represent function with no arguments", () => {
      const expr: FunctionCallExpression = {
        type: "FunctionCall",
        name: "NOW",
        args: [],
      };

      expect(expr.type).toBe("FunctionCall");
      expect(expr.name).toBe("NOW");
      expect(expr.args).toHaveLength(0);
    });

    it("should represent function with single argument", () => {
      // UPPER(name)
      const expr: FunctionCallExpression = {
        type: "FunctionCall",
        name: "UPPER",
        args: [{ type: "ColumnRef", column: "name" }],
      };

      expect(expr.name).toBe("UPPER");
      expect(expr.args).toHaveLength(1);
      expect(expr.args[0]?.type).toBe("ColumnRef");
    });

    it("should represent aggregate functions", () => {
      // COUNT(*) - represented as COUNT with no args (special case)
      // SUM(amount)
      const sum: FunctionCallExpression = {
        type: "FunctionCall",
        name: "SUM",
        args: [{ type: "ColumnRef", column: "amount" }],
      };

      expect(sum.name).toBe("SUM");
    });

    it("should support nested expressions as arguments", () => {
      // ROUND(price * 1.1, 2)
      const expr: FunctionCallExpression = {
        type: "FunctionCall",
        name: "ROUND",
        args: [
          {
            type: "Binary",
            operator: "*",
            left: { type: "ColumnRef", column: "price" },
            right: { type: "Literal", value: 1.1, dataType: "REAL" },
          },
          { type: "Literal", value: 2, dataType: "INTEGER" },
        ],
      };

      expect(expr.args).toHaveLength(2);
      expect(expr.args[0]?.type).toBe("Binary");
    });
  });

  describe("Expression nesting", () => {
    it("should represent complex WHERE clause", () => {
      // Represents: age > 21 AND active = TRUE
      const where: BinaryExpression = {
        type: "Binary",
        operator: "AND",
        left: {
          type: "Binary",
          operator: ">",
          left: { type: "ColumnRef", column: "age" },
          right: { type: "Literal", value: 21, dataType: "INTEGER" },
        },
        right: {
          type: "Binary",
          operator: "=",
          left: { type: "ColumnRef", column: "active" },
          right: { type: "Literal", value: true, dataType: "BOOLEAN" },
        },
      };

      expect(where.type).toBe("Binary");
      expect(where.operator).toBe("AND");
    });

    it("should support arbitrary nesting depth", () => {
      // Represents: ((a + b) * c) - d
      // Tree depth of 3
      const expr: BinaryExpression = {
        type: "Binary",
        operator: "-",
        left: {
          type: "Binary",
          operator: "*",
          left: {
            type: "Binary",
            operator: "+",
            left: { type: "ColumnRef", column: "a" },
            right: { type: "ColumnRef", column: "b" },
          },
          right: { type: "ColumnRef", column: "c" },
        },
        right: { type: "ColumnRef", column: "d" },
      };

      // Navigate the tree to verify depth
      expect(expr.operator).toBe("-");
      expect(expr.left.type).toBe("Binary");

      const mult = expr.left as BinaryExpression;
      expect(mult.operator).toBe("*");
      expect(mult.left.type).toBe("Binary");

      const add = mult.left as BinaryExpression;
      expect(add.operator).toBe("+");
    });

    it("should encode operator precedence in tree shape", () => {
      // 1 + 2 * 3 should be represented as 1 + (2 * 3)
      // The * is deeper in the tree, so it evaluates first
      const expr: BinaryExpression = {
        type: "Binary",
        operator: "+",
        left: { type: "Literal", value: 1, dataType: "INTEGER" },
        right: {
          type: "Binary",
          operator: "*",
          left: { type: "Literal", value: 2, dataType: "INTEGER" },
          right: { type: "Literal", value: 3, dataType: "INTEGER" },
        },
      };

      // + is at the top (evaluated last)
      expect(expr.operator).toBe("+");
      // * is deeper (evaluated first)
      expect((expr.right as BinaryExpression).operator).toBe("*");
    });
  });
});
