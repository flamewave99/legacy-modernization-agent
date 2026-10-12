// Ratchet: every test listed in modern/ratchet.txt must pass against the modern app.
// Tests that pass but are not listed yet are printed so the agent can add them.
// Usage: node check-ratchet.mjs <playwright-json-results> <ratchet-file>
import { readFileSync, existsSync } from 'node:fs';
import { forEachTest } from './test-ids.mjs';

const [resultsPath, ratchetPath] = process.argv.slice(2);
if (!resultsPath || !ratchetPath) {
  console.error('usage: check-ratchet.mjs <results.json> <ratchet.txt>');
  process.exit(2);
}

const results = JSON.parse(readFileSync(resultsPath, 'utf8'));
const passing = new Set();
const all = new Set();

forEachTest(results, (id, spec) => {
  all.add(id);
  const statuses = spec.tests.flatMap((t) => t.results.map((r) => r.status));
  if (spec.ok && statuses.length > 0 && statuses.every((s) => s === 'passed')) passing.add(id);
});

const listed = existsSync(ratchetPath)
  ? readFileSync(ratchetPath, 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
  : [];

const unknown = listed.filter((id) => !all.has(id));
const failing = listed.filter((id) => all.has(id) && !passing.has(id));
const newlyPassing = [...passing].filter((id) => !listed.includes(id)).sort();

console.log(`Modern app: ${passing.size}/${all.size} characterization tests pass; ratchet lists ${listed.length}.`);
if (newlyPassing.length > 0) {
  console.log('\nPassing but not yet in modern/ratchet.txt (add them):');
  for (const id of newlyPassing) console.log(id);
}
if (unknown.length > 0) {
  console.log('\n::error::Ratchet entries that match no test:');
  for (const id of unknown) console.log(id);
}
if (failing.length > 0) {
  console.log('\n::error::Ratchet entries that no longer pass:');
  for (const id of failing) console.log(id);
}
process.exit(unknown.length + failing.length > 0 ? 1 : 0);
