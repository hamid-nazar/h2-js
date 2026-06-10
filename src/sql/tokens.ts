/**
 * Token types for the SQL lexer.
 *
 * Tokens are the atomic units of the language - the "words" that the parser works with.
 */

/**
 * All possible token kinds in our SQL dialect.
 */
export enum TokenKind {
  // === Keywords ===
  // Data Definition
  CREATE = "CREATE",
  DROP = "DROP",
  TABLE = "TABLE",
  PRIMARY = "PRIMARY",
  KEY = "KEY",

  // Data Manipulation
  SELECT = "SELECT",
  FROM = "FROM",
  WHERE = "WHERE",
  INSERT = "INSERT",
  INTO = "INTO",
  VALUES = "VALUES",
  UPDATE = "UPDATE",
  SET = "SET",
  DELETE = "DELETE",

  // Clauses
  ORDER = "ORDER",
  BY = "BY",
  ASC = "ASC",
  DESC = "DESC",
  LIMIT = "LIMIT",

  // Logical operators
  AND = "AND",
  OR = "OR",
  NOT = "NOT",

  // Transactions
  BEGIN = "BEGIN",
  COMMIT = "COMMIT",
  ROLLBACK = "ROLLBACK",

  // Types
  INTEGER = "INTEGER",
  TEXT = "TEXT",
  BOOLEAN = "BOOLEAN",
  REAL = "REAL",

  // Literals
  TRUE = "TRUE",
  FALSE = "FALSE",
  NULL = "NULL",

  // === Identifiers and Literals ===
  IDENTIFIER = "IDENTIFIER", // Column names, table names
  INTEGER_LITERAL = "INTEGER_LITERAL", // 42
  REAL_LITERAL = "REAL_LITERAL", // 3.14
  STRING_LITERAL = "STRING_LITERAL", // 'hello'

  // === Operators ===
  // Comparison
  EQUALS = "EQUALS", // =
  NOT_EQUALS = "NOT_EQUALS", // <> or !=
  LESS_THAN = "LESS_THAN", // <
  GREATER_THAN = "GREATER_THAN", // >
  LESS_THAN_OR_EQUAL = "LESS_THAN_OR_EQUAL", // <=
  GREATER_THAN_OR_EQUAL = "GREATER_THAN_OR_EQUAL", // >=

  // Arithmetic
  PLUS = "PLUS", // +
  MINUS = "MINUS", // -
  STAR = "STAR", // *
  SLASH = "SLASH", // /

  // === Punctuation ===
  LPAREN = "LPAREN", // (
  RPAREN = "RPAREN", // )
  COMMA = "COMMA", // ,
  SEMICOLON = "SEMICOLON", // ;

  // === Special ===
  EOF = "EOF", // End of input
}

/**
 * A token produced by the lexer.
 *
 * Contains the token kind, the original text (lexeme), and source position
 * for error reporting.
 */
export interface Token {
  /** What kind of token this is */
  kind: TokenKind;

  /** The original text that produced this token */
  lexeme: string;

  /** Line number (1-indexed) */
  line: number;

  /** Column number (1-indexed) */
  column: number;
}

/**
 * Reserved keywords mapped to their token kinds.
 *
 * When the lexer encounters an identifier, it checks this map to see
 * if it's actually a reserved keyword.
 */
export const KEYWORDS: ReadonlyMap<string, TokenKind> = new Map([
  // Data Definition
  ["CREATE", TokenKind.CREATE],
  ["DROP", TokenKind.DROP],
  ["TABLE", TokenKind.TABLE],
  ["PRIMARY", TokenKind.PRIMARY],
  ["KEY", TokenKind.KEY],

  // Data Manipulation
  ["SELECT", TokenKind.SELECT],
  ["FROM", TokenKind.FROM],
  ["WHERE", TokenKind.WHERE],
  ["INSERT", TokenKind.INSERT],
  ["INTO", TokenKind.INTO],
  ["VALUES", TokenKind.VALUES],
  ["UPDATE", TokenKind.UPDATE],
  ["SET", TokenKind.SET],
  ["DELETE", TokenKind.DELETE],

  // Clauses
  ["ORDER", TokenKind.ORDER],
  ["BY", TokenKind.BY],
  ["ASC", TokenKind.ASC],
  ["DESC", TokenKind.DESC],
  ["LIMIT", TokenKind.LIMIT],

  // Logical operators
  ["AND", TokenKind.AND],
  ["OR", TokenKind.OR],
  ["NOT", TokenKind.NOT],

  // Transactions
  ["BEGIN", TokenKind.BEGIN],
  ["COMMIT", TokenKind.COMMIT],
  ["ROLLBACK", TokenKind.ROLLBACK],

  // Types
  ["INTEGER", TokenKind.INTEGER],
  ["TEXT", TokenKind.TEXT],
  ["BOOLEAN", TokenKind.BOOLEAN],
  ["REAL", TokenKind.REAL],

  // Boolean literals
  ["TRUE", TokenKind.TRUE],
  ["FALSE", TokenKind.FALSE],
  ["NULL", TokenKind.NULL],
]);

/**
 * Helper to create a token.
 */
export function createToken(
  kind: TokenKind,
  lexeme: string,
  line: number,
  column: number
): Token {
  return { kind, lexeme, line, column };
}
