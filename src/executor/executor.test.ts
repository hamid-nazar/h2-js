import { describe, it, expect, beforeEach } from "vitest";
import {
  execute,
  executeSelect,
  executeInsert,
  executeUpdate,
  executeDelete,
  SelectResult,
} from "./executor.js";
import { TableStore } from "./store.js";
import { Parser } from "../sql/parser.js";
import { Lexer } from "../sql/lexer.js";
import {
  SelectStatement,
  InsertStatement,
  UpdateStatement,
  DeleteStatement,
  Statement,
} from "../sql/ast.js";
import { Value, integer, real, text, boolean, NULL, isNull } from "../types/value.js";

// =============================================================================
// Helper Functions
// =============================================================================

function parse(sql: string): Statement {
  const lexer = new Lexer(sql);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  return parser.parse();
}

function parseSelect(sql: string): SelectStatement {
  const stmt = parse(sql);
  if (stmt.type !== "SelectStatement") {
    throw new Error(`Expected SelectStatement, got ${stmt.type}`);
  }
  return stmt;
}

function parseInsert(sql: string): InsertStatement {
  const stmt = parse(sql);
  if (stmt.type !== "InsertStatement") {
    throw new Error(`Expected InsertStatement, got ${stmt.type}`);
  }
  return stmt;
}

function parseUpdate(sql: string): UpdateStatement {
  const stmt = parse(sql);
  if (stmt.type !== "UpdateStatement") {
    throw new Error(`Expected UpdateStatement, got ${stmt.type}`);
  }
  return stmt;
}

function parseDelete(sql: string): DeleteStatement {
  const stmt = parse(sql);
  if (stmt.type !== "DeleteStatement") {
    throw new Error(`Expected DeleteStatement, got ${stmt.type}`);
  }
  return stmt;
}

// =============================================================================
// Test Setup
// =============================================================================

describe("Query Executor", () => {
  let store: TableStore;

  beforeEach(() => {
    store = new TableStore();

    // Create a users table
    store.createTable("users", [
      { name: "id", dataType: "INTEGER", primaryKey: true },
      { name: "name", dataType: "TEXT" },
      { name: "age", dataType: "INTEGER" },
      { name: "active", dataType: "BOOLEAN" },
    ]);

    // Insert test data
    store.insert("users", [integer(1), text("Alice"), integer(30), boolean(true)]);
    store.insert("users", [integer(2), text("Bob"), integer(25), boolean(false)]);
    store.insert("users", [integer(3), text("Charlie"), integer(35), boolean(true)]);
    store.insert("users", [integer(4), text("Diana"), integer(28), boolean(true)]);

    // Create a products table
    store.createTable("products", [
      { name: "id", dataType: "INTEGER", primaryKey: true },
      { name: "name", dataType: "TEXT" },
      { name: "price", dataType: "REAL" },
      { name: "quantity", dataType: "INTEGER" },
    ]);

    store.insert("products", [integer(1), text("Widget"), real(10.0), integer(5)]);
    store.insert("products", [integer(2), text("Gadget"), real(25.0), integer(3)]);
    store.insert("products", [integer(3), text("Gizmo"), real(15.0), integer(0)]);
  });

  // ===========================================================================
  // SELECT Tests
  // ===========================================================================

  describe("SELECT", () => {
    it("should select all columns with *", () => {
      const stmt = parseSelect("SELECT * FROM users");
      const result = executeSelect(stmt, store);

      expect(result.columns).toEqual(["id", "name", "age", "active"]);
      expect(result.rows).toHaveLength(4);
      expect(result.rows[0]).toEqual([
        integer(1),
        text("Alice"),
        integer(30),
        boolean(true),
      ]);
    });

    it("should select specific columns", () => {
      const stmt = parseSelect("SELECT name, age FROM users");
      const result = executeSelect(stmt, store);

      expect(result.columns).toEqual(["name", "age"]);
      expect(result.rows).toHaveLength(4);
      expect(result.rows[0]).toEqual([text("Alice"), integer(30)]);
    });

    it("should filter with WHERE clause", () => {
      const stmt = parseSelect("SELECT name FROM users WHERE age > 27");
      const result = executeSelect(stmt, store);

      expect(result.columns).toEqual(["name"]);
      expect(result.rows).toHaveLength(3);
      expect(result.rows.map((r) => r[0])).toEqual([
        text("Alice"),
        text("Charlie"),
        text("Diana"),
      ]);
    });

    it("should filter with boolean column", () => {
      const stmt = parseSelect("SELECT name FROM users WHERE active = TRUE");
      const result = executeSelect(stmt, store);

      expect(result.rows).toHaveLength(3);
    });

    it("should filter with compound WHERE", () => {
      const stmt = parseSelect(
        "SELECT name FROM users WHERE age > 25 AND active = TRUE"
      );
      const result = executeSelect(stmt, store);

      expect(result.rows).toHaveLength(3); // Alice (30), Charlie (35), Diana (28)
    });

    it("should limit results", () => {
      const stmt = parseSelect("SELECT name FROM users LIMIT 2");
      const result = executeSelect(stmt, store);

      expect(result.rows).toHaveLength(2);
      expect(result.rows[0]).toEqual([text("Alice")]);
      expect(result.rows[1]).toEqual([text("Bob")]);
    });

    it("should combine WHERE and LIMIT", () => {
      const stmt = parseSelect("SELECT name FROM users WHERE age > 25 LIMIT 2");
      const result = executeSelect(stmt, store);

      expect(result.rows).toHaveLength(2);
    });

    it("should compute expressions in SELECT", () => {
      const stmt = parseSelect("SELECT name, price * 2 AS double_price FROM products");
      const result = executeSelect(stmt, store);

      expect(result.columns).toEqual(["name", "double_price"]);
      expect(result.rows[0]).toEqual([text("Widget"), real(20.0)]);
      expect(result.rows[1]).toEqual([text("Gadget"), real(50.0)]);
    });

    it("should compute complex expressions", () => {
      const stmt = parseSelect(
        "SELECT name, price * quantity AS total FROM products WHERE quantity > 0"
      );
      const result = executeSelect(stmt, store);

      expect(result.rows).toHaveLength(2);
      expect(result.rows[0]).toEqual([text("Widget"), real(50.0)]); // 10 * 5
      expect(result.rows[1]).toEqual([text("Gadget"), real(75.0)]); // 25 * 3
    });

    it("should handle empty result", () => {
      const stmt = parseSelect("SELECT name FROM users WHERE age > 100");
      const result = executeSelect(stmt, store);

      expect(result.rows).toHaveLength(0);
      expect(result.columns).toEqual(["name"]);
    });
  });

  // ===========================================================================
  // INSERT Tests
  // ===========================================================================

  describe("INSERT", () => {
    it("should insert a row", () => {
      const stmt = parseInsert(
        "INSERT INTO users (id, name, age, active) VALUES (5, 'Eve', 22, TRUE)"
      );
      const result = executeInsert(stmt, store);

      expect(result.type).toBe("insert");
      expect(result.rowsAffected).toBe(1);

      // Verify the row was inserted
      const selectResult = executeSelect(
        parseSelect("SELECT name FROM users WHERE id = 5"),
        store
      );
      expect(selectResult.rows).toHaveLength(1);
      expect(selectResult.rows[0]).toEqual([text("Eve")]);
    });

    it("should insert with columns in different order", () => {
      const stmt = parseInsert(
        "INSERT INTO users (name, id, active, age) VALUES ('Frank', 6, FALSE, 40)"
      );
      executeInsert(stmt, store);

      const selectResult = executeSelect(
        parseSelect("SELECT id, name, age, active FROM users WHERE id = 6"),
        store
      );
      expect(selectResult.rows[0]).toEqual([
        integer(6),
        text("Frank"),
        integer(40),
        boolean(false),
      ]);
    });

    it("should throw on unknown column", () => {
      const stmt = parseInsert(
        "INSERT INTO users (id, name, unknown) VALUES (7, 'Test', 123)"
      );
      expect(() => executeInsert(stmt, store)).toThrow("Unknown column");
    });
  });

  // ===========================================================================
  // UPDATE Tests
  // ===========================================================================

  describe("UPDATE", () => {
    it("should update matching rows", () => {
      const stmt = parseUpdate("UPDATE users SET age = 31 WHERE name = 'Alice'");
      const result = executeUpdate(stmt, store);

      expect(result.type).toBe("update");
      expect(result.rowsAffected).toBe(1);

      // Verify the update
      const selectResult = executeSelect(
        parseSelect("SELECT age FROM users WHERE name = 'Alice'"),
        store
      );
      expect(selectResult.rows[0]).toEqual([integer(31)]);
    });

    it("should update multiple rows", () => {
      const stmt = parseUpdate("UPDATE users SET active = FALSE WHERE age < 30");
      const result = executeUpdate(stmt, store);

      expect(result.rowsAffected).toBe(2); // Bob (25) and Diana (28)

      // Verify the updates
      const selectResult = executeSelect(
        parseSelect("SELECT name, active FROM users WHERE active = FALSE"),
        store
      );
      expect(selectResult.rows).toHaveLength(2); // Bob and Diana both now FALSE
    });

    it("should update all rows without WHERE clause", () => {
      const stmt = parseUpdate("UPDATE users SET active = TRUE");
      const result = executeUpdate(stmt, store);

      expect(result.rowsAffected).toBe(4);

      const selectResult = executeSelect(
        parseSelect("SELECT name FROM users WHERE active = FALSE"),
        store
      );
      expect(selectResult.rows).toHaveLength(0);
    });

    it("should update multiple columns", () => {
      const stmt = parseUpdate(
        "UPDATE users SET age = 99, active = FALSE WHERE id = 1"
      );
      executeUpdate(stmt, store);

      const selectResult = executeSelect(
        parseSelect("SELECT age, active FROM users WHERE id = 1"),
        store
      );
      expect(selectResult.rows[0]).toEqual([integer(99), boolean(false)]);
    });

    it("should support expressions in SET clause", () => {
      const stmt = parseUpdate("UPDATE users SET age = age + 1 WHERE id = 1");
      executeUpdate(stmt, store);

      const selectResult = executeSelect(
        parseSelect("SELECT age FROM users WHERE id = 1"),
        store
      );
      expect(selectResult.rows[0]).toEqual([integer(31)]); // Was 30, now 31
    });

    it("should return 0 when no rows match", () => {
      const stmt = parseUpdate("UPDATE users SET age = 100 WHERE age > 1000");
      const result = executeUpdate(stmt, store);

      expect(result.rowsAffected).toBe(0);
    });

    it("should throw on unknown column in SET", () => {
      const stmt = parseUpdate("UPDATE users SET unknown = 5 WHERE id = 1");
      expect(() => executeUpdate(stmt, store)).toThrow("Unknown column");
    });
  });

  // ===========================================================================
  // DELETE Tests
  // ===========================================================================

  describe("DELETE", () => {
    it("should delete matching rows", () => {
      const stmt = parseDelete("DELETE FROM users WHERE name = 'Bob'");
      const result = executeDelete(stmt, store);

      expect(result.type).toBe("delete");
      expect(result.rowsAffected).toBe(1);

      // Verify the deletion
      const selectResult = executeSelect(
        parseSelect("SELECT * FROM users"),
        store
      );
      expect(selectResult.rows).toHaveLength(3);
    });

    it("should delete multiple rows", () => {
      const stmt = parseDelete("DELETE FROM users WHERE age < 30");
      const result = executeDelete(stmt, store);

      expect(result.rowsAffected).toBe(2); // Bob (25) and Diana (28)

      const selectResult = executeSelect(
        parseSelect("SELECT name FROM users"),
        store
      );
      expect(selectResult.rows).toHaveLength(2);
      expect(selectResult.rows.map((r) => r[0])).toEqual([
        text("Alice"),
        text("Charlie"),
      ]);
    });

    it("should delete all rows without WHERE clause", () => {
      const stmt = parseDelete("DELETE FROM users");
      const result = executeDelete(stmt, store);

      expect(result.rowsAffected).toBe(4);

      const selectResult = executeSelect(
        parseSelect("SELECT * FROM users"),
        store
      );
      expect(selectResult.rows).toHaveLength(0);
    });

    it("should return 0 when no rows match", () => {
      const stmt = parseDelete("DELETE FROM users WHERE age > 1000");
      const result = executeDelete(stmt, store);

      expect(result.rowsAffected).toBe(0);
    });

    it("should work with complex WHERE conditions", () => {
      const stmt = parseDelete(
        "DELETE FROM users WHERE age > 25 AND active = FALSE"
      );
      const result = executeDelete(stmt, store);

      // No rows match (Bob is 25, not > 25; others with age > 25 are active)
      expect(result.rowsAffected).toBe(0);
    });
  });

  // ===========================================================================
  // CREATE TABLE Tests
  // ===========================================================================

  describe("CREATE TABLE", () => {
    it("should create a new table", () => {
      const stmt = parse(
        "CREATE TABLE orders (id INTEGER PRIMARY KEY, total REAL)"
      );
      const result = execute(stmt, store);

      expect(result.type).toBe("createTable");
      expect((result as { tableName: string }).tableName).toBe("orders");
      expect(store.hasTable("orders")).toBe(true);
    });

    it("should throw if table already exists", () => {
      const stmt = parse("CREATE TABLE users (id INTEGER)");
      expect(() => execute(stmt, store)).toThrow("already exists");
    });
  });

  // ===========================================================================
  // DROP TABLE Tests
  // ===========================================================================

  describe("DROP TABLE", () => {
    it("should drop an existing table", () => {
      const stmt = parse("DROP TABLE products");
      const result = execute(stmt, store);

      expect(result.type).toBe("dropTable");
      expect(store.hasTable("products")).toBe(false);
    });

    it("should throw if table doesn't exist", () => {
      const stmt = parse("DROP TABLE nonexistent");
      expect(() => execute(stmt, store)).toThrow("does not exist");
    });
  });

  // ===========================================================================
  // Integration Tests
  // ===========================================================================

  describe("Integration", () => {
    it("should execute a full workflow", () => {
      // Create a new store
      const testStore = new TableStore();

      // Create table
      execute(
        parse("CREATE TABLE employees (id INTEGER PRIMARY KEY, name TEXT, salary REAL)"),
        testStore
      );

      // Insert data
      execute(
        parse("INSERT INTO employees (id, name, salary) VALUES (1, 'Alice', 50000)"),
        testStore
      );
      execute(
        parse("INSERT INTO employees (id, name, salary) VALUES (2, 'Bob', 60000)"),
        testStore
      );
      execute(
        parse("INSERT INTO employees (id, name, salary) VALUES (3, 'Charlie', 55000)"),
        testStore
      );

      // Query with filter and computed column
      const result = execute(
        parse(
          "SELECT name, salary * 1.1 AS raised_salary FROM employees WHERE salary > 52000"
        ),
        testStore
      ) as SelectResult;

      expect(result.type).toBe("select");
      expect(result.rows).toHaveLength(2);
      expect(result.columns).toEqual(["name", "raised_salary"]);

      // Bob: 60000 * 1.1 = 66000
      // Charlie: 55000 * 1.1 = 60500
      expect(result.rows[0][0]).toEqual(text("Bob"));
      expect((result.rows[0][1] as { value: number }).value).toBeCloseTo(66000);
    });

    it("should handle case-insensitive table and column names", () => {
      const stmt = parseSelect("SELECT NAME, AGE FROM USERS WHERE ACTIVE = TRUE");
      const result = executeSelect(stmt, store);

      expect(result.rows).toHaveLength(3);
    });
  });

  // ===========================================================================
  // NULL Handling Tests
  // ===========================================================================

  describe("NULL Handling", () => {
    beforeEach(() => {
      store.createTable("nullable", [
        { name: "id", dataType: "INTEGER" },
        { name: "value", dataType: "INTEGER" },
      ]);
      store.insert("nullable", [integer(1), integer(10)]);
      store.insert("nullable", [integer(2), NULL]);
      store.insert("nullable", [integer(3), integer(30)]);
    });

    it("should filter out rows where predicate is NULL", () => {
      const stmt = parseSelect("SELECT id FROM nullable WHERE value > 5");
      const result = executeSelect(stmt, store);

      // Row with NULL value is filtered out (NULL > 5 is NULL, treated as false)
      expect(result.rows).toHaveLength(2);
      expect(result.rows.map((r) => r[0])).toEqual([integer(1), integer(3)]);
    });

    it("should preserve NULL values in output", () => {
      const stmt = parseSelect("SELECT id, value FROM nullable");
      const result = executeSelect(stmt, store);

      expect(result.rows).toHaveLength(3);
      const nullValue = result.rows[1]?.[1];
      expect(nullValue).toBeDefined();
      expect(isNull(nullValue as Value)).toBe(true);
    });
  });
});
