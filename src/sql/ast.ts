/**
 * Abstract Syntax Tree (AST) node definitions for SQL statements.
 *
 * The AST represents the structure of SQL statements as a tree of typed nodes.
 * Each statement type is a discriminated union variant with a unique `type` field,
 * enabling exhaustive pattern matching in TypeScript.
 */

// =============================================================================
// Data Types
// =============================================================================

/**
 * SQL data types supported by our database.
 */
export type DataType = "INTEGER" | "TEXT" | "BOOLEAN" | "REAL";

/**
 * A column definition in a CREATE TABLE statement.
 */
export interface ColumnDefinition {
  name: string;
  dataType: DataType;
}

// =============================================================================
// Expressions (placeholder - will be expanded in TASK-014)
// =============================================================================

/**
 * Expressions represent values or computations.
 * This is a placeholder that will be expanded in TASK-014.
 */
export type Expression =
  | LiteralExpression
  | ColumnRefExpression
  | BinaryExpression
  | UnaryExpression;

/**
 * A literal value: 42, 'hello', TRUE, NULL
 */
export interface LiteralExpression {
  type: "Literal";
  value: string | number | boolean | null;
  dataType: DataType | "NULL";
}

/**
 * A reference to a column: name, users.id
 */
export interface ColumnRefExpression {
  type: "ColumnRef";
  table?: string; // Optional table qualifier
  column: string;
}

/**
 * A binary operation: age > 21, a + b, name = 'Alice'
 */
export interface BinaryExpression {
  type: "Binary";
  operator: BinaryOperator;
  left: Expression;
  right: Expression;
}

export type BinaryOperator =
  // Comparison
  | "="
  | "<>"
  | "<"
  | ">"
  | "<="
  | ">="
  // Arithmetic
  | "+"
  | "-"
  | "*"
  | "/"
  // Logical
  | "AND"
  | "OR";

/**
 * A unary operation: NOT active, -price
 */
export interface UnaryExpression {
  type: "Unary";
  operator: UnaryOperator;
  operand: Expression;
}

export type UnaryOperator = "NOT" | "-";

// =============================================================================
// SELECT Statement
// =============================================================================

/**
 * Represents what to select: specific columns or * (all columns).
 */
export type SelectColumn =
  | { type: "AllColumns" } // SELECT *
  | { type: "Expression"; expression: Expression; alias?: string }; // SELECT name, age AS years

/**
 * ORDER BY clause item.
 */
export interface OrderByItem {
  expression: Expression;
  direction: "ASC" | "DESC";
}

/**
 * SELECT columns FROM table [WHERE condition] [ORDER BY ...] [LIMIT n]
 */
export interface SelectStatement {
  type: "SelectStatement";
  columns: SelectColumn[];
  from: string; // Table name (will expand to support joins later)
  where?: Expression;
  orderBy?: OrderByItem[];
  limit?: number;
}

// =============================================================================
// INSERT Statement
// =============================================================================

/**
 * INSERT INTO table (columns...) VALUES (values...)
 */
export interface InsertStatement {
  type: "InsertStatement";
  table: string;
  columns: string[];
  values: Expression[];
}

// =============================================================================
// UPDATE Statement
// =============================================================================

/**
 * A single column assignment: column = value
 */
export interface Assignment {
  column: string;
  value: Expression;
}

/**
 * UPDATE table SET assignments [WHERE condition]
 */
export interface UpdateStatement {
  type: "UpdateStatement";
  table: string;
  assignments: Assignment[];
  where?: Expression;
}

// =============================================================================
// DELETE Statement
// =============================================================================

/**
 * DELETE FROM table [WHERE condition]
 */
export interface DeleteStatement {
  type: "DeleteStatement";
  table: string;
  where?: Expression;
}

// =============================================================================
// CREATE TABLE Statement
// =============================================================================

/**
 * CREATE TABLE name (column definitions...)
 */
export interface CreateTableStatement {
  type: "CreateTableStatement";
  table: string;
  columns: ColumnDefinition[];
}

// =============================================================================
// DROP TABLE Statement
// =============================================================================

/**
 * DROP TABLE name
 */
export interface DropTableStatement {
  type: "DropTableStatement";
  table: string;
}

// =============================================================================
// Transaction Statements
// =============================================================================

/**
 * BEGIN - Start a transaction
 */
export interface BeginStatement {
  type: "BeginStatement";
}

/**
 * COMMIT - Commit the current transaction
 */
export interface CommitStatement {
  type: "CommitStatement";
}

/**
 * ROLLBACK - Rollback the current transaction
 */
export interface RollbackStatement {
  type: "RollbackStatement";
}

// =============================================================================
// Statement Union
// =============================================================================

/**
 * All possible SQL statements as a discriminated union.
 *
 * The `type` field is the discriminant - TypeScript uses it to narrow
 * the type in switch statements and conditionals.
 *
 * @example
 * function execute(stmt: Statement) {
 *   switch (stmt.type) {
 *     case "SelectStatement":
 *       // TypeScript knows stmt has columns, from, where, etc.
 *       break;
 *     case "InsertStatement":
 *       // TypeScript knows stmt has table, columns, values
 *       break;
 *   }
 * }
 */
export type Statement =
  | SelectStatement
  | InsertStatement
  | UpdateStatement
  | DeleteStatement
  | CreateTableStatement
  | DropTableStatement
  | BeginStatement
  | CommitStatement
  | RollbackStatement;
