// Turns a Ralph loop iteration log (logs/ralph-*/iteration-N.log) into an animated, looping SVG
// for the README: each step appears in turn, as in a terminal. Real logs only; nothing is invented.
// Usage: node scripts/log-to-svg.mjs <iteration.log> <out.svg> "<title>"
import { readFileSync, writeFileSync } from 'node:fs';

const [logPath, outPath, title = 'Ralph loop iteration'] = process.argv.slice(2);
if (!logPath || !outPath) {
  console.error('usage: node scripts/log-to-svg.mjs <iteration.log> <out.svg> "<title>"');
  process.exit(2);
}

const MAX = 104;
const clip = (s) => (s.length > MAX ? `${s.slice(0, MAX - 3)}...` : s);
const xml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Tool calls are shown by their own "description" field when they have one, which is what a
// human reads; the final "done:" line repeats the last agent message and is skipped.
const lines = readFileSync(logPath, 'utf8')
  .split('\n')
  .filter((l) => l.trim() && !l.trim().startsWith('done:'))
  .map((l) => {
    const tool = /^\s*tool:\s+(\S+)\s+(.*)$/.exec(l);
    if (tool) {
      const input = tool[2] ?? '';
      const description = /"description":"((?:[^"\\]|\\.)*)"/.exec(input)?.[1];
      // The live log truncates long inputs, cutting off "description"; fall back to the command,
      // with JSON escapes undone so it reads like a shell line.
      const command = /"command":"((?:[^"\\]|\\.)*)/
        .exec(input)?.[1]
        ?.replace(/\\n/g, ' ')
        .replace(/\\(.)/g, '$1');
      return { kind: 'tool', text: clip(`$ ${description ?? command ?? `${tool[1]} ${input}`}`) };
    }
    return { kind: 'agent', text: clip(l.trim()) };
  });

const STEP = 1.1; // seconds between lines
const HOLD = 5; // seconds the full log stays visible before the loop restarts
const total = lines.length * STEP + HOLD;
const pct = (t) => ((100 * t) / total).toFixed(2);
const width = 900;
const top = 58;
const lineHeight = 22;
const height = top + lines.length * lineHeight + 20;

const rows = lines
  .map((line, i) => {
    const y = top + i * lineHeight;
    const fill = line.kind === 'tool' ? 'var(--tool)' : 'var(--agent)';
    return `<text x="20" y="${y}" fill="${fill}" class="l l${i}">${xml(line.text)}</text>`;
  })
  .join('\n  ');
const keyframes = lines
  .map((_, i) => {
    const show = pct(i * STEP);
    return `@keyframes k${i} { 0%, ${show}% { opacity: 0 } ${(Number(show) + 0.01).toFixed(2)}%, 97% { opacity: 1 } 100% { opacity: 0 } }
  .l${i} { animation: k${i} ${total.toFixed(1)}s linear infinite }`;
  })
  .join('\n  ');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${xml(title)}">
<style>
  :root { --bg: #0d1117; --title: #8b949e; --tool: #79c0ff; --agent: #e6edf3 }
  text { font: 13px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; white-space: pre }
  .l { opacity: 0 }
  ${keyframes}
</style>
<rect width="100%" height="100%" rx="8" fill="var(--bg)"/>
<circle cx="20" cy="18" r="5" fill="#ff5f56"/><circle cx="36" cy="18" r="5" fill="#ffbd2e"/><circle cx="52" cy="18" r="5" fill="#27c93f"/>
<text x="70" y="22" fill="var(--title)">${xml(title)}</text>
  ${rows}
</svg>
`;
writeFileSync(outPath, svg);
console.log(`Wrote ${outPath}: ${lines.length} lines, ${total.toFixed(1)}s loop`);
