"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-ignore
const dist_1 = require("../dist");
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
    console.error('Error: OPENAI_API_KEY is not set');
    process.exit(1);
}
const reviewer = new dist_1.Reviewer(apiKey);
let code = '';
process.stdin.on('data', () => {
    code += `
function exampleFunction(x, y) {
  let result = x + y;
  return result;
}
`;
    console.info(process.env.OPENAI_API_KEY);
});
process.stdin.on('end', () => {
    reviewer.submitCode(code)
        .then((feedback) => {
        console.log('Code Review Feedback:', feedback);
    })
        .catch((error) => {
        console.error('Error:', error);
        process.exit(1);
    });
});
