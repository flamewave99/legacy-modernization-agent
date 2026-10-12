/**
 * Splits legacy source files into retrievable chunks.
 *
 * Java: one chunk per method (with its javadoc and annotations), plus one "type" chunk holding the
 * class declaration, imports and fields with method bodies elided. Types without method bodies
 * (interfaces, simple beans) stay whole.
 * JSP, tags, XML, SQL, properties: whole file when small, otherwise overlapping line windows.
 *
 * Every chunk's text starts with a short header naming its file and symbol. Path words such as
 * "owner" and "controller" carry a lot of meaning in this codebase, and the header puts them into
 * the embedding.
 */

export type ChunkKind = 'java-type' | 'java-method' | 'jsp' | 'xml' | 'sql' | 'properties' | 'text';

export interface Chunk {
  path: string;
  kind: ChunkKind;
  symbol: string | null;
  startLine: number; // 1-based, inclusive
  endLine: number; // 1-based, inclusive
  text: string; // header + code: what gets embedded and shown
}

const MAX_WHOLE_LINES = 150;
const WINDOW_LINES = 80;
const WINDOW_OVERLAP = 20;

export function chunkFile(path: string, content: string): Chunk[] {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  if (lines.at(-1) === '') lines.pop();
  if (lines.length === 0) return [];
  if (path.endsWith('.java')) return chunkJava(path, lines);
  return wholeOrWindows(path, lines, kindFor(path), null, 0, lines.length - 1);
}

function kindFor(path: string): ChunkKind {
  if (path.endsWith('.jsp') || path.endsWith('.tag')) return 'jsp';
  if (path.endsWith('.xml')) return 'xml';
  if (path.endsWith('.sql')) return 'sql';
  if (path.endsWith('.properties')) return 'properties';
  return 'text';
}

/** A chunk covering lines[from..to] (0-based, inclusive) of the file. */
function makeChunk(path: string, kind: ChunkKind, symbol: string | null, lines: string[], from: number, to: number): Chunk {
  const header = [`// File: ${path}`, ...(symbol ? [`// Symbol: ${symbol}`] : []), `// Lines: ${from + 1}-${to + 1}`];
  return { path, kind, symbol, startLine: from + 1, endLine: to + 1, text: [...header, ...lines.slice(from, to + 1)].join('\n') };
}

/** One chunk for lines[from..to] if it is short enough, otherwise overlapping windows over it. */
function wholeOrWindows(path: string, lines: string[], kind: ChunkKind, symbol: string | null, from: number, to: number): Chunk[] {
  if (to - from + 1 <= MAX_WHOLE_LINES) return [makeChunk(path, kind, symbol, lines, from, to)];
  const chunks: Chunk[] = [];
  for (let start = from; ; start += WINDOW_LINES - WINDOW_OVERLAP) {
    const end = Math.min(start + WINDOW_LINES - 1, to);
    chunks.push(makeChunk(path, kind, symbol, lines, start, end));
    if (end === to) return chunks;
  }
}

interface Method {
  start: number; // first line, including javadoc and annotations
  end: number; // line of the closing brace
  name: string | null;
}

const NOT_METHOD_NAMES = new Set(['if', 'for', 'while', 'switch', 'catch', 'synchronized', 'return', 'new']);

function chunkJava(path: string, lines: string[]): Chunk[] {
  const { typeName, methods } = findMethods(lines);
  if (typeName === null || methods.length === 0) {
    return wholeOrWindows(path, lines, 'java-type', typeName, 0, lines.length - 1);
  }

  // Type chunk: package, imports, declaration and fields, with each method replaced by a pointer.
  const condensed: string[] = [];
  let next = 0;
  for (let i = 0; i < lines.length; i++) {
    const method = methods[next];
    if (method && i === method.start) {
      condensed.push(`    // ... ${method.name ?? 'method'}(...) is chunk ${typeName}#${method.name ?? '?'}`);
      i = method.end;
      next++;
    } else {
      condensed.push(lines[i] ?? '');
    }
  }
  const typeChunk: Chunk = {
    path,
    kind: 'java-type',
    symbol: typeName,
    startLine: 1,
    endLine: lines.length,
    text: [`// File: ${path}`, `// Symbol: ${typeName}`, `// Lines: 1-${lines.length} (method bodies elided)`, ...condensed].join('\n'),
  };

  return [
    typeChunk,
    ...methods.flatMap((m) => wholeOrWindows(path, lines, 'java-method', `${typeName}#${m.name ?? 'anonymous'}`, m.start, m.end)),
  ];
}

/**
 * Finds the methods of the top-level type by tracking brace depth, ignoring braces inside
 * comments and string/char literals. A member starts at the first non-blank line at depth 1 and
 * is a method when a body opens at depth 1 before any terminating ';'.
 */
function findMethods(lines: string[]): { typeName: string | null; methods: Method[] } {
  let depth = 0;
  let inBlockComment = false;
  let codeSoFar = ''; // comment-free text, so words in javadoc never look like declarations
  let typeName: string | null = null;
  const methods: Method[] = [];
  let memberStart = -1;
  let bodyOpen = false;
  let signature = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const code = stripCommentsAndLiterals(line, inBlockComment);
    inBlockComment = code.inBlockComment;
    codeSoFar += `${code.text}\n`;

    if (depth === 1 && memberStart === -1 && line.trim() !== '' && !line.trim().startsWith('}')) {
      memberStart = i;
      signature = '';
      bodyOpen = false;
    }
    if (depth === 1 && memberStart !== -1 && !bodyOpen) signature += ` ${code.text}`;

    for (const ch of code.text) {
      if (ch === '{') {
        if (depth === 0 && typeName === null) {
          typeName = /\b(?:class|interface|enum|record)\s+(\w+)/.exec(codeSoFar)?.[1] ?? null;
        } else if (depth === 1 && memberStart !== -1) {
          bodyOpen = true;
        }
        depth++;
      } else if (ch === '}') {
        depth--;
        if (depth === 1 && bodyOpen && memberStart !== -1) {
          methods.push({ start: memberStart, end: i, name: memberName(signature) });
          memberStart = -1;
        }
      } else if (ch === ';' && depth === 1 && memberStart !== -1 && !bodyOpen) {
        memberStart = -1; // field or abstract method: stays in the type chunk
      }
    }
  }
  return { typeName, methods };
}

function stripCommentsAndLiterals(line: string, inBlockComment: boolean): { text: string; inBlockComment: boolean } {
  let text = '';
  for (let c = 0; c < line.length; c++) {
    const ch = line[c];
    const next = line[c + 1];
    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        c++;
      }
      continue;
    }
    if (ch === '/' && next === '*') {
      inBlockComment = true;
      c++;
    } else if (ch === '/' && next === '/') {
      break;
    } else if (ch === '"' || ch === "'") {
      for (c++; c < line.length && line[c] !== ch; c++) if (line[c] === '\\') c++;
      text += ' ';
    } else {
      text += ch;
    }
  }
  return { text, inBlockComment };
}

/** Method name (word before the parameter list) or nested type name, ignoring annotations. */
function memberName(signature: string): string | null {
  const bare = stripAnnotations(signature);
  const nestedType = /\b(?:class|interface|enum|record)\s+(\w+)/.exec(bare);
  if (nestedType && (bare.indexOf('(') === -1 || nestedType.index < bare.indexOf('('))) return nestedType[1] ?? null;
  if (!bare.includes('(')) return null;
  const words = (bare.split('(')[0] ?? '').match(/[A-Za-z_$][\w$]*/g) ?? [];
  const name = words.at(-1) ?? null;
  return name !== null && !NOT_METHOD_NAMES.has(name) ? name : null;
}

/** Removes `@Name` and `@Name(...)` (balanced parentheses) from a declaration. */
function stripAnnotations(text: string): string {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const match = text[i] === '@' ? /^@[\w.]+\s*/.exec(text.slice(i)) : null;
    if (!match) {
      out += text[i];
      continue;
    }
    i += match[0].length;
    if (text[i] === '(') {
      for (let depth = 0; i < text.length; i++) {
        if (text[i] === '(') depth++;
        else if (text[i] === ')' && --depth === 0) break;
      }
    } else {
      i--;
    }
    out += ' ';
  }
  return out;
}
