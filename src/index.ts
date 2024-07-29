// https://platform.openai.com/docs/deprecations
import OpenAI from 'openai';
import {exec} from 'child_process';

interface IModel {
    id: string;
    object: string;
    created: number;
    owned_by: string;
}


class Reviewer {
    private readonly apiKey;
    private readonly model;
    private readonly client;
    private readonly maxTokens;

    constructor(apiKey: string, model = 'gpt-3.5-turbo-instruct', maxTokens = 150) {
        this.apiKey = apiKey;
        this.model = model;
        this.maxTokens = maxTokens;

        this.client = new OpenAI({
            apiKey: this.apiKey,
        });
    }

    async submitCode(code: string): Promise<string | undefined> {
        try {
            const response: any = await this.client.completions.create({
                prompt: `Review the following code and provide feedback on how to improve it:\n\n${code}\n\nFeedback:`,
                model: this.model,
                max_tokens: this.maxTokens,
            });

            return response.choices[0].text;
        } catch (error: Error | any) {
            console.info('Request available models by getCurrentModels()');
            throw new Error(`OpenAI API error: ${error.message}`);
        }
    }

    async submitCodeAssistanceMode(code: string, model = this.model, maxTokens = this.maxTokens): Promise<string | undefined> {
        try {
            const response: any = await this.client.completions.create({
                prompt: `Review the part of code:\n\n${code}\n\nProvide feedback how this part of code can be improved from optimal perspective:`,
                model: model,
                max_tokens: maxTokens,
            });

            return response.choices[0].text;
        } catch (error: Error | any) {
            console.info('Request available models by getCurrentModels()');
            throw new Error(`OpenAI API error: ${error.message}`);
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
        try {
            const response = await this.client.completions.create({
                prompt: `Generate documentation for the following code:\n\n${code}\n\nDocumentation:`,
                model: this.model,
                max_tokens: this.maxTokens,
            });
            return response.choices[0].text;
        } catch (error: Error | any) {
            throw new Error(`OpenAI API error: ${error.message}`);
        }
    }

    async optimizeCode(code: string): Promise<string> {
        try {
            const response = await this.client.completions.create({
                prompt: `Optimize the following code for performance and readability:\n\n${code}\n\nOptimized Code:`,
                model: this.model,
                max_tokens: this.maxTokens,
            });

            return response.choices[0].text;
        } catch (error: Error | any) {
            throw new Error(`OpenAI API error: ${error.message}`);
        }
    }

    async generateTests(code: string): Promise<string> {
        try {
            const response = await this.client.completions.create({
                prompt: `Generate unit tests for the following code:\n\n${code}\n\nUnit Tests:`,
                model: this.model,
                max_tokens: this.maxTokens,
            });
            return response.choices[0].text;
        } catch (error: Error | any) {
            throw new Error(`OpenAI API error: ${error.message}`);
        }

    }
}

export {
    Reviewer
};