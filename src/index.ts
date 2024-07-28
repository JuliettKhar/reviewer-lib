// https://platform.openai.com/docs/deprecations
import OpenAI from 'openai';

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
            const response: any = await this.client.post(`/engines/${this.model}/completions`, {
                body: {
                    prompt: `Review the part of code:\n\n${code}\n\nProvide feedback how this part of code can be improved from optimal perspective:`,
                    max_tokens: this.maxTokens,
                },
            });

            return response.choices[0].text;
        } catch (error: Error | any) {
            console.info('Request available models by getCurrentModels()');
            throw new Error(`OpenAI API error: ${error.message}`);
        }
    }

    async submitCodeAssistanceMode(code: string): Promise<string | undefined> {
        try {
            const response: any = await this.client.completions.create({
                prompt: `Review the part of code:\n\n${code}\n\nProvide feedback how this part of code can be improved from optimal perspective:`,
                model: this.model,
                max_tokens: this.maxTokens,
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
}

module.exports = {Reviewer};