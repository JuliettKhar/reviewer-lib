declare module 'reviewer-lib' {
  export interface IModel {
    id: string;
    object: string;
    created: number;
    owned_by: string;
}

  export class Reviewer {
    constructor(apiKey: string, model: string, maxTokens: number);
    submitCode(code: string): Promise<string | undefined>;
    getCurrentModels(): Promise<IModel[]>;
    codeReviewOnCI(): Promise<string>;
    generateDocumentation(code: string): Promise<string>;
    optimizeCode(code: string): Promise<string>;
    generateTests(code: string): Promise<string>;
    securityAnalysis(code: string): Promise<string>;
    codeStyleRecommendations(code: string): Promise<string>;
    historicalAnalysis(repoPath: string): Promise<string>;
  }
}