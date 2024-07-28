# Reviewer lib

An automated code review tool that uses OpenAI to analyze and provide 
recommendations for code improvement and commenting in PR when received message from AI.

## Installation
```bash
npm install reviewer-lib
```

## API
new Reviewer(apiKey, model, maxTokens). Creates a new Reviewer instance.
1. Params:
- apiKey (String): Your OpenAI API key.
- model (String): The model you want to use (default 'gpt-3.5-turbo').
- maxTokens (Number): The maximum number of tokens for the response (default 150).
- code (String): The code to analyze. Returns Promise<String>: Suggestions for improving the code.
2. Methods:
- submitCode(code): Function, analyzes and provides recommendations for improving the code. Use '/engines/${model}/completions' endpoint.
- submitCodeAssistanceMode(code): Function, analyzes and provides recommendations for improving the code. Use 'client.completions.create' instance method.
- getCurrentModels: Function, gets list of available AI models.
## Usage
```
import { Reviewer} from 'reviewer-lib';

const reviewer = new Reviewer(apiKey); // OpenAI apikey
const code = `
function exampleFunction(x, y) {
  let result = x + y;
  return result;
}
`;

reviewer.submitCode(code)
   .then((feedback: string) => {
      console.log('Code Review Feedback:');
      console.log(feedback);
   })
   .catch((error: Error | string) => {
      console.error('Error:', error);
   });
```

in CI/CD:
1. Create file and set up instance. `./review.js`
```
import { Reviewer} from 'reviewer-lib';

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error('Error: OPENAI_API_KEY is not set');
  process.exit(1);
}

const reviewer = new Reviewer(apiKey);
let code = '';

process.stdin.on('data', chunk => {
  code += chunk;
});
process.stdin.on('end', () => {
  reviewer.submitCode(code)
    .then((feedback: string) => {
      console.log('Code Review Feedback:');
      console.log(feedback);
    })
    .catch((error: Error | string) => {
      console.error('Error:', error);
      process.exit(1);
    });
});
```
2. Create workflow. `.github/workflows/code-review.yml`
```
name: Code Review with ChatGPT

on:
  pull_request:
    branches:
      - master

jobs:
  review:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v2
        with:
          fetch-depth: 2

      - name: Install jq
        run: sudo apt-get install -y jq

      - name: Set up Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      - name: Get diff from PR
        id: diff
        run: |
          git fetch origin
          git diff origin/master HEAD > pr.diff

      - name: Run code review
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
        run: |
          npm run build
          node ./review.js < pr.diff > review_feedback.txt

      - name: Post review feedback as a comment
        env:
          GITHUB_TOKEN: ${{ secrets.API_GITHUB_TOKEN }}
        run: |
          REVIEW_FEEDBACK=$(cat review_feedback.txt)
          COMMENT_BODY=$(jq -n --arg body "$REVIEW_FEEDBACK" '{body: $body}')
          PULL_REQUEST_NUMBER=${{ github.event.pull_request.number }}
          curl -s -H "Authorization: token $GITHUB_TOKEN" -X POST -d "$COMMENT_BODY" \
            "https://api.github.com/repos/${{ github.repository }}/issues/$PULL_REQUEST_NUMBER/comments"

```
3. Push code. Pipeline should create a job and comment the PR

[//]: # (## Contributing)

[//]: # (```)

[//]: # (# Clone the repository)

[//]: # (git clone https://github.com/your-username/ai-code-reviewer.git)

[//]: # ()
[//]: # (# Install dependencies)

[//]: # (npm install)

[//]: # ()
[//]: # (# Create a new branch)

[//]: # (git checkout -b feature/your-feature)

[//]: # ()
[//]: # (# Send a pull request)

[//]: # (git push origin feature/your-feature)
```