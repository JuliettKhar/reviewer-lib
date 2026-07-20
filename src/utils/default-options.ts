// Options valid for both the Chat Completions and legacy Completions APIs.
// A low temperature keeps reviews deterministic and reduces hallucinated findings.
// (The old `best_of`/`logprobs`/`echo` fields were Completions-only and no-ops here,
// so they were removed when the engine moved to Chat Completions.)
export const defaultOptions = {
    temperature: 0.2,
    top_p: 1,
    frequency_penalty: 0.0,
    presence_penalty: 0.0,
    n: 1,
}
