// Splits a unified diff into one self-contained diff per file, each starting at its
// `diff --git` header. Used to review very large diffs file-by-file (map-reduce), which
// keeps each request focused and avoids truncating the model's output. Any preamble before
// the first `diff --git` is dropped. Returns [] for a diff with no file headers.
export function splitDiffByFile(diff: string): string[] {
    const chunks: string[] = [];
    let current: string[] | null = null;

    for (const line of diff.split('\n')) {
        if (line.startsWith('diff --git ')) {
            if (current) chunks.push(current.join('\n'));
            current = [line];
        } else if (current) {
            current.push(line);
        }
    }
    if (current) chunks.push(current.join('\n'));

    return chunks;
}

// Splits a single file's diff into one diff per hunk, repeating the file header on each so
// every piece stays a valid, annotatable single-file diff. Used to break up one huge file
// that alone exceeds the chunk budget. Returns the input unchanged if it has 0 or 1 hunks.
export function splitFileDiffByHunk(fileDiff: string): string[] {
    const header: string[] = [];
    const hunks: string[][] = [];
    let current: string[] | null = null;

    for (const line of fileDiff.split('\n')) {
        if (line.startsWith('@@')) {
            if (current) hunks.push(current);
            current = [line];
        } else if (current) {
            current.push(line);
        } else {
            header.push(line);
        }
    }
    if (current) hunks.push(current);

    if (hunks.length <= 1) return [fileDiff];
    return hunks.map((hunk) => [...header, ...hunk].join('\n'));
}

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
