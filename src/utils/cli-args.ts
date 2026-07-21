export interface ParsedArgs {
    _: string[];
    [key: string]: string | boolean | string[] | undefined;
}

// Minimal, dependency-free CLI argument parser used by bin/reviewer.mjs.
// - `--flag value` captures the next token as the value
// - `--post`, `--code`, `-h`, `--help` are boolean flags
// - anything else is a positional, collected in `_`
export function parseArgs(argv: string[]): ParsedArgs {
    const booleanFlags = new Set(['--post', '--code', '-h', '--help']);
    const args: ParsedArgs = { _: [] };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '-h' || a === '--help') args.help = true;
        else if (booleanFlags.has(a)) args[a.replace(/^--/, '')] = true;
        else if (a.startsWith('--')) args[a.slice(2)] = argv[++i];
        else args._.push(a);
    }
    return args;
}
