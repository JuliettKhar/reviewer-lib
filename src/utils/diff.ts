// Annotates a unified diff so every ADDED line is tagged with its real line number in
// the new file: `[path:line] +<content>`. review() feeds this to the model and instructs
// it to take `line` only from these tags — which makes findings anchor to real lines
// (letting them become inline PR comments) instead of the model guessing from hunk headers.
export function annotateDiff(diff: string): string {
    const out: string[] = [];
    let file = '';
    let newLine = 0;

    for (const raw of diff.split('\n')) {
        if (raw.startsWith('+++ ')) {
            file = raw.slice(4).replace(/^b\//, '').replace(/\t.*$/, '').trim();
            out.push(raw);
            continue;
        }
        if (raw.startsWith('diff --git') || raw.startsWith('--- ') || raw.startsWith('index ')) {
            out.push(raw);
            continue;
        }

        const hunk = raw.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
        if (hunk) {
            newLine = parseInt(hunk[1], 10);
            out.push(raw);
            continue;
        }

        if (raw.startsWith('+')) {
            out.push(`[${file}:${newLine}] ${raw}`);
            newLine++;
        } else if (raw.startsWith('-')) {
            out.push(raw); // removed line — has no line number in the new file
        } else if (raw.startsWith(' ')) {
            out.push(raw); // unchanged context line
            newLine++;
        } else {
            out.push(raw); // '', '\ No newline at end of file', etc. — no line advance
        }
    }

    return out.join('\n');
}
