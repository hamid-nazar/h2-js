import { executeSelect, TableStore } from "./executor/index.js";
import { Parser, SelectStatement } from "./sql/index.js";
import { Lexer } from "./sql/lexer.js";
import { boolean, integer, text } from "./types/index.js";


const store = new TableStore();

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




const lexer = new Lexer("SELECT * FROM users");

const tokens = lexer.tokenize()
console.log(tokens)

const parser = new Parser(tokens);
const statement = parser.parse();

console.log(statement)

const result = executeSelect(statement as SelectStatement, store);

console.log(result);