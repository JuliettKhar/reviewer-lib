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
const prompts_1 = require("./utils/prompts");
const default_options_1 = require("./utils/default-options");
class Reviewer {
    constructor(apiKey, model = 'gpt-3.5-turbo-instruct', maxTokens = 400, defaultClassOptions = default_options_1.defaultOptions) {
        this.apiKey = apiKey;
        this.model = model;
        this.maxTokens = maxTokens;
        this.modelOptions = defaultClassOptions;
        this.client = new openai_1.default({
            apiKey: this.apiKey,
        });
    }
    submitCode(code) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const response = yield this.client.post(`/engines/${this.model}/completions`, {
                    body: {
                        prompt: (0, prompts_1.generateSubmitCodePrompt)(code),
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
                const response = yield this.client.completions.create(Object.assign({ prompt: (0, prompts_1.generateSubmitCodeAssistanceModePrompt)(code), model: this.model, max_tokens: this.maxTokens }, this.modelOptions));
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
                const response = yield this.client.completions.create(Object.assign(Object.assign({ prompt: (0, prompts_1.generateDocumentationPrompt)(code), model: this.model }, this.modelOptions), { max_tokens: this.maxTokens, temperature: 0.5, n: 1, stop: ["*/"] }));
                if (response.choices && response.choices.length > 0) {
                    let documentation = response.choices[0].text;
                    if (!documentation.startsWith('/**')) {
                        documentation = `/**\n${documentation}`;
                    }
                    if (!documentation.endsWith('*/')) {
                        documentation = `${documentation}\n*/`;
                    }
                    return documentation;
                }
                else {
                    return 'No documentation generated by OpenAI API';
                }
            }
            catch (error) {
                throw new Error(`OpenAI API error: ${error.message || error}`);
            }
        });
    }
    optimizeCode(code) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const response = yield this.client.completions.create(Object.assign({ prompt: (0, prompts_1.generateOptimizeCodePrompt)(code), model: this.model, max_tokens: this.maxTokens }, this.modelOptions));
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
                const response = yield this.client.completions.create(Object.assign(Object.assign({ prompt: (0, prompts_1.generateTestsPrompt)(code), model: this.model, max_tokens: this.maxTokens }, this.modelOptions), { temperature: 0.5, n: 1 }));
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
                const response = yield this.client.completions.create(Object.assign({ prompt: (0, prompts_1.generateSecurityAnalysisPrompt)(code), model: this.model, max_tokens: this.maxTokens }, this.modelOptions));
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
                const response = yield this.client.completions.create(Object.assign(Object.assign({ prompt: (0, prompts_1.generateCodeStyleRecommendationsPrompt)(code), model: this.model, max_tokens: this.maxTokens }, this.modelOptions), { temperature: 0.5, n: 1 }));
                return response.choices[0].text;
            }
            catch (error) {
                throw new Error(`OpenAI API error: ${error.message}`);
            }
        });
    }
    historicalAnalysis(repoPathOrDiff) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const response = yield this.client.completions.create(Object.assign(Object.assign({ prompt: (0, prompts_1.generateHistoricalAnalysisPrompt)(repoPathOrDiff), model: this.model, max_tokens: this.maxTokens }, this.modelOptions), { temperature: 0.5, n: 1 }));
                return response.choices[0].text;
            }
            catch (error) {
                throw new Error(`OpenAI API error: ${error.message}`);
            }
        });
    }
}
exports.Reviewer = Reviewer;
