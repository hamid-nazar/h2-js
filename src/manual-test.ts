import { Lexer } from "./sql/lexer.js";


const lexer = new Lexer("SELECT * FROM users");

const tokens = lexer.tokenize()
console.log(tokens)