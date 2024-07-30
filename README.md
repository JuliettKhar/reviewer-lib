# Reviewer lib
An automated code review tool that uses OpenAI to analyze and provide 
recommendations for code improvement and commenting in PR when received message from AI.

[//]: # (![Build Status]&#40;https://img.shields.io/github/actions/workflow/status/JuliettKhar/reviewer-lib/ci.yml&#41;)
[//]: # (![Coverage]&#40;https://img.shields.io/codecov/c/github/JuliettKhar/reviewer-lib&#41;)
[//]: # (![Downloads]&#40;https://img.shields.io/npm/dt/reviewer-lib&#41;)
[//]: # (![Forks]&#40;https://img.shields.io/github/forks/JuliettKhar/reviewer-lib&#41;)
[//]: # (![Stars]&#40;https://img.shields.io/github/stars/JuliettKhar/reviewer-lib&#41;)
![Dependencies](https://img.shields.io/librariesio/release/npm/reviewer-lib)
![NPM Version](https://img.shields.io/npm/v/reviewer-lib)
![Minified Size](https://img.shields.io/bundlephobia/min/reviewer-lib)
![Open Issues](https://img.shields.io/github/issues/JuliettKhar/reviewer-lib)

 

## Installation
```shell
npm install reviewer-lib
```
## Usage
Notes: Cheaper models give a lower quality result (Davinci, Curie, Ada, Babbage).
To use less expensive models, OpenAI API requests should be directed to instance.submitCode.
- [OpenAI prices](https://openai.com/api/pricing/)
- [OpenAI model's deprecations](https://platform.openai.com/docs/deprecations)
```typescript
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
```typescript
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
```yaml
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
3. Push code. Pipeline should create a job and comment the PR.

## API
`new Reviewer(apiKey, model, maxTokens)`. Creates a new Reviewer instance.
1. Params:
- apiKey (String): Your OpenAI API key.
- model (String): The model you want to use (default 'gpt-3.5-turbo' changed in 1.1.0 on davinchi-002).
- maxTokens (Number): The maximum number of tokens for the response (default 150).
- code (String): The code to analyze. Returns Promise<String>: Suggestions for improving the code.
2. Methods:
- `submitCode(code: string)`: Function, analyzes and provides recommendations for improving the code. Use '/engines/${model}/completions' endpoint.
```typescript
reviewer.submitCode(code).then(suggestions => {
  console.log('Review Suggestions:', suggestions);
});
```
- `generateDocumentation(code: string)`: A function that automatically generates comments or documentation for code.
```typescript
reviewer.generateDocumentation(code).then(suggestions => {
  console.log('Generated Documentation:', suggestions);
});
```
- `optimizeCode(code: string)`: A function for suggesting optimizations in code in terms of performance and readability.
```typescript
reviewer.optimizeCode(code).then(suggestions => {
  console.log('Optimize Suggestions:', suggestions);
});
```
- `generateTests(code: string)`: Function for automatic test generation based on provided code.
```typescript
reviewer.generateTests(code).then(suggestions => {
  console.log('Tests Suggestions:', suggestions);
});
```
- `securityAnalysis(code: string)`: A function that checks code for potential vulnerabilities and suggests solutions.
```typescript
reviewer.securityAnalysis(code).then(suggestions => {
  console.log('Security Suggestions:', suggestions);
});
```
- `codeStyleRecommendations(code: string)`: Add a feature that provides recommendations for improving code style by following established style guides.
```typescript
reviewer.codeStyleRecommendations(code).then(suggestions => {
  console.log('Code style Suggestions:', suggestions);
});
```
- `historicalAnalysis(repoPath: string)`: A feature that analyzes the history of code changes and makes recommendations for improvements based on past changes.
```typescript
reviewer.historicalAnalysis(code).then(suggestions => {
  console.log('Historical overview:', suggestions);
});
```
Other Functions
- `submitCodeAssistanceMode(code: string)`: Function, analyzes and provides recommendations for improving the code. Use 'client.completions.create' instance method. (For more expensive models)
- `getCurrentModels`: Function, gets list of available AI models.

### Contributing

```shell

# Clone the repository

git clone https://github.com/JuliettKhar/reviewer-lib.git


# Install dependencies

npm install


# Create a new branch

git checkout -b f/your-feature


# Send a pull request

git push origin f/your-feature
