"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var dist_1 = require("../dist");
var apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
    console.error('Error: OPENAI_API_KEY is not set');
    process.exit(1);
}
var reviewer = new dist_1.Reviewer(apiKey);
var code = "\nfunction exampleFunction(x, y) {\n  let result = x + y;\n  return result;\n}\n";
reviewer.submitCode(code)
    .then(function (feedback) {
    console.log('Code Review Feedback:', feedback);
    return feedback;
})
    .catch(function (error) {
    console.error('Error:', error);
    process.exit(1);
});
