import { Finding } from './utils/review';
export interface IModel {
    id: string;
    object: string;
    created: number;
    owned_by: string;
}
interface IDefaultOptions {
    temperature: number;
    top_p: number;
    frequency_penalty: number;
    presence_penalty: number;
    n: number;
    stop?: string[];
}
declare class Reviewer {
    private readonly apiKey;
    private readonly model;
    private readonly client;
    private readonly maxTokens;
    private readonly modelOptions;
    constructor(apiKey: string, model?: string, maxTokens?: number, defaultClassOptions?: IDefaultOptions);
    private isInstruct;
    private complete;
    submitCode(code: string): Promise<string | undefined>;
    submitCodeAssistanceMode(code: string): Promise<string | undefined>;
    review(input: string, options?: {
        asDiff?: boolean;
    }): Promise<Finding[]>;
    getCurrentModels(): Promise<IModel[]>;
    codeReviewOnCI(): Promise<void>;
    generateDocumentation(code: string): Promise<string>;
    optimizeCode(code: string): Promise<string>;
    generateTests(code: string): Promise<string>;
    securityAnalysis(code: string): Promise<string>;
    codeStyleRecommendations(code: string): Promise<string>;
    historicalAnalysis(repoPathOrDiff: string): Promise<string>;
}
export { Reviewer };
export type { Finding, Severity, ReviewComment } from './utils/review';
export { formatFindings, toReviewComments, hasBlockingFindings } from './utils/review';
