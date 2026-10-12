// Usage: npm run search -- "where is owner validation handled?" [-k 5] [--show]
import { formatHit, retrieve } from './retrieve.js';

const usage = (): never => {
  console.error('usage: npm run search -- "<question>" [-k 5] [--show]');
  process.exit(2);
};

let k = 5;
let show = false;
const words: string[] = [];
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  const arg = args[i] ?? '';
  if (arg === '-k') {
    k = Number(args[++i]);
    if (!Number.isInteger(k) || k < 1) usage();
  } else if (arg === '--show') {
    show = true;
  } else {
    words.push(arg);
  }
}
const question = words.join(' ').trim();
if (!question) usage();

for (const [i, hit] of (await retrieve(question, k)).entries()) {
  console.log(formatHit(hit, i + 1));
  if (show) console.log(`${hit.content}\n`);
}
