// The one definition of a characterization test's id, shared by the CI ratchet check and the
// parity report: "<spec file> › <describe titles…> › <test title>", as Playwright's list reporter
// prints it. Calls visit(id, spec) for every spec in a Playwright JSON report (results or --list).
export function forEachTest(report, visit) {
  function walk(suite, titles) {
    const here = suite.title && !suite.file?.endsWith(suite.title) ? [...titles, suite.title] : titles;
    for (const spec of suite.specs ?? []) visit([suite.file ?? spec.file, ...here, spec.title].join(' › '), spec);
    for (const child of suite.suites ?? []) walk({ ...child, file: child.file ?? suite.file }, here);
  }
  for (const suite of report.suites ?? []) walk(suite, []);
}
