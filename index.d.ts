declare module 'reviewer-lib' {
  export interface ReviewerOptions {
    apiKey: string;
    model?: string;
    maxTokens?: number;
  }

  export interface IModel {
    id: string;
    object: string;
    created: number;
    owned_by: string;
}

  export class Reviewer {
    constructor(options: ReviewerOptions);
    submitCode(code: string): Promise<string | undefined>;
    getCurrentModels(): Promise<IModel[]>;
    codeReviewOnCI(code: string): Promise<string>;
    generateDocumentation(code: string): Promise<string>;
    optimizeCode(code: string): Promise<string>;
    generateTests(code: string): Promise<string>;
    securityAnalysis(code: string): Promise<string>;
    codeStyleRecommendations(code: string): Promise<string>;
    historicalAnalysis(repoPath: string): Promise<string>;
  }
}