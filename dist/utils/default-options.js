"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultOptions = void 0;
// export type IDefaultOptions = Record<string, string | number | boolean | null | string[]>
exports.defaultOptions = {
    temperature: 0.5,
    top_p: 1,
    frequency_penalty: 0.0,
    presence_penalty: 0.0,
    n: 1,
    best_of: 1,
    logprobs: null,
    echo: false,
};
