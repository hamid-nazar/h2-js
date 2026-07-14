import { describe, it, expect } from "vitest";
import {
  Row,
  createRow,
  getColumnValue,
  Operator,
  Scan,
  Filter,
  Project,
  Sort,
  Limit,
} from "./operator.js";
import { Expression, SelectColumn, OrderByItem } from "../sql/ast.js";
import { Value, integer, real, text, boolean, NULL } from "../types/value.js";

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Collect all rows from an operator into an array.
 */
function collectRows(op: Operator): Row[] {
  const rows: Row[] = [];
  op.open();
  let row = op.next();
  while (row !== null) {
    rows.push(row);
    row = op.next();
  }
  op.close();
  return rows;
}

/**
 * Create a literal expression.
 */
function literal(
  value: string | number | boolean | null,
  dataType: "INTEGER" | "REAL" | "TEXT" | "BOOLEAN" | "NULL"
): Expression {
  return { type: "Literal", value, dataType };
}

/**
 * Create a column reference expression.
 */
function col(column: string): Expression {
  return { type: "ColumnRef", column };
}

/**
 * Create a binary expression.
 */
function binary(
  operator: "=" | "<>" | "<" | ">" | "<=" | ">=" | "+" | "-" | "*" | "/" | "AND" | "OR",
  left: Expression,
  right: Expression
): Expression {
  return { type: "Binary", operator, left, right };
}

// =============================================================================
// Row Tests
// =============================================================================

describe("Row", () => {
  describe("createRow", () => {
    it("should create a row with columns and values", () => {
      const row = createRow(["id", "name"], [integer(1), text("Alice")]);
      expect(row.columns).toEqual(["id", "name"]);
      expect(row.values).toEqual([integer(1), text("Alice")]);
    });

    it("should throw if column/value counts don't match", () => {
      expect(() => createRow(["id", "name"], [integer(1)])).toThrow();
    });
  });

  describe("getColumnValue", () => {
    const row = createRow(
      ["id", "name", "age"],
      [integer(1), text("Alice"), integer(30)]
    );

    it("should get value by column name", () => {
      expect(getColumnValue(row, "id")).toEqual(integer(1));
      expect(getColumnValue(row, "name")).toEqual(text("Alice"));
      expect(getColumnValue(row, "age")).toEqual(integer(30));
    });

    it("should be case-insensitive", () => {
      expect(getColumnValue(row, "ID")).toEqual(integer(1));
      expect(getColumnValue(row, "NAME")).toEqual(text("Alice"));
      expect(getColumnValue(row, "Age")).toEqual(integer(30));
    });

    it("should return undefined for unknown column", () => {
      expect(getColumnValue(row, "unknown")).toBeUndefined();
    });
  });
});

// =============================================================================
// Scan Tests
// =============================================================================

describe("Scan", () => {
  const columns = ["id", "name", "age"];
  const data: Value[][] = [
    [integer(1), text("Alice"), integer(30)],
    [integer(2), text("Bob"), integer(25)],
    [integer(3), text("Charlie"), integer(35)],
  ];

  it("should scan all rows from a table", () => {
    const scan = new Scan("users", columns, data);
    const rows = collectRows(scan);

    expect(rows).toHaveLength(3);
    expect(rows[0].values).toEqual([integer(1), text("Alice"), integer(30)]);
    expect(rows[1].values).toEqual([integer(2), text("Bob"), integer(25)]);
    expect(rows[2].values).toEqual([integer(3), text("Charlie"), integer(35)]);
  });

  it("should return column names", () => {
    const scan = new Scan("users", columns, data);
    scan.open();
    expect(scan.getColumns()).toEqual(["id", "name", "age"]);
    scan.close();
  });

  it("should return table name", () => {
    const scan = new Scan("users", columns, data);
    expect(scan.getTableName()).toBe("users");
  });

  it("should handle empty table", () => {
    const scan = new Scan("empty", columns, []);
    const rows = collectRows(scan);
    expect(rows).toHaveLength(0);
  });

  it("should throw if next() called before open()", () => {
    const scan = new Scan("users", columns, data);
    expect(() => scan.next()).toThrow("Operator not open");
  });

  it("should be reusable after close/open", () => {
    const scan = new Scan("users", columns, data);

    // First pass
    let rows = collectRows(scan);
    expect(rows).toHaveLength(3);

    // Second pass
    rows = collectRows(scan);
    expect(rows).toHaveLength(3);
  });
});

// =============================================================================
// Filter Tests
// =============================================================================

describe("Filter", () => {
  const columns = ["id", "name", "age", "active"];
  const data: Value[][] = [
    [integer(1), text("Alice"), integer(30), boolean(true)],
    [integer(2), text("Bob"), integer(25), boolean(false)],
    [integer(3), text("Charlie"), integer(35), boolean(true)],
    [integer(4), text("Diana"), integer(28), boolean(true)],
  ];

  it("should filter rows by predicate", () => {
    const scan = new Scan("users", columns, data);
    // WHERE age > 27
    const filter = new Filter(scan, binary(">", col("age"), literal(27, "INTEGER")));

    const rows = collectRows(filter);
    expect(rows).toHaveLength(3);
    expect(getColumnValue(rows[0], "name")).toEqual(text("Alice"));
    expect(getColumnValue(rows[1], "name")).toEqual(text("Charlie"));
    expect(getColumnValue(rows[2], "name")).toEqual(text("Diana"));
  });

  it("should handle boolean column filter", () => {
    const scan = new Scan("users", columns, data);
    // WHERE active = TRUE
    const filter = new Filter(
      scan,
      binary("=", col("active"), literal(true, "BOOLEAN"))
    );

    const rows = collectRows(filter);
    expect(rows).toHaveLength(3);
  });

  it("should handle compound predicates", () => {
    const scan = new Scan("users", columns, data);
    // WHERE age > 27 AND active = TRUE
    const filter = new Filter(
      scan,
      binary(
        "AND",
        binary(">", col("age"), literal(27, "INTEGER")),
        binary("=", col("active"), literal(true, "BOOLEAN"))
      )
    );

    const rows = collectRows(filter);
    // Alice (30, true), Charlie (35, true), Diana (28, true) all pass
    expect(rows).toHaveLength(3);
  });

  it("should return no rows if none match", () => {
    const scan = new Scan("users", columns, data);
    // WHERE age > 100
    const filter = new Filter(scan, binary(">", col("age"), literal(100, "INTEGER")));

    const rows = collectRows(filter);
    expect(rows).toHaveLength(0);
  });

  it("should preserve column schema", () => {
    const scan = new Scan("users", columns, data);
    const filter = new Filter(scan, binary(">", col("age"), literal(0, "INTEGER")));

    filter.open();
    expect(filter.getColumns()).toEqual(columns);
    filter.close();
  });
});

// =============================================================================
// Project Tests
// =============================================================================

describe("Project", () => {
  const columns = ["id", "name", "price", "quantity"];
  const data: Value[][] = [
    [integer(1), text("Widget"), real(10.0), integer(5)],
    [integer(2), text("Gadget"), real(25.0), integer(3)],
  ];

  it("should project specific columns", () => {
    const scan = new Scan("products", columns, data);
    const selectCols: SelectColumn[] = [
      { type: "Expression", expression: col("name") },
      { type: "Expression", expression: col("price") },
    ];
    const project = new Project(scan, selectCols);

    const rows = collectRows(project);
    expect(rows).toHaveLength(2);
    expect(rows[0].columns).toEqual(["name", "price"]);
    expect(rows[0].values).toEqual([text("Widget"), real(10.0)]);
  });

  it("should handle SELECT *", () => {
    const scan = new Scan("products", columns, data);
    const selectCols: SelectColumn[] = [{ type: "AllColumns" }];
    const project = new Project(scan, selectCols);

    const rows = collectRows(project);
    expect(rows).toHaveLength(2);
    expect(rows[0].columns).toEqual(columns);
    expect(rows[0].values).toEqual(data[0]);
  });

  it("should compute expressions", () => {
    const scan = new Scan("products", columns, data);
    // SELECT price * quantity AS total
    const selectCols: SelectColumn[] = [
      {
        type: "Expression",
        expression: binary("*", col("price"), col("quantity")),
        alias: "total",
      },
    ];
    const project = new Project(scan, selectCols);

    const rows = collectRows(project);
    expect(rows).toHaveLength(2);
    expect(rows[0].columns).toEqual(["total"]);
    expect(rows[0].values[0]).toEqual(real(50.0)); // 10.0 * 5
    expect(rows[1].values[0]).toEqual(real(75.0)); // 25.0 * 3
  });

  it("should mix columns and expressions", () => {
    const scan = new Scan("products", columns, data);
    // SELECT name, price * 1.1 AS new_price
    const selectCols: SelectColumn[] = [
      { type: "Expression", expression: col("name") },
      {
        type: "Expression",
        expression: binary("*", col("price"), literal(1.1, "REAL")),
        alias: "new_price",
      },
    ];
    const project = new Project(scan, selectCols);

    const rows = collectRows(project);
    expect(rows[0].columns).toEqual(["name", "new_price"]);
    expect(rows[0].values[0]).toEqual(text("Widget"));
    expect((rows[0].values[1] as { value: number }).value).toBeCloseTo(11.0);
  });

  it("should generate column name for expressions without alias", () => {
    const scan = new Scan("products", columns, data);
    // SELECT price + 5 (no alias)
    const selectCols: SelectColumn[] = [
      {
        type: "Expression",
        expression: binary("+", col("price"), literal(5, "REAL")),
      },
    ];
    const project = new Project(scan, selectCols);

    project.open();
    const cols = project.getColumns();
    expect(cols[0]).toMatch(/^expr_/);
    project.close();
  });
});

// =============================================================================
// Limit Tests
// =============================================================================

describe("Limit", () => {
  const columns = ["id", "name"];
  const data: Value[][] = [
    [integer(1), text("Alice")],
    [integer(2), text("Bob")],
    [integer(3), text("Charlie")],
    [integer(4), text("Diana")],
    [integer(5), text("Eve")],
  ];

  it("should limit number of rows", () => {
    const scan = new Scan("users", columns, data);
    const limit = new Limit(scan, 3);

    const rows = collectRows(limit);
    expect(rows).toHaveLength(3);
    expect(getColumnValue(rows[0], "name")).toEqual(text("Alice"));
    expect(getColumnValue(rows[2], "name")).toEqual(text("Charlie"));
  });

  it("should handle limit greater than row count", () => {
    const scan = new Scan("users", columns, data);
    const limit = new Limit(scan, 100);

    const rows = collectRows(limit);
    expect(rows).toHaveLength(5);
  });

  it("should handle limit of 0", () => {
    const scan = new Scan("users", columns, data);
    const limit = new Limit(scan, 0);

    const rows = collectRows(limit);
    expect(rows).toHaveLength(0);
  });

  it("should preserve column schema", () => {
    const scan = new Scan("users", columns, data);
    const limit = new Limit(scan, 2);

    limit.open();
    expect(limit.getColumns()).toEqual(columns);
    limit.close();
  });
});

// =============================================================================
// Sort Tests
// =============================================================================

describe("Sort", () => {
  const columns = ["id", "name", "age", "score"];
  const data: Value[][] = [
    [integer(1), text("Charlie"), integer(30), real(85.5)],
    [integer(2), text("Alice"), integer(25), real(92.0)],
    [integer(3), text("Bob"), integer(35), real(78.0)],
    [integer(4), text("Diana"), integer(25), real(88.0)],
  ];

  it("should sort by single column ASC", () => {
    const scan = new Scan("users", columns, data);
    const orderBy: OrderByItem[] = [
      { expression: col("name"), direction: "ASC" },
    ];
    const sort = new Sort(scan, orderBy);

    const rows = collectRows(sort);
    expect(rows.map((r) => getColumnValue(r, "name"))).toEqual([
      text("Alice"),
      text("Bob"),
      text("Charlie"),
      text("Diana"),
    ]);
  });

  it("should sort by single column DESC", () => {
    const scan = new Scan("users", columns, data);
    const orderBy: OrderByItem[] = [
      { expression: col("age"), direction: "DESC" },
    ];
    const sort = new Sort(scan, orderBy);

    const rows = collectRows(sort);
    expect(rows.map((r) => getColumnValue(r, "age"))).toEqual([
      integer(35), // Bob
      integer(30), // Charlie
      integer(25), // Alice or Diana (same age)
      integer(25), // Alice or Diana
    ]);
  });

  it("should sort by multiple columns", () => {
    const scan = new Scan("users", columns, data);
    // ORDER BY age ASC, score DESC
    const orderBy: OrderByItem[] = [
      { expression: col("age"), direction: "ASC" },
      { expression: col("score"), direction: "DESC" },
    ];
    const sort = new Sort(scan, orderBy);

    const rows = collectRows(sort);
    // Age 25: Alice (92.0) before Diana (88.0) because score DESC
    // Age 30: Charlie
    // Age 35: Bob
    expect(rows.map((r) => getColumnValue(r, "name"))).toEqual([
      text("Alice"),  // age 25, score 92.0
      text("Diana"),  // age 25, score 88.0
      text("Charlie"), // age 30
      text("Bob"),    // age 35
    ]);
  });

  it("should handle numeric sorting correctly", () => {
    const scan = new Scan("users", columns, data);
    const orderBy: OrderByItem[] = [
      { expression: col("score"), direction: "ASC" },
    ];
    const sort = new Sort(scan, orderBy);

    const rows = collectRows(sort);
    expect(rows.map((r) => getColumnValue(r, "score"))).toEqual([
      real(78.0),  // Bob
      real(85.5),  // Charlie
      real(88.0),  // Diana
      real(92.0),  // Alice
    ]);
  });

  it("should preserve column schema", () => {
    const scan = new Scan("users", columns, data);
    const orderBy: OrderByItem[] = [
      { expression: col("name"), direction: "ASC" },
    ];
    const sort = new Sort(scan, orderBy);

    sort.open();
    expect(sort.getColumns()).toEqual(columns);
    sort.close();
  });

  it("should handle empty input", () => {
    const scan = new Scan("empty", columns, []);
    const orderBy: OrderByItem[] = [
      { expression: col("name"), direction: "ASC" },
    ];
    const sort = new Sort(scan, orderBy);

    const rows = collectRows(sort);
    expect(rows).toHaveLength(0);
  });
});

describe("Sort with NULL", () => {
  const columns = ["id", "name", "age"];
  const data: Value[][] = [
    [integer(1), text("Alice"), integer(30)],
    [integer(2), text("Bob"), NULL],
    [integer(3), text("Charlie"), integer(25)],
    [integer(4), text("Diana"), NULL],
  ];

  it("should sort NULLs last for ASC", () => {
    const scan = new Scan("users", columns, data);
    const orderBy: OrderByItem[] = [
      { expression: col("age"), direction: "ASC" },
    ];
    const sort = new Sort(scan, orderBy);

    const rows = collectRows(sort);
    // Non-NULL values first (sorted), then NULLs
    expect(rows.map((r) => getColumnValue(r, "name"))).toEqual([
      text("Charlie"), // age 25
      text("Alice"),   // age 30
      text("Bob"),     // age NULL
      text("Diana"),   // age NULL
    ]);
  });

  it("should sort NULLs first for DESC", () => {
    const scan = new Scan("users", columns, data);
    const orderBy: OrderByItem[] = [
      { expression: col("age"), direction: "DESC" },
    ];
    const sort = new Sort(scan, orderBy);

    const rows = collectRows(sort);
    // NULLs first, then non-NULL values (sorted DESC)
    expect(rows.map((r) => getColumnValue(r, "name"))).toEqual([
      text("Bob"),     // age NULL
      text("Diana"),   // age NULL
      text("Alice"),   // age 30
      text("Charlie"), // age 25
    ]);
  });
});

// =============================================================================
// Operator Composition Tests
// =============================================================================

describe("Operator Composition", () => {
  const columns = ["id", "name", "price", "quantity", "active"];
  const data: Value[][] = [
    [integer(1), text("Widget"), real(10.0), integer(5), boolean(true)],
    [integer(2), text("Gadget"), real(25.0), integer(3), boolean(true)],
    [integer(3), text("Gizmo"), real(15.0), integer(0), boolean(false)],
    [integer(4), text("Thing"), real(30.0), integer(10), boolean(true)],
  ];

  it("should compose Scan -> Filter -> Project", () => {
    // SELECT name, price FROM products WHERE active = TRUE
    const scan = new Scan("products", columns, data);
    const filter = new Filter(
      scan,
      binary("=", col("active"), literal(true, "BOOLEAN"))
    );
    const project = new Project(filter, [
      { type: "Expression", expression: col("name") },
      { type: "Expression", expression: col("price") },
    ]);

    const rows = collectRows(project);
    expect(rows).toHaveLength(3);
    expect(rows[0].columns).toEqual(["name", "price"]);
    expect(rows[0].values).toEqual([text("Widget"), real(10.0)]);
  });

  it("should compose Scan -> Filter -> Project -> Limit", () => {
    // SELECT name FROM products WHERE price > 10 LIMIT 2
    const scan = new Scan("products", columns, data);
    const filter = new Filter(scan, binary(">", col("price"), literal(10, "REAL")));
    const project = new Project(filter, [
      { type: "Expression", expression: col("name") },
    ]);
    const limit = new Limit(project, 2);

    const rows = collectRows(limit);
    expect(rows).toHaveLength(2);
    expect(rows[0].values).toEqual([text("Gadget")]); // price 25
    expect(rows[1].values).toEqual([text("Gizmo")]); // price 15
  });

  it("should handle complex query with computed columns", () => {
    // SELECT name, price * quantity AS total
    // FROM products
    // WHERE quantity > 0 AND active = TRUE
    // LIMIT 2
    const scan = new Scan("products", columns, data);
    const filter = new Filter(
      scan,
      binary(
        "AND",
        binary(">", col("quantity"), literal(0, "INTEGER")),
        binary("=", col("active"), literal(true, "BOOLEAN"))
      )
    );
    const project = new Project(filter, [
      { type: "Expression", expression: col("name") },
      {
        type: "Expression",
        expression: binary("*", col("price"), col("quantity")),
        alias: "total",
      },
    ]);
    const limit = new Limit(project, 2);

    const rows = collectRows(limit);
    expect(rows).toHaveLength(2);
    expect(rows[0].columns).toEqual(["name", "total"]);
    expect(rows[0].values).toEqual([text("Widget"), real(50.0)]); // 10 * 5
    expect(rows[1].values).toEqual([text("Gadget"), real(75.0)]); // 25 * 3
  });
});

// =============================================================================
// NULL Handling Tests
// =============================================================================

describe("NULL Handling in Operators", () => {
  const columns = ["id", "name", "age"];
  const data: Value[][] = [
    [integer(1), text("Alice"), integer(30)],
    [integer(2), text("Bob"), NULL],
    [integer(3), NULL, integer(25)],
  ];

  it("should filter out rows where predicate evaluates to NULL", () => {
    const scan = new Scan("users", columns, data);
    // WHERE age > 20 (Bob's NULL age means predicate is NULL, filtered out)
    const filter = new Filter(scan, binary(">", col("age"), literal(20, "INTEGER")));

    const rows = collectRows(filter);
    expect(rows).toHaveLength(2);
    expect(getColumnValue(rows[0], "name")).toEqual(text("Alice"));
    expect(getColumnValue(rows[1], "name")).toEqual(NULL); // id=3, name is NULL
  });

  it("should preserve NULL values in projections", () => {
    const scan = new Scan("users", columns, data);
    const project = new Project(scan, [
      { type: "Expression", expression: col("name") },
    ]);

    const rows = collectRows(project);
    expect(rows).toHaveLength(3);
    expect(rows[2].values[0]).toEqual(NULL);
  });
});
