import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('index.html declara pt-BR como idioma do documento', () => {
  it('contains <html lang="pt-BR">', () => {
    const htmlPath = resolve(import.meta.dirname, '../../index.html');
    // Safe: path resolved from the test file location, not user input.
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const html = readFileSync(htmlPath, 'utf-8');

    expect(html).toMatch(/<html\s+lang\s*=\s*"pt-BR"\s*>/i);
  });
});
