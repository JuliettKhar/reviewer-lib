import { describe, it, expect, vi, beforeEach } from 'vitest';

// Shared spies for the mocked OpenAI client. Declared via vi.hoisted so they
// exist before vi.mock (which is hoisted to the top of the module) runs.
const mocks = vi.hoisted(() => ({
    chatCreate: vi.fn(),   // chat.completions.create — the default (Chat) path
    create: vi.fn(),       // completions.create — the legacy instruct path
    get: vi.fn(),
    post: vi.fn(),
    ctor: vi.fn(),
}));

vi.mock('openai', () => ({
    default: vi.fn(function (opts: unknown) {
        mocks.ctor(opts);
        return {
            chat: { completions: { create: mocks.chatCreate } },
            completions: { create: mocks.create },
            get: mocks.get,
            post: mocks.post,
        };
    }),
}));

import { Reviewer } from '../src/index';

// Chat Completions response shape.
const okChat = (text: string) => ({ choices: [{ message: { content: text } }] });
// Legacy Completions response shape.
const okText = (text: string) => ({ choices: [{ text }] });

beforeEach(() => {
    vi.clearAllMocks();
});

describe('Reviewer constructor', () => {
    it('passes the api key and default reliability options to the OpenAI client', () => {
        new Reviewer('sk-test-123');
        expect(mocks.ctor).toHaveBeenCalledWith(
            expect.objectContaining({ apiKey: 'sk-test-123', maxRetries: 3, timeout: 120_000 }),
        );
    });

    it('applies custom maxRetries and timeout', () => {
        new Reviewer('sk-test', 'gpt-4o', 500, undefined, { maxRetries: 5, timeout: 30_000 });
        expect(mocks.ctor).toHaveBeenCalledWith(
            expect.objectContaining({ maxRetries: 5, timeout: 30_000 }),
        );
    });

    it('applies default model (gpt-4o-mini) and maxTokens (1500)', async () => {
        mocks.chatCreate.mockResolvedValue(okChat('ok'));
        await new Reviewer('sk-test').submitCode('code');

        expect(mocks.chatCreate).toHaveBeenCalledWith(
            expect.objectContaining({ model: 'gpt-4o-mini', max_tokens: 1500 }),
        );
    });

    it('honours custom model and maxTokens', async () => {
        mocks.chatCreate.mockResolvedValue(okChat('ok'));
        await new Reviewer('sk-test', 'gpt-4o', 99).submitCode('code');

        expect(mocks.chatCreate).toHaveBeenCalledWith(
            expect.objectContaining({ model: 'gpt-4o', max_tokens: 99 }),
        );
    });
});

describe('Chat routing (default path)', () => {
    it('submitCode calls chat.completions.create with a system + user message', async () => {
        mocks.chatCreate.mockResolvedValue(okChat('great code'));
        const result = await new Reviewer('sk-test').submitCode('const a = 1;');

        expect(result).toBe('great code');
        expect(mocks.chatCreate).toHaveBeenCalledTimes(1);
        expect(mocks.create).not.toHaveBeenCalled();
        expect(mocks.post).not.toHaveBeenCalled();

        const messages = mocks.chatCreate.mock.calls[0][0].messages;
        expect(messages[0].role).toBe('system');
        expect(messages[1].role).toBe('user');
        expect(messages[1].content).toContain('const a = 1;');
    });
});

describe('Instruct routing (backward compatibility)', () => {
    it('routes -instruct models to the legacy completions.create with a prompt', async () => {
        mocks.create.mockResolvedValue(okText('legacy feedback'));
        const reviewer = new Reviewer('sk-test', 'gpt-3.5-turbo-instruct');
        const result = await reviewer.submitCode('const b = 2;');

        expect(result).toBe('legacy feedback');
        expect(mocks.create).toHaveBeenCalledTimes(1);
        expect(mocks.chatCreate).not.toHaveBeenCalled();
        expect(mocks.create.mock.calls[0][0].prompt).toContain('const b = 2;');
        expect(mocks.create.mock.calls[0][0].model).toBe('gpt-3.5-turbo-instruct');
    });
});

describe('reasoning models (o-series)', () => {
    it('submitCode sends max_completion_tokens and omits temperature/max_tokens', async () => {
        mocks.chatCreate.mockResolvedValue(okChat('ok'));
        await new Reviewer('sk-test', 'o3-mini').submitCode('code');

        const arg = mocks.chatCreate.mock.calls[0][0];
        expect(arg.max_completion_tokens).toBe(1500);
        expect(arg.max_tokens).toBeUndefined();
        expect(arg.temperature).toBeUndefined();
    });
});

describe('generateDocumentation wrapping logic', () => {
    it('wraps bare text in a JSDoc block', async () => {
        mocks.chatCreate.mockResolvedValue(okChat('Adds two numbers.'));
        const doc = await new Reviewer('sk-test').generateDocumentation('code');

        expect(doc.startsWith('/**')).toBe(true);
        expect(doc.endsWith('*/')).toBe(true);
        expect(doc).toContain('Adds two numbers.');
    });

    it('leaves already-formatted JSDoc untouched', async () => {
        const formatted = '/**\n * done\n */';
        mocks.chatCreate.mockResolvedValue(okChat(formatted));
        const doc = await new Reviewer('sk-test').generateDocumentation('code');

        expect(doc).toBe(formatted);
    });

    it('returns a fallback message when there is no content', async () => {
        mocks.chatCreate.mockResolvedValue({ choices: [] });
        const doc = await new Reviewer('sk-test').generateDocumentation('code');

        expect(doc).toBe('No documentation generated by OpenAI API');
    });
});

describe('getCurrentModels', () => {
    it('returns the data array from the models endpoint', async () => {
        const models = [{ id: 'gpt-4', object: 'model', created: 1, owned_by: 'openai' }];
        mocks.get.mockResolvedValue({ data: models });

        const result = await new Reviewer('sk-test').getCurrentModels();
        expect(result).toEqual(models);
        expect(mocks.get).toHaveBeenCalledWith('/models');
    });
});

describe('chat-based methods return the model text', () => {
    const methods = [
        'submitCodeAssistanceMode',
        'optimizeCode',
        'generateTests',
        'securityAnalysis',
        'codeStyleRecommendations',
        'historicalAnalysis',
    ] as const;

    for (const method of methods) {
        it(`${method} returns the message content`, async () => {
            mocks.chatCreate.mockResolvedValue(okChat(`${method}-result`));
            const reviewer = new Reviewer('sk-test');
            const result = await (reviewer as any)[method]('code');

            expect(result).toBe(`${method}-result`);
            expect(mocks.chatCreate).toHaveBeenCalledTimes(1);
        });
    }
});

describe('error handling', () => {
    it('submitCode wraps client errors with an OpenAI API error prefix', async () => {
        mocks.chatCreate.mockRejectedValue(new Error('boom'));
        await expect(new Reviewer('sk-test').submitCode('code')).rejects.toThrow(
            'OpenAI API error: boom',
        );
    });

    it('getCurrentModels wraps client errors', async () => {
        mocks.get.mockRejectedValue(new Error('unauthorized'));
        await expect(new Reviewer('sk-test').getCurrentModels()).rejects.toThrow(
            'OpenAI API error: unauthorized',
        );
    });
});
