// How did the loop's agent find out what legacy does? Counts, across the Ralph loop's stream logs
// (logs/ralph-*/iteration-*.jsonl, gitignored), the search_legacy_code calls against the other ways
// of reading legacy: shell commands that touch legacy/ (grep, sed, cat...) and requests to the
// running legacy app. Prints each search query with the files it returned (NOTES N75).
//
//   node scripts/agent-tool-usage.mjs [logs-dir]
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = process.argv[2] ?? 'logs';
const totals = {
  iterations: 0,
  mcpConnected: 0,
  searches: 0,
  shellOnLegacySource: 0,
  requestsToLegacyApp: 0,
};
const searches = [];

for (const run of readdirSync(root)
  .filter((d) => d.startsWith('ralph-'))
  .sort()) {
  for (const file of readdirSync(join(root, run)).filter((f) => /^iteration-\d+\.jsonl$/.test(f))) {
    totals.iterations++;
    const pending = new Map();
    for (const line of readFileSync(join(root, run, file), 'utf8').split('\n')) {
      let event;
      try {
        event = JSON.parse(line);
      } catch {
        continue;
      }
      if (event.type === 'system' && event.subtype === 'init') {
        if (event.mcp_servers?.some((s) => s.name === 'legacy-code' && s.status === 'connected'))
          totals.mcpConnected++;
      }
      for (const block of event.message?.content ?? []) {
        if (event.type === 'assistant' && block.type === 'tool_use') {
          const input = JSON.stringify(block.input);
          if (block.name.endsWith('search_legacy_code')) {
            totals.searches++;
            pending.set(block.id, { run, file, query: block.input.query ?? '(no query)' });
          } else if (block.name === 'Bash') {
            if (/\blegacy\//.test(input)) totals.shellOnLegacySource++;
            if (/LEGACY_URL|legacy:8080/.test(input)) totals.requestsToLegacyApp++;
          }
        }
        if (
          event.type === 'user' &&
          block.type === 'tool_result' &&
          pending.has(block.tool_use_id)
        ) {
          const text = JSON.stringify(block.content);
          const files = [...text.matchAll(/legacy\/src\/main\/[\w/.-]+?\.\w+/g)].map((m) =>
            m[0].replace(/^.*\//, ''),
          );
          searches.push({
            ...pending.get(block.tool_use_id),
            top: [...new Set(files)].slice(0, 5),
          });
        }
      }
    }
  }
}

console.log(totals);
for (const s of searches)
  console.log(`${s.run}/${s.file}: "${s.query}" -> ${s.top.join(', ') || '(error)'}`);
