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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasBlockingFindings = exports.toReviewComments = exports.formatFindings = exports.Reviewer = void 0;
// https://platform.openai.com/docs/deprecations
const openai_1 = __importDefault(require("openai"));
const child_process_1 = require("child_process");
const prompts_1 = require("./utils/prompts");
const default_options_1 = require("./utils/default-options");
const review_1 = require("./utils/review");
const diff_1 = require("./utils/diff");
class Reviewer {
    constructor(apiKey, model = 'gpt-4o-mini', maxTokens = 1500, defaultClassOptions = default_options_1.defaultOptions) {
        this.apiKey = apiKey;
        this.model = model;
        this.maxTokens = maxTokens;
        this.modelOptions = defaultClassOptions;
        this.client = new openai_1.default({
            apiKey: this.apiKey,
        });
    }
    // True for legacy text-completion models (e.g. gpt-3.5-turbo-instruct), which
    // must go through the old Completions API rather than Chat Completions.
    isInstruct() {
        return this.model.endsWith('-instruct');
    }
    // Single entry point for every prompt. Routes to Chat Completions by default and
    // falls back to the legacy Completions API for instruct models, so callers that
    // still pass an instruct model keep working. Returns the model's text output.
    complete(userPrompt_1) {
        return __awaiter(this, arguments, void 0, function* (userPrompt, overrides = {}) {
            var _a, _b, _c, _d, _e;
            try {
                if (this.isInstruct()) {
                    const response = yield this.client.completions.create(Object.assign(Object.assign({ model: this.model, prompt: userPrompt, max_tokens: this.maxTokens }, this.modelOptions), overrides));
                    return (_b = (_a = response.choices[0]) === null || _a === void 0 ? void 0 : _a.text) !== null && _b !== void 0 ? _b : '';
                }
                // Reasoning models (o1/o3/…) use `max_completion_tokens` and reject `temperature`/`top_p`.
                const isReasoning = /^o\d/.test(this.model);
                const _f = this.modelOptions, { temperature, top_p } = _f, reasoningSafeOptions = __rest(_f, ["temperature", "top_p"]);
                const response = yield this.client.chat.completions.create(Object.assign(Object.assign({ model: this.model, messages: [
                        { role: 'system', content: prompts_1.SYSTEM_PROMPT },
                        { role: 'user', content: userPrompt },
                    ] }, (isReasoning
                    ? Object.assign({ max_completion_tokens: this.maxTokens }, reasoningSafeOptions) : Object.assign({ max_tokens: this.maxTokens }, this.modelOptions))), overrides));
                return (_e = (_d = (_c = response.choices[0]) === null || _c === void 0 ? void 0 : _c.message) === null || _d === void 0 ? void 0 : _d.content) !== null && _e !== void 0 ? _e : '';
            }
            catch (error) {
                throw new Error(`OpenAI API error: ${(error === null || error === void 0 ? void 0 : error.message) || error}`);
            }
        });
    }
    submitCode(code) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.complete((0, prompts_1.generateSubmitCodePrompt)(code));
        });
    }
    submitCodeAssistanceMode(code) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.complete((0, prompts_1.generateSubmitCodeAssistanceModePrompt)(code));
        });
    }
    // Structured review: returns typed findings (severity/category/file/line/message/suggestion)
    // via OpenAI Structured Outputs. Chat models only — instruct models cannot enforce a schema.
    // Pass { asDiff: true } to review a unified diff so findings carry file+line for inline comments.
    review(input_1) {
        return __awaiter(this, arguments, void 0, function* (input, options = {}) {
            var _a, _b, _c, _d;
            if (this.isInstruct()) {
                throw new Error('review() requires a chat model; instruct models do not support structured output');
            }
            try {
                // Tag added lines with real new-file line numbers so the model anchors findings correctly.
                const payload = options.asDiff ? (0, diff_1.annotateDiff)(input) : input;
                const isReasoning = /^o\d/.test(this.model);
                const response = yield this.client.chat.completions.create(Object.assign({ model: this.model, messages: [
                        { role: 'system', content: prompts_1.REVIEW_SYSTEM_PROMPT },
                        { role: 'user', content: (0, prompts_1.buildReviewPrompt)(payload, options.asDiff) },
                    ], response_format: { type: 'json_schema', json_schema: review_1.REVIEW_SCHEMA } }, (isReasoning
                    ? { max_completion_tokens: this.maxTokens }
                    : { max_tokens: this.maxTokens, temperature: this.modelOptions.temperature })));
                const content = (_c = (_b = (_a = response.choices[0]) === null || _a === void 0 ? void 0 : _a.message) === null || _b === void 0 ? void 0 : _b.content) !== null && _c !== void 0 ? _c : '{"findings":[]}';
                return ((_d = JSON.parse(content).findings) !== null && _d !== void 0 ? _d : []);
            }
            catch (error) {
                throw new Error(`OpenAI API error: ${(error === null || error === void 0 ? void 0 : error.message) || error}`);
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
            const content = yield this.complete((0, prompts_1.generateDocumentationPrompt)(code), {
                temperature: 0.5,
                n: 1,
                stop: ["*/"],
            });
            if (!content) {
                return 'No documentation generated by OpenAI API';
            }
            let documentation = content;
            if (!documentation.startsWith('/**')) {
                documentation = `/**\n${documentation}`;
            }
            if (!documentation.endsWith('*/')) {
                documentation = `${documentation}\n*/`;
            }
            return documentation;
        });
    }
    optimizeCode(code) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.complete((0, prompts_1.generateOptimizeCodePrompt)(code));
        });
    }
    generateTests(code) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.complete((0, prompts_1.generateTestsPrompt)(code), { temperature: 0.5, n: 1 });
        });
    }
    securityAnalysis(code) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.complete((0, prompts_1.generateSecurityAnalysisPrompt)(code));
        });
    }
    codeStyleRecommendations(code) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.complete((0, prompts_1.generateCodeStyleRecommendationsPrompt)(code), { temperature: 0.5, n: 1 });
        });
    }
    historicalAnalysis(repoPathOrDiff) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.complete((0, prompts_1.generateHistoricalAnalysisPrompt)(repoPathOrDiff), { temperature: 0.5, n: 1 });
        });
    }
}
exports.Reviewer = Reviewer;
var review_2 = require("./utils/review");
Object.defineProperty(exports, "formatFindings", { enumerable: true, get: function () { return review_2.formatFindings; } });
Object.defineProperty(exports, "toReviewComments", { enumerable: true, get: function () { return review_2.toReviewComments; } });
Object.defineProperty(exports, "hasBlockingFindings", { enumerable: true, get: function () { return review_2.hasBlockingFindings; } });
