# H2-JS

[![CI](https://github.com/hamid-nazar/h2-js/actions/workflows/ci.yml/badge.svg)](https://github.com/hamid-nazar/h2-js/actions/workflows/ci.yml)

A reimplementation of the H2 database engine in TypeScript, built for learning database internals.

## What is this?

This is a **learning project** focused on understanding how relational databases work under the hood. We build an embedded SQL database from scratch, covering:

- **SQL parsing** — Lexing and tokenization
- **Abstract Syntax Trees (AST)** — Representing SQL as a tree structure for analysis and execution
- **Query execution** — The volcano/iterator execution model
- **Storage** — Paged file I/O and slotted-page layout
- **Indexing** — B+ tree implementation
- **Transactions** — ACID properties, locking, and MVCC
- **Recovery** — Write-ahead logging and crash recovery

### What is an AST?

An **Abstract Syntax Tree** is a tree representation of source code (in our case, SQL). Each node represents a construct in the language:

```
SELECT name, age FROM users WHERE age > 21
                    ↓
            ┌───────────────┐
            │  SelectStmt   │
            └───────┬───────┘
       ┌────────────┼────────────┐
       ▼            ▼            ▼
   ┌───────┐   ┌────────┐   ┌─────────┐
   │Columns│   │  From  │   │  Where  │
   │name,  │   │ users  │   │  age>21 │
   │age    │   │        │   │         │
   └───────┘   └────────┘   └─────────┘
```

The AST lets us separate **parsing** (understanding the SQL syntax) from **execution** (running the query). This separation is a fundamental pattern in compilers and interpreters.

## Supported SQL

A minimal but complete subset:

```sql
-- Data Definition
CREATE TABLE name (col1 TYPE, col2 TYPE, ...)
DROP TABLE name

-- Data Manipulation
INSERT INTO table (cols...) VALUES (vals...)
SELECT cols FROM table [WHERE condition] [ORDER BY col] [LIMIT n]
UPDATE table SET col = val [WHERE condition]
DELETE FROM table [WHERE condition]

-- Transactions
BEGIN
COMMIT
ROLLBACK
```

**Supported types:** `INTEGER`, `TEXT`, `BOOLEAN`, `REAL`

## Architecture

The engine is a layered stack. SQL enters at the top and becomes bytes on disk at the bottom:

```
┌─────────────────────────────────────┐
│            SQL String               │
└──────────────────┬──────────────────┘
                   ▼
┌─────────────────────────────────────┐
│   src/sql/        Lexer & Parser    │  Tokenize and build AST
└──────────────────┬──────────────────┘
                   ▼
┌─────────────────────────────────────┐
│   src/planner/   Query Planner      │  Optimize and create execution plan
└──────────────────┬──────────────────┘
                   ▼
┌─────────────────────────────────────┐
│   src/executor/  Execution Engine   │  Volcano-model operators
└──────────────────┬──────────────────┘
                   ▼
┌─────────────────────────────────────┐
│   src/transaction/ Transaction Mgr  │  Isolation, locking, MVCC
└──────────────────┬──────────────────┘
                   ▼
┌─────────────────────────────────────┐
│   src/storage/   Storage Engine     │  B+ tree, buffer pool, pager
└──────────────────┬──────────────────┘
                   ▼
┌─────────────────────────────────────┐
│   src/recovery/  Recovery Manager   │  WAL, checkpoints
└──────────────────┬──────────────────┘
                   ▼
┌─────────────────────────────────────┐
│              Disk File              │
└─────────────────────────────────────┘
```

### Layer Descriptions

| Directory | Purpose |
|-----------|---------|
| `src/sql/` | Lexer, parser, and AST definitions |
| `src/planner/` | Query planning, cost model, optimizer rules |
| `src/executor/` | Iterator operators and expression evaluator |
| `src/types/` | Runtime value types and serialization |
| `src/transaction/` | Transaction manager, isolation levels, MVCC |
| `src/storage/` | Pager, slotted pages, B+ tree, buffer pool |
| `src/recovery/` | Write-ahead log, checkpointing, crash recovery |
| `src/catalog/` | System catalog (schema, table, column metadata) |
| `src/api/` | Client-facing API (Connection, Statement, ResultSet) |
| `src/cli/` | Interactive SQL REPL |
| `src/shared/` | Utilities, error types, constants |

## Getting Started

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Start the SQL REPL
npm run repl
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Build and run the SQL REPL |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run watch` | Watch mode for TypeScript |
| `npm run repl` | Start the interactive SQL shell |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Auto-fix lint issues |
| `npm run format` | Format with Prettier |
| `npm run test` | Run all tests |
| `npm run clean` | Remove `dist/` and scratch database files |

## Database Files

The database stores everything in a single file (default: `./data/scratch.db`). This file contains table data, indexes, and the transaction log.
