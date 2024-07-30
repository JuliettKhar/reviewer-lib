// @ts-ignore
import {Reviewer} from '../dist';

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
    console.error('Error: OPENAI_API_KEY is not set');
    process.exit(1);
}

const reviewer = new Reviewer(apiKey);
let code = `
function exampleFunction(x, y) {
  let result = x + y;
  return result;
}
`;

reviewer.submitCode(code)
    .then((feedback: string | undefined) => {
        console.log('Code Review Feedback:', feedback);
        return feedback;
    })
    .catch((error: Error | string) => {
        console.error('Error:', error);
        process.exit(1);
    });