"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Reviewer = void 0;
// https://platform.openai.com/docs/deprecations
const openai_1 = __importDefault(require("openai"));
const child_process_1 = require("child_process");
class Reviewer {
    constructor(apiKey, model = 'davinci-002', maxTokens = 150) {
        this.apiKey = apiKey;
        this.model = model;
        this.maxTokens = maxTokens;
        this.client = new openai_1.default({
            apiKey: this.apiKey,
        });
    }
    submitCode(code) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const response = yield this.client.post(`/engines/${this.model}/completions`, {
                    body: {
                        prompt: `Review the part of code:\n\n${code}\n\nProvide feedback how this part of code can be improved from optimal perspective:`,
                        max_tokens: this.maxTokens,
                    },
                });
                return response.choices[0].text;
            }
            catch (error) {
                console.info('Request available models by getCurrentModels()');
                throw new Error(`OpenAI API error: ${error.message}`);
            }
        });
    }
    submitCodeAssistanceMode(code) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const response = yield this.client.completions.create({
                    prompt: `Review the part of code:\n\n${code}\n\nProvide feedback how this part of code can be improved from optimal perspective:`,
                    model: this.model,
                    max_tokens: this.maxTokens,
                });
                return response.choices[0].text;
            }
            catch (error) {
                console.info('Request available models by getCurrentModels()');
                throw new Error(`OpenAI API error: ${error.message}`);
            }
        });
    }
    getCurrentModels() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { data } = yield this.client.get('/models');
                return data;
            }
            catch (error) {
                throw new Error(`OpenAI API error: ${error.message}`);
            }
        });
    }
    codeReviewOnCI() {
        return __awaiter(this, void 0, void 0, function* () {
            (0, child_process_1.exec)(`
            git fetch origin
            git diff origin/develop -- . ':!package-lock.json' ':!tsconfig.json' ':!dist/' > pr.diff
        `, (err, stdout, stderr) => __awaiter(this, void 0, void 0, function* () {
                if (err) {
                    console.error(`Error executing git diff: ${stderr}`);
                    return new Error(String(err));
                }
                const feedback = yield this.submitCode(stdout);
                console.info('Code Review-ci Feedback:', feedback);
                return feedback;
            }));
        });
    }
    generateDocumentation(code) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const response = yield this.client.completions.create({
                    prompt: `Generate documentation for the following code:\n\n${code}\n\nDocumentation:`,
                    model: this.model,
                    max_tokens: this.maxTokens,
                });
                return response.choices[0].text;
            }
            catch (error) {
                throw new Error(`OpenAI API error: ${error.message}`);
            }
        });
    }
    optimizeCode(code) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const response = yield this.client.completions.create({
                    prompt: `Optimize the following code for performance and readability:\n\n${code}\n\nOptimized Code:`,
                    model: this.model,
                    max_tokens: this.maxTokens,
                });
                return response.choices[0].text;
            }
            catch (error) {
                throw new Error(`OpenAI API error: ${error.message}`);
            }
        });
    }
    generateTests(code) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const response = yield this.client.completions.create({
                    prompt: `Generate unit tests for the following code:\n\n${code}\n\nUnit Tests:`,
                    model: this.model,
                    max_tokens: this.maxTokens,
                });
                return response.choices[0].text;
            }
            catch (error) {
                throw new Error(`OpenAI API error: ${error.message}`);
            }
        });
    }
    securityAnalysis(code) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const response = yield this.client.completions.create({
                    prompt: `Analyze the following code for potential security vulnerabilities and suggest fixes:\n\n${code}\n\nSecurity Analysis:`,
                    model: this.model,
                    max_tokens: this.maxTokens,
                });
                return response.choices[0].text;
            }
            catch (error) {
                throw new Error(`OpenAI API error: ${error.message}`);
            }
        });
    }
    codeStyleRecommendations(code) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const response = yield this.client.completions.create({
                    prompt: `Provide style recommendations for the following code according to best practices:\n\n${code}\n\nStyle Recommendations:`,
                    model: this.model,
                    max_tokens: this.maxTokens,
                });
                return response.choices[0].text;
            }
            catch (error) {
                throw new Error(`OpenAI API error: ${error.message}`);
            }
        });
    }
    historicalAnalysis(repoPath) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const response = yield this.client.completions.create({
                    prompt: `Analyze the code changes history for the repository at ${repoPath} and provide improvement recommendations.\n\nAnalysis:`,
                    model: this.model,
                    max_tokens: this.maxTokens,
                });
                return response.choices[0].text;
            }
            catch (error) {
                throw new Error(`OpenAI API error: ${error.message}`);
            }
        });
    }
}
exports.Reviewer = Reviewer;
