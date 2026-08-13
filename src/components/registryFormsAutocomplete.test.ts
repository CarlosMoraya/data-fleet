import fs from 'fs';
import path from 'path';

/* eslint-disable security/detect-non-literal-fs-filename, security/detect-non-literal-regexp */

import { describe, it, expect } from 'vitest';

const REGISTRY_FILES = [
  'src/components/DriverForm.tsx',
  'src/components/VehicleForm.tsx',
  'src/components/WorkshopForm.tsx',
  'src/components/ShipperForm.tsx',
  'src/components/OperationalUnitForm.tsx',
  'src/components/TireForm.tsx',
  'src/components/TireBatchForm.tsx',
  'src/pages/Users.tsx',
];

const FILES_WITH_FORM = REGISTRY_FILES.filter(f => f !== 'src/components/TireBatchForm.tsx');

const EXCLUDED_TYPES = new Set(['checkbox', 'radio', 'file']);

function readSource(file: string): string {
  return fs.readFileSync(path.resolve(file), 'utf-8');
}

function selfClosingTagName(tag: string): string | null {
  const m = tag.match(/<(\w+)/);
  return m ? m[1] : null;
}

function hasAutocompleteAttribute(tag: string): boolean {
  return /autoComplete=/.test(tag);
}

function getTypeAttribute(tag: string): string | null {
  const m = tag.match(/\btype\s*=\s*(?:"([^"]+)"|'([^']+)'|\{["']([^"']+)["']\})/);
  if (m) return m[1] || m[2] || m[3] || null;
  return null;
}

function getAutoCompleteValue(tag: string): string | null {
  const m = tag.match(/autoComplete\s*=\s*(?:"([^"]+)"|'([^']+)'|\{["']([^"']+)["']\})/);
  if (m) return m[1] || m[2] || m[3] || null;
  return null;
}

function isExcludedInput(tag: string): boolean {
  const type = getTypeAttribute(tag);
  if (type && EXCLUDED_TYPES.has(type)) return true;
  return false;
}

function extractTags(source: string, tagName: string): string[] {
  const tags: string[] = [];
  const openPattern = new RegExp(`<${tagName}\\b`, 'gi');
  let pos = 0;

  while (pos < source.length) {
    openPattern.lastIndex = pos;
    const openMatch = openPattern.exec(source);
    if (!openMatch) break;

    const tagStart = openMatch.index;
    let i = openMatch.index + openMatch[0].length;
    let braceDepth = 0;
    let inString: false | '"' | "'" | '`' = false;

    while (i < source.length) {
      const ch = source[i];

      if (inString) {
        if (ch === inString && source[i - 1] !== '\\') {
          inString = false;
        }
      } else {
        if (ch === '"' || ch === "'" || ch === '`') {
          inString = ch;
        } else if (ch === '{') {
          braceDepth++;
        } else if (ch === '}') {
          braceDepth = Math.max(0, braceDepth - 1);
        } else if (ch === '>' && braceDepth === 0) {
          // Found closing > for this tag
          tags.push(source.substring(tagStart, i + 1));
          pos = i + 1;
          break;
        }
      }
      i++;
    }

    if (i >= source.length) break; // malformed
  }

  return tags;
}

function extractInputTags(source: string): string[] {
  return extractTags(source, 'input');
}

function extractTextareaTags(source: string): string[] {
  return extractTags(source, 'textarea');
}

function extractFormTags(source: string): string[] {
  return extractTags(source, 'form');
}

describe('Contrato de autocomplete nos formularios de Cadastros', () => {
  describe('Todo campo de digitacao declara autoComplete', () => {
    for (const file of REGISTRY_FILES) {
      it(file, () => {
        const source = readSource(file);
        const inputs = extractInputTags(source);
        const textareas = extractTextareaTags(source);
        const allTags = [...inputs, ...textareas];

        for (const tag of allTags) {
          if (isExcludedInput(tag)) continue;

          // skip the Users.tsx search bar input (not in a modal)
          if (file === 'src/pages/Users.tsx' &&
              tag.includes('placeholder="Buscar por nome')) {
            continue;
          }

          const name = selfClosingTagName(tag);
          const compact = tag.replace(/\s+/g, ' ').substring(0, 150);

          expect(
            hasAutocompleteAttribute(tag),
            `${name ?? 'input'} sem autoComplete em ${file}: ${compact}`,
          ).toBe(true);

          const value = getAutoCompleteValue(tag);
          expect(
            value,
            `autoComplete="${value}" invalido em ${file}: ${compact}`,
          ).not.toBe('on');
        }
      });
    }
  });

  describe('Todo arquivo com <form> declara autoComplete="off" no form', () => {
    for (const file of FILES_WITH_FORM) {
      it(file, () => {
        const source = readSource(file);
        const forms = extractFormTags(source);

        expect(forms.length, `${file} nao possui <form>`).toBeGreaterThan(0);

        for (const form of forms) {
          const compact = form.replace(/\s+/g, ' ').substring(0, 150);

          expect(
            hasAutocompleteAttribute(form),
            `<form> sem autoComplete em ${file}: ${compact}`,
          ).toBe(true);

          const value = getAutoCompleteValue(form);
          expect(
            value,
            `<form> autoComplete="${value}" em vez de "off" em ${file}`,
          ).toBe('off');
        }
      });
    }
  });

  it('TireBatchForm.tsx nao possui <form> (excecao documentada)', () => {
    const source = readSource('src/components/TireBatchForm.tsx');
    const forms = extractFormTags(source);
    expect(forms.length).toBe(0);
  });

  it('campo de senha temporaria de DriverForm.tsx usa autoComplete="new-password"', () => {
    const source = readSource('src/components/DriverForm.tsx');
    const inputs = extractInputTags(source);

    const passwordField = inputs.find((tag) =>
      tag.includes('data-testid="password-input"'),
    );

    expect(passwordField, 'campo password-input nao encontrado').toBeDefined();
    expect(
      getAutoCompleteValue(passwordField!),
      'password-input deve usar autoComplete="new-password"',
    ).toBe('new-password');
  });

  it('PasswordField.tsx continua sem autoComplete="off" fixo (recebe por prop)', () => {
    const source = readSource('src/components/PasswordField.tsx');
    const inputs = extractInputTags(source);

    for (const tag of inputs) {
      const value = getAutoCompleteValue(tag);
      expect(
        value,
        `PasswordField.tsx nao deve ter autoComplete fixo "off": ${tag.substring(0, 120)}`,
      ).not.toBe('off');
    }
  });
});
