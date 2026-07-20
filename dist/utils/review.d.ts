export type Severity = 'critical' | 'high' | 'medium' | 'low';
export interface Finding {
    severity: Severity;
    category: string;
    file: string | null;
    line: number | null;
    message: string;
    suggestion: string | null;
}
export declare const REVIEW_SCHEMA: {
    name: string;
    strict: boolean;
    schema: {
        type: string;
        additionalProperties: boolean;
        properties: {
            findings: {
                type: string;
                items: {
                    type: string;
                    additionalProperties: boolean;
                    properties: {
                        severity: {
                            type: string;
                            enum: string[];
                        };
                        category: {
                            type: string;
                        };
                        file: {
                            type: string[];
                        };
                        line: {
                            type: string[];
                        };
                        message: {
                            type: string;
                        };
                        suggestion: {
                            type: string[];
                        };
                    };
                    required: string[];
                };
            };
        };
        required: string[];
    };
};
export declare function formatFindings(findings: Finding[]): string;
export interface ReviewComment {
    path: string;
    line: number;
    body: string;
}
export declare function toReviewComments(findings: Finding[]): ReviewComment[];
export declare function hasBlockingFindings(findings: Finding[], threshold?: Severity): boolean;
