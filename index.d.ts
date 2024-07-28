declare module 'reviewer' {
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
    submitCodeAssistanceMode(code: string): Promise<string | undefined>;
    getCurrentModels(): Promise<IModel[]>;
  }
}