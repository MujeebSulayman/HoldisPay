import * as fs from 'fs';
import * as path from 'path';

const SRC_DIR = path.join(__dirname, '..', 'src');
const EXTENSIONS = new Set(['.ts', '.js']);
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.git']);

type State =
  | 'normal'
  | 'singleQuote'
  | 'doubleQuote'
  | 'backtick'
  | 'singleLineComment'
  | 'multiLineComment'
  | 'multiLineCommentAsterisk';

function stripComments(code: string): string {
  let state: State = 'normal';
  let out = '';
  let i = 0;
  let escaped = false;
  let prev = '';

  while (i < code.length) {
    const c = code[i];
    const next = code[i + 1];

    if (state === 'singleLineComment') {
      if (c === '\n') {
        out += c;
        state = 'normal';
      }
      i++;
      continue;
    }

    if (state === 'multiLineComment') {
      if (c === '*' && next === '/') {
        i += 2;
        state = 'normal';
        continue;
      }
      if (c === '\n') out += c;
      i++;
      continue;
    }

    if (state === 'multiLineCommentAsterisk') {
      if (c === '/') {
        i++;
        state = 'normal';
        continue;
      }
      state = 'multiLineComment';
      if (c === '\n') out += c;
      i++;
      continue;
    }

    if (state === 'normal') {
      if (c === '/' && next === '/') {
        state = 'singleLineComment';
        i += 2;
        continue;
      }
      if (c === '/' && next === '*') {
        state = 'multiLineComment';
        i += 2;
        continue;
      }
      if (c === "'" && !escaped) {
        state = 'singleQuote';
        out += c;
        i++;
        continue;
      }
      if (c === '"' && !escaped) {
        state = 'doubleQuote';
        out += c;
        i++;
        continue;
      }
      if (c === '`' && !escaped) {
        state = 'backtick';
        out += c;
        i++;
        continue;
      }
      out += c;
      i++;
      continue;
    }

    if (state === 'singleQuote' || state === 'doubleQuote') {
      const quote = state === 'singleQuote' ? "'" : '"';
      out += c;
      if (escaped) {
        escaped = false;
      } else if (c === '\\') {
        escaped = true;
      } else if (c === quote) {
        state = 'normal';
      }
      i++;
      continue;
    }

    if (state === 'backtick') {
      out += c;
      if (escaped) {
        escaped = false;
      } else if (c === '\\') {
        escaped = true;
      } else if (c === '`') {
        state = 'normal';
      }
      i++;
      continue;
    }

    out += c;
    i++;
  }

  return out
    .replace(/\n(\s*\n){3,}/g, '\n\n\n')
    .replace(/^\s*\n/, '')
    .replace(/\n\s*$/, '\n');
}

function walk(dir: string): string[] {
  const files: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) files.push(...walk(full));
    } else if (EXTENSIONS.has(path.extname(e.name))) {
      files.push(full);
    }
  }
  return files;
}

const files = walk(SRC_DIR);
let count = 0;
for (const file of files) {
  const raw = fs.readFileSync(file, 'utf8');
  const stripped = stripComments(raw);
  if (raw !== stripped) {
    fs.writeFileSync(file, stripped, 'utf8');
    count++;
    console.log(path.relative(SRC_DIR, file));
  }
}
console.log(`Done. Stripped comments from ${count} files.`);
