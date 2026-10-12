// Usage: npm run ask -- "how does the app decide between one owner and a list?"
// Retrieves the top chunks and asks Claude (headless Claude Code, all tools disabled) to answer
// from those excerpts only, citing file:line. Answers come from retrieval, not from Claude
// reading the repository itself.
import { spawn } from 'node:child_process';
import { formatHit, retrieve } from './retrieve.js';

const question = process.argv.slice(2).join(' ');
if (!question) {
  console.error('usage: npm run ask -- "<question>"');
  process.exit(2);
}

const hits = await retrieve(question, 8);
console.log('Retrieved:');
for (const [i, hit] of hits.entries()) console.log(`  ${formatHit(hit, i + 1)}`);

const prompt = [
  'Answer the question about a legacy Spring MVC/JSP application using ONLY the code excerpts below.',
  'Cite the file path and line numbers for every claim (e.g. OwnerController.java:76-99).',
  'If the excerpts do not contain the answer, say so instead of guessing.',
  '',
  `Question: ${question}`,
  '',
  ...hits.map((h) => `<excerpt rank="${hits.indexOf(h) + 1}">\n${h.content}\n</excerpt>`),
].join('\n');

const claude = spawn('claude', ['-p', '--tools', '', '--no-session-persistence'], { stdio: ['pipe', 'inherit', 'inherit'] });
claude.stdin.end(prompt);
claude.on('close', (code) => process.exit(code ?? 1));
console.log('\nAnswer:');
