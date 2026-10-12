// Usage: npm run search -- "where is owner validation handled?" [-k 5] [--show]
import { formatHit, retrieve } from './retrieve.js';

const args = process.argv.slice(2);
const kIndex = args.indexOf('-k');
const k = kIndex >= 0 ? Number(args[kIndex + 1]) : 5;
const show = args.includes('--show');
const question = args.filter((a, i) => !a.startsWith('-') && i !== kIndex + 1).join(' ');
if (!question) {
  console.error('usage: npm run search -- "<question>" [-k 5] [--show]');
  process.exit(2);
}

for (const [i, hit] of (await retrieve(question, k)).entries()) {
  console.log(formatHit(hit, i + 1));
  if (show) console.log(`${hit.content}\n`);
}
