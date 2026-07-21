// https://platform.openai.com/docs/deprecations
import OpenAI from 'openai';
import {exec} from 'child_process';
import {
    generateCodeStyleRecommendationsPrompt,
    generateDocumentationPrompt, generateHistoricalAnalysisPrompt,
    generateOptimizeCodePrompt,
    generateSecurityAnalysisPrompt,
    generateSubmitCodeAssistanceModePrompt,
    generateSubmitCodePrompt,
    generateTestsPrompt,
    SYSTEM_PROMPT,
    REVIEW_SYSTEM_PROMPT,
    buildReviewPrompt
} from "./utils/prompts";
import { defaultOptions } from './utils/default-options';
import { Finding, REVIEW_SCHEMA } from './utils/review';
import { annotateDiff } from './utils/diff';

export interface IModel {
    id: string;
    object: string;
    created: number;
    owned_by: string;
}

interface IDefaultOptions  {
    temperature: number;
    top_p: number;
    frequency_penalty: number;
    presence_penalty: number;
    n: number;
    stop?: string[];
}

// Reliability knobs passed through to the OpenAI client. The SDK already retries
// transient failures (408/409/429/5xx) with exponential backoff; these tune how hard.
export interface IClientOptions {
    maxRetries?: number; // retry attempts on transient errors (default 3)
    timeout?: number;    // per-request timeout in ms (default 120000)
}


class Reviewer {
    private readonly apiKey;
    private readonly model;
    private readonly client;
    private readonly maxTokens;
    private readonly modelOptions;

    constructor(
        apiKey: string,
        model = 'gpt-4o-mini',
        maxTokens = 1500,
        defaultClassOptions: IDefaultOptions = defaultOptions,
        clientOptions: IClientOptions = {},
    ) {
        this.apiKey = apiKey;
        this.model = model;
        this.maxTokens = maxTokens;
        this.modelOptions = defaultClassOptions

        this.client = new OpenAI({
            apiKey: this.apiKey,
            maxRetries: clientOptions.maxRetries ?? 3,
            timeout: clientOptions.timeout ?? 120_000,
        });
    }

    // True for legacy text-completion models (e.g. gpt-3.5-turbo-instruct), which
    // must go through the old Completions API rather than Chat Completions.
    private isInstruct(): boolean {
        return this.model.endsWith('-instruct');
    }

    // Single entry point for every prompt. Routes to Chat Completions by default and
    // falls back to the legacy Completions API for instruct models, so callers that
    // still pass an instruct model keep working. Returns the model's text output.
    private async complete(userPrompt: string, overrides: Record<string, any> = {}): Promise<string> {
        try {
            if (this.isInstruct()) {
                const response: any = await this.client.completions.create({
                    model: this.model,
                    prompt: userPrompt,
                    max_tokens: this.maxTokens,
                    ...this.modelOptions,
                    ...overrides,
                });
                return response.choices[0]?.text ?? '';
            }

            // Reasoning models (o1/o3/…) use `max_completion_tokens` and reject `temperature`/`top_p`.
            const isReasoning = /^o\d/.test(this.model);
            const { temperature, top_p, ...reasoningSafeOptions } = this.modelOptions;
            const response = await this.client.chat.completions.create({
                model: this.model,
                messages: [
                    { role: 'system' as const, content: SYSTEM_PROMPT },
                    { role: 'user' as const, content: userPrompt },
                ],
                ...(isReasoning
                    ? { max_completion_tokens: this.maxTokens, ...reasoningSafeOptions }
                    : { max_tokens: this.maxTokens, ...this.modelOptions }),
                ...overrides,
            });
            return response.choices[0]?.message?.content ?? '';
        } catch (error: any) {
            throw new Error(`OpenAI API error: ${error?.message || error}`);
        }
    }

    async submitCode(code: string): Promise<string | undefined> {
        return this.complete(generateSubmitCodePrompt(code));
    }

    async submitCodeAssistanceMode(code: string): Promise<string | undefined> {
        return this.complete(generateSubmitCodeAssistanceModePrompt(code));
    }

    // Structured review: returns typed findings (severity/category/file/line/message/suggestion)
    // via OpenAI Structured Outputs. Chat models only — instruct models cannot enforce a schema.
    // Pass { asDiff: true } to review a unified diff so findings carry file+line for inline comments.
    async review(input: string, options: { asDiff?: boolean } = {}): Promise<Finding[]> {
        if (this.isInstruct()) {
            throw new Error('review() requires a chat model; instruct models do not support structured output');
        }
        try {
            // Tag added lines with real new-file line numbers so the model anchors findings correctly.
            const payload = options.asDiff ? annotateDiff(input) : input;
            const isReasoning = /^o\d/.test(this.model);
            const response = await this.client.chat.completions.create({
                model: this.model,
                messages: [
                    { role: 'system' as const, content: REVIEW_SYSTEM_PROMPT },
                    { role: 'user' as const, content: buildReviewPrompt(payload, options.asDiff) },
                ],
                response_format: { type: 'json_schema', json_schema: REVIEW_SCHEMA },
                ...(isReasoning
                    ? { max_completion_tokens: this.maxTokens }
                    : { max_tokens: this.maxTokens, temperature: this.modelOptions.temperature }),
            });
            const content = response.choices[0]?.message?.content ?? '{"findings":[]}';
            return (JSON.parse(content).findings ?? []) as Finding[];
        } catch (error: any) {
            throw new Error(`OpenAI API error: ${error?.message || error}`);
        }
    }

    async getCurrentModels(): Promise<IModel[]> {
        try {
            const {data}: { data: IModel[] } = await this.client.get('/models');
            return data;
        } catch (error: Error | any) {
            throw new Error(`OpenAI API error: ${error.message}`);
        }
    }

    async codeReviewOnCI() {
        exec(`
            git fetch origin
            git diff origin/develop -- . ':!package-lock.json' ':!tsconfig.json' ':!dist/' > pr.diff
        `, async (err, stdout, stderr) => {
            if (err) {
                console.error(`Error executing git diff: ${stderr}`);
                return new Error(String(err));
            }

            const feedback = await this.submitCode(stdout);
            console.info('Code Review-ci Feedback:', feedback);
            return feedback;
        });
    }

    async generateDocumentation(code: string): Promise<string> {
        const content = await this.complete(generateDocumentationPrompt(code), {
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
    }

    async optimizeCode(code: string): Promise<string> {
        return this.complete(generateOptimizeCodePrompt(code));
    }

    async generateTests(code: string): Promise<string> {
        return this.complete(generateTestsPrompt(code), { temperature: 0.5, n: 1 });
    }

    async securityAnalysis(code: string): Promise<string> {
        return this.complete(generateSecurityAnalysisPrompt(code));
    }

    async codeStyleRecommendations(code: string): Promise<string> {
        return this.complete(generateCodeStyleRecommendationsPrompt(code), { temperature: 0.5, n: 1 });
    }

    async historicalAnalysis(repoPathOrDiff: string): Promise<string> {
        return this.complete(generateHistoricalAnalysisPrompt(repoPathOrDiff), { temperature: 0.5, n: 1 });
    }
}

export { Reviewer };
export type { Finding, Severity, ReviewComment } from './utils/review';
export { formatFindings, toReviewComments, hasBlockingFindings } from './utils/review';
