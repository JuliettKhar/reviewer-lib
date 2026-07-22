// Eval cases for review(). Each case is either:
//   - a bug case: `code` (or `diff`) + expect.mustFind — findings we require the model to raise
//   - a clean case: expect.findings === 0 — we require NO findings (catches false positives)
//
// Matching is heuristic (keywords + minimum severity), because model wording varies.
// Bug cases prove detection (recall); clean cases prove the reviewer stays quiet (noise).
export const cases = [
    {
        name: 'sql-injection',
        code: `function getUser(db, id) {
  return db.query("SELECT * FROM users WHERE id = " + id);
}`,
        expect: { mustFind: [{ keywords: ['sql', 'injection'], severityAtLeast: 'high' }] },
    },
    {
        name: 'missing-return',
        code: `function getTotal(items) {
  let sum = 0;
  for (const i of items) sum += i.price;
}`,
        expect: { mustFind: [{ keywords: ['return'], severityAtLeast: 'medium' }] },
    },
    {
        name: 'off-by-one',
        code: `function lastItem(arr) {
  return arr[arr.length];
}`,
        expect: { mustFind: [{ keywords: ['index', 'bound', 'length', 'undefined', 'off-by-one'], severityAtLeast: 'medium' }] },
    },
    {
        name: 'resource-leak',
        code: `function readConfig(path) {
  const fd = fs.openSync(path, 'r');
  const data = fs.readFileSync(fd, 'utf8');
  return JSON.parse(data);
}`,
        expect: { mustFind: [{ keywords: ['close', 'leak', 'descriptor', 'resource'], severityAtLeast: 'medium' }] },
    },
    {
        name: 'clean-adder',
        code: `const add = (a, b) => a + b;`,
        expect: { findings: 0 },
    },
    {
        name: 'guarded-input',
        code: `function process(input) {
  if (!Array.isArray(input)) return [];
  return input.map((x) => x * 2);
}`,
        expect: { findings: 0 },
    },
    {
        // Tests the "don't invent missing guards for code outside the diff" rule: the added
        // line uses `items` with no guard shown, but the reviewer should assume it's handled.
        name: 'no-guard-in-diff',
        diff: [
            'diff --git a/x.ts b/x.ts',
            '--- a/x.ts',
            '+++ b/x.ts',
            '@@ -10,2 +10,3 @@',
            '   const items: number[] = getItems();',
            '+  const doubled = items.map((x) => x * 2);',
            '   return doubled;',
        ].join('\n'),
        expect: { findings: 0 },
    },
];
