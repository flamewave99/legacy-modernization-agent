import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { chunkFile } from './chunker.js';

const legacy = (path: string): string => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const OWNER_CONTROLLER = 'legacy/src/main/java/org/springframework/samples/petclinic/web/OwnerController.java';

describe('Java chunking', () => {
  const chunks = chunkFile(OWNER_CONTROLLER, legacy(OWNER_CONTROLLER));

  it('makes one chunk per method, named by the method not its annotation', () => {
    expect(chunks.filter((c) => c.kind === 'java-method').map((c) => c.symbol)).toEqual([
      'OwnerController#OwnerController',
      'OwnerController#setAllowedFields',
      'OwnerController#initCreationForm',
      'OwnerController#processCreationForm',
      'OwnerController#initFindForm',
      'OwnerController#processFindForm',
      'OwnerController#initUpdateOwnerForm',
      'OwnerController#processUpdateOwnerForm',
      'OwnerController#showOwner',
    ]);
  });

  it('includes annotations in the method chunk and reports exact line numbers', () => {
    const create = chunks.find((c) => c.symbol === 'OwnerController#processCreationForm');
    expect(create).toMatchObject({ startLine: 60, endLine: 68 });
    expect(create?.text).toContain('@PostMapping(value = "/owners/new")');
    expect(create?.text.split('\n').slice(3, 4)).toEqual(['    @PostMapping(value = "/owners/new")']);
  });

  it('includes a javadoc comment in the method it documents', () => {
    expect(chunks.find((c) => c.symbol === 'OwnerController#showOwner')?.text).toContain('Custom handler for displaying an owner');
  });

  it('keeps a condensed type chunk with fields and pointers to methods', () => {
    const type = chunks.find((c) => c.kind === 'java-type');
    expect(type?.symbol).toBe('OwnerController');
    expect(type?.text).toContain('VIEWS_OWNER_CREATE_OR_UPDATE_FORM');
    expect(type?.text).toContain('is chunk OwnerController#processFindForm');
    expect(type?.text).not.toContain('rejectValue');
  });

  it('starts every chunk with a header naming the file and symbol', () => {
    for (const c of chunks) expect(c.text.startsWith(`// File: ${OWNER_CONTROLLER}\n// Symbol: ${c.symbol}\n`)).toBe(true);
  });

  it('keeps an interface whole and does not take its name from javadoc prose', () => {
    const path = 'legacy/src/main/java/org/springframework/samples/petclinic/repository/OwnerRepository.java';
    const out = chunkFile(path, legacy(path));
    expect(out).toHaveLength(1);
    expect(out[0]?.symbol).toBe('OwnerRepository');
  });

  it('names nested types', () => {
    const path = 'legacy/src/main/java/org/springframework/samples/petclinic/repository/jdbc/OneToManyResultSetExtractor.java';
    expect(chunkFile(path, legacy(path)).map((c) => c.symbol)).toContain('OneToManyResultSetExtractor#ExpectedResults');
  });

  it('ignores braces inside strings and comments, and attaches a leading comment to its method', () => {
    const src = ['class A {', '  String s = "{{";', '  // }', '  void m() {', '    x("}");', '  }', '}'].join('\n');
    expect(chunkFile('A.java', src).filter((c) => c.kind === 'java-method')).toMatchObject([{ symbol: 'A#m', startLine: 3, endLine: 6 }]);
  });
});

describe('non-Java chunking', () => {
  it('keeps a small JSP whole', () => {
    const path = 'legacy/src/main/webapp/WEB-INF/jsp/owners/findOwners.jsp';
    const out = chunkFile(path, legacy(path));
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ kind: 'jsp', startLine: 1 });
  });

  it('splits a long file into overlapping windows that cover every line', () => {
    const src = Array.from({ length: 300 }, (_, i) => `<line n="${i + 1}"/>`).join('\n');
    const out = chunkFile('big.xml', src);
    expect(out.map((c) => [c.startLine, c.endLine])).toEqual([[1, 80], [61, 140], [121, 200], [181, 260], [241, 300]]);
  });
});
