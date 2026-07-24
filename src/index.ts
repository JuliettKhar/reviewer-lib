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
    FILTER_SYSTEM_PROMPT,
    buildReviewPrompt
} from "./utils/prompts";
import { defaultOptions } from './utils/default-options';
import { Finding, REVIEW_SCHEMA, FILTER_SCHEMA } from './utils/review';
import { annotateDiff, splitDiffByFile, splitFileDiffByHunk, filterDiffByPath } from './utils/diff';
import { hashKey, readCache, writeCache } from './utils/cache';

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

    // Reasoning models (o-series and the gpt-5.x family) require `max_completion_tokens`
    // and reject sampling params like `temperature`/`top_p`.
    private isReasoning(model = this.model): boolean {
        return /^o\d/.test(model) || /^gpt-5/.test(model);
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
            const isReasoning = this.isReasoning();
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
    // Large diffs (over maxChunkChars, default 20000) are reviewed file-by-file and merged, which
    // keeps each request focused and avoids truncating the model's JSON output.
    async review(
        input: string,
        options: {
            asDiff?: boolean;
            language?: string;
            maxChunkChars?: number;
            cache?: { dir: string };
            filter?: boolean;
            filterModel?: string;
            exclude?: string[];
        } = {},
    ): Promise<Finding[]> {
        if (this.isInstruct()) {
            throw new Error('review() requires a chat model; instruct models do not support structured output');
        }

        // Drop excluded files (lockfiles, build output, …) from a diff before reviewing.
        const reviewInput = options.asDiff && options.exclude?.length
            ? filterDiffByPath(input, options.exclude)
            : input;
        if (options.asDiff && !reviewInput.trim()) return [];

        // Result cache (opt-in): identical input + model + options → return the stored findings.
        const cacheDir = options.cache?.dir;
        const cacheKey = cacheDir
            ? hashKey(this.model, reviewInput, JSON.stringify({
                asDiff: options.asDiff,
                language: options.language,
                maxChunkChars: options.maxChunkChars,
                filter: options.filter,
                filterModel: options.filterModel,
            }))
            : null;
        if (cacheDir && cacheKey) {
            const hit = readCache<Finding[]>(cacheDir, cacheKey);
            if (hit) return hit;
        }

        const findings = await this.computeReview(reviewInput, options);
        const result = options.filter ? await this.filterFindings(findings, options.filterModel) : findings;

        if (cacheDir && cacheKey) writeCache(cacheDir, cacheKey, result);
        return result;
    }

    // Runs the review, splitting large diffs by file (then by hunk for a single oversized file)
    // and merging the findings. Small inputs go through as a single request.
    private async computeReview(
        input: string,
        options: { asDiff?: boolean; language?: string; maxChunkChars?: number },
    ): Promise<Finding[]> {
        const maxChunkChars = options.maxChunkChars ?? 20_000;
        if (options.asDiff && input.length > maxChunkChars) {
            const chunks = splitDiffByFile(input).flatMap((fileDiff) =>
                fileDiff.length > maxChunkChars ? splitFileDiffByHunk(fileDiff) : [fileDiff],
            );
            if (chunks.length > 1) {
                const perChunk = await this.mapLimit(chunks, 5, (chunk) => this.reviewOnce(chunk, options));
                return perChunk.flat();
            }
        }
        return this.reviewOnce(input, options);
    }

    // Second pass: asks the model which findings are real, actionable defects and drops the rest
    // (hypothetical/defensive nits). Best-effort — on error or empty input, findings pass through.
    private async filterFindings(findings: Finding[], filterModel?: string): Promise<Finding[]> {
        if (findings.length === 0) return findings;
        const model = filterModel ?? this.model;
        try {
            const list = findings
                .map((f, i) => `${i}. [${f.severity}/${f.category}] ${f.message}`)
                .join('\n');
            const isReasoning = this.isReasoning(model);
            const response = await this.client.chat.completions.create({
                model,
                messages: [
                    { role: 'system' as const, content: FILTER_SYSTEM_PROMPT },
                    { role: 'user' as const, content: `Findings:\n${list}\n\nReturn the indices to KEEP.` },
                ],
                response_format: { type: 'json_schema', json_schema: FILTER_SCHEMA },
                // Reasoning judges need room to think before the tiny keep-list answer.
                ...(isReasoning ? { max_completion_tokens: 4000 } : { max_tokens: 300 }),
            });
            const content = response.choices[0]?.message?.content?.trim() || '{"keep":[]}';
            const keep = new Set<number>((JSON.parse(content).keep ?? []) as number[]);
            return findings.filter((_, i) => keep.has(i));
        } catch {
            return findings;
        }
    }

    // One structured-review request over a single payload (whole diff or one file's diff).
    private async reviewOnce(input: string, options: { asDiff?: boolean; language?: string }): Promise<Finding[]> {
        let content: string;
        try {
            // Tag added lines with real new-file line numbers so the model anchors findings correctly.
            const payload = options.asDiff ? annotateDiff(input) : input;
            const isReasoning = this.isReasoning();
            // Reasoning models spend tokens on hidden reasoning before the answer, so give the
            // budget a floor — otherwise the JSON output can be starved and come back empty.
            const budget = isReasoning ? Math.max(this.maxTokens, 8000) : this.maxTokens;
            const response = await this.client.chat.completions.create({
                model: this.model,
                messages: [
                    { role: 'system' as const, content: REVIEW_SYSTEM_PROMPT },
                    { role: 'user' as const, content: buildReviewPrompt(payload, options.asDiff, options.language) },
                ],
                response_format: { type: 'json_schema', json_schema: REVIEW_SCHEMA },
                ...(isReasoning
                    ? { max_completion_tokens: budget }
                    : { max_tokens: budget, temperature: this.modelOptions.temperature }),
            });
            content = response.choices[0]?.message?.content ?? '';
        } catch (error: any) {
            throw new Error(`OpenAI API error: ${error?.message || error}`);
        }
        // Empty or truncated output (e.g. the token budget was consumed by reasoning) → no findings,
        // instead of crashing the whole review with "Unexpected end of JSON input".
        if (!content.trim()) return [];
        try {
            return (JSON.parse(content).findings ?? []) as Finding[];
        } catch {
            return [];
        }
    }

    // Runs `fn` over `items` with at most `limit` in flight; preserves input order.
    private async mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
        const results: R[] = new Array(items.length);
        let next = 0;
        const worker = async () => {
            while (next < items.length) {
                const index = next++;
                results[index] = await fn(items[index]);
            }
        };
        await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
        return results;
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
