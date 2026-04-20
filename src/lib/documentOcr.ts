import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { Vehicle, Driver } from '../types';
import { performOcr } from './ocr/ocrEngine';
import {
  filterDigitsOnly,
  filterPlate,
  filterAlpha,
  filterAlphanumeric,
  filterCPF,
  filterCNHCategory,
  normalizeUpper,
  capitalizeWords,
} from './inputHelpers';

// Usa o worker local (bundlado pelo Vite) para evitar dependência de CDN
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

// ─────────────────────────────────────────────────────────────
// Debug logging — ative com VITE_DEBUG_OCR=1 no .env
// ─────────────────────────────────────────────────────────────
const DEBUG = import.meta.env.VITE_DEBUG_OCR === '1';
const ocrDebug = (...args: unknown[]) => {
  if (DEBUG) console.log('[OCR]', ...args);
};

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type ExtractionStatus = 'idle' | 'extracting' | 'success' | 'partial' | 'failed';

export interface ExtractionResult<T> {
  data: Partial<T>;
  fieldCount: number;
  totalFields: number;
  method: 'regex' | 'gemini';
  warnings: string[];
}

// ─────────────────────────────────────────────────────────────
// Helpers de arquivo
// ─────────────────────────────────────────────────────────────

async function extractPdfText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    // Log individual text items para ver estrutura real do PDF
    ocrDebug(`PDF página ${i} — ${content.items.length} itens de texto:`);
    content.items.forEach((item, idx) => {
      if ('str' in item && item.str.trim()) {
        ocrDebug(`  [${idx}] "${item.str}"`);
      }
    });
    const pageText = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ');
    pages.push(pageText);
  }
  const fullText = pages.join('\n');
  ocrDebug('Texto completo extraído do PDF:\n', fullText);
  return fullText;
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove o prefixo "data:...;base64,"
      resolve(result.split(',')[1]);
    };
    reader.onerror = () => reject(new Error('Falha ao ler arquivo'));
    reader.readAsDataURL(file);
  });
}

/** Converte "31/12/2025" → "2025-12-31" (formato aceito pelo input type="date") */
function brDateToIso(value: string): string {
  const match = value.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return '';
  return `${match[3]}-${match[2]}-${match[1]}`;
}

// ─────────────────────────────────────────────────────────────
// Extração por regex — CRLV
// ─────────────────────────────────────────────────────────────

function extractCrlvFromText(text: string): Partial<Vehicle> {
  const result: Partial<Vehicle> = {};
  const t = text.toUpperCase();

  const tryMatch = (regex: RegExp): string | null => {
    const m = t.match(regex);
    return m ? m[1].trim() : null;
  };

  // Placa
  const plate = tryMatch(/PLACA\s*[:\-]?\s*([A-Z]{3}\d[A-Z0-9]\d{2})/);
  if (plate) result.licensePlate = filterPlate(plate);

  // Renavam
  const renavam = tryMatch(/(?:C[OÓ]D(?:IGO)?\.?\s*RENAVAM|RENAVAM)\s*[:\-]?\s*(\d{9,11})/);
  if (renavam) result.renavam = filterDigitsOnly(renavam);

  // Exercício CRLV
  const exercicio = tryMatch(/EXERC[IÍ]CIO\s*[:\-]?\s*(\d{4})/);
  if (exercicio) result.crlvYear = exercicio;

  // Ano de fabricação
  const ano = tryMatch(/ANO\s*(?:DE\s*)?FABRICA[CÇ][AÃ]O\s*[:\-]?\s*(\d{4})/);
  if (ano) {
    const yr = parseInt(ano, 10);
    if (!isNaN(yr)) result.year = yr;
  }

  // Marca / Modelo / Versão — vem junto no mesmo campo
  const marcaModelo = tryMatch(/MARCA\s*[/\\]\s*MODELO\s*[/\\]\s*VERS[AÃ]O\s*[:\-]?\s*([^\n]+)/);
  if (marcaModelo) {
    const parts = marcaModelo.split('/').map(s => s.trim()).filter(Boolean);
    if (parts[0]) result.brand = normalizeUpper(parts[0]);
    if (parts[1]) result.model = normalizeUpper(parts.slice(1).join(' '));
  }

  // Chassi (17 chars alfanuméricos)
  const chassi = tryMatch(/CHASSI\s*[:\-]?\s*([A-Z0-9]{17})/);
  if (chassi) result.chassi = filterAlphanumeric(chassi, 17);

  // Cor predominante
  const cor = tryMatch(/COR\s*PREDOMINANTE\s*[:\-]?\s*([A-ZÀ-Ú\s]{3,20})/);
  if (cor) result.color = capitalizeWords(cor.replace(/\s+/g, ' ').trim());

  // PBT
  const pbt = tryMatch(/(?:PESO\s*BRUTO\s*TOTAL|PBT)\s*[:\-]?\s*([\d.,]+)/);
  if (pbt) {
    const n = parseFloat(pbt.replace(',', '.'));
    if (!isNaN(n)) result.pbt = n;
  }

  // CMT
  const cmt = tryMatch(/CMT\s*[:\-]?\s*([\d.,]+)/);
  if (cmt) {
    const n = parseFloat(cmt.replace(',', '.'));
    if (!isNaN(n)) result.cmt = n;
  }

  // Eixos
  const eixos = tryMatch(/EIXOS?\s*[:\-]?\s*(\d{1,2})/);
  if (eixos) {
    const n = parseInt(eixos, 10);
    if (!isNaN(n)) result.eixos = n;
  }

  // Detran UF — captura apenas a sigla de 2 letras no campo LOCAL
  const local = tryMatch(/LOCAL\s*[:\-]?\s*(?:[A-Z\s]*?\s)?([A-Z]{2})(?:\s|$)/);
  if (local) result.detranUF = filterAlpha(local, 2);

  ocrDebug('CRLV regex resultado:', {
    licensePlate: result.licensePlate ?? '✗',
    renavam: result.renavam ?? '✗',
    crlvYear: result.crlvYear ?? '✗',
    year: result.year ?? '✗',
    brand: result.brand ?? '✗',
    model: result.model ?? '✗',
    chassi: result.chassi ?? '✗',
    color: result.color ?? '✗',
    pbt: result.pbt ?? '✗',
    cmt: result.cmt ?? '✗',
    eixos: result.eixos ?? '✗',
    detranUF: result.detranUF ?? '✗',
  });

  return result;
}

// ─────────────────────────────────────────────────────────────
// Extração por regex — CNH
// ─────────────────────────────────────────────────────────────

function extractCnhFromText(text: string): Partial<Driver> {
  const result: Partial<Driver> = {};
  const t = text.toUpperCase();

  const tryMatch = (regex: RegExp, original = false): string | null => {
    const m = (original ? text : t).match(regex);
    return m ? m[1].trim() : null;
  };

  // Nome (preservar capitalização original)
  const nome = tryMatch(/NOME\s*(?:E\s*SOBRENOME)?\s*[:\-]?\s*([A-ZÀ-Ú\s]{3,60})/, true);
  if (nome) result.name = capitalizeWords(nome);

  // CPF (aceita pontos e traços)
  const cpf = tryMatch(/CPF\s*[:\-]?\s*([\d.–\-\s]{11,14})/);
  if (cpf) result.cpf = filterCPF(cpf);

  // Data de emissão
  const emissao = tryMatch(/(?:DATA\s*(?:DE\s*)?EMISS[AÃ]O|1ª\s*EMISS[AÃ]O)\s*[:\-]?\s*(\d{2}\/\d{2}\/\d{4})/);
  if (emissao) result.issueDate = brDateToIso(emissao);

  // Validade
  const validade = tryMatch(/VALIDADE\s*[:\-]?\s*(\d{2}\/\d{2}\/\d{4})/);
  if (validade) result.expirationDate = brDateToIso(validade);

  // Nº de Registro
  const registro = tryMatch(/(?:N[°º]\s*REGISTRO|REGISTRO)\s*[:\-]?\s*(\d{8,11})/);
  if (registro) result.registrationNumber = filterDigitsOnly(registro);

  // Categoria HAB
  const categoria = tryMatch(/CAT(?:EGORIA)?\s*(?:HAB(?:ILITA[ÇC][ÃA]O)?)?\s*[:\-]?\s*([A-Ea-e]{1,5})/);
  if (categoria) result.category = filterCNHCategory(categoria);

  // Renach — número alfanumérico
  const renach = tryMatch(/RENACH\s*[:\-]?\s*([A-Z0-9]{8,20})/);
  if (renach) result.renach = filterAlphanumeric(renach);

  ocrDebug('CNH regex resultado:', {
    name: result.name ?? '✗',
    cpf: result.cpf ?? '✗',
    issueDate: result.issueDate ?? '✗',
    expirationDate: result.expirationDate ?? '✗',
    registrationNumber: result.registrationNumber ?? '✗',
    category: result.category ?? '✗',
    renach: result.renach ?? '✗',
  });

  return result;
}

// ─────────────────────────────────────────────────────────────
// Gemini Vision — CRLV
// ─────────────────────────────────────────────────────────────

const CRLV_PROMPT = `Extraia os seguintes campos deste documento CRLV (Certificado de Registro e Licenciamento de Veículo) brasileiro.
Retorne APENAS um JSON válido com estas chaves (use null se não encontrar o campo):
{
  "placa": "ABC1D23",
  "renavam": "12345678901",
  "exercicio": "2025",
  "anoFabricacao": "2020",
  "marca": "FIAT",
  "modelo": "STRADA FREEDOM",
  "chassi": "9BD19648BN0123456",
  "cor": "Branca",
  "pbt": "2.100",
  "cmt": "0",
  "eixos": "2",
  "localUF": "SP"
}
Regras:
- "placa": formato Mercosul (ABC1D23) ou antigo (ABC1234), sem traços
- "renavam": somente dígitos (9-11 chars)
- "localUF": apenas a sigla UF (2 letras) do campo LOCAL, ex: SP, RJ, MG
- "marca" e "modelo": separar do campo MARCA/MODELO/VERSÃO (antes e depois da primeira barra)
- "pbt" e "cmt": valor numérico com ponto decimal
- "cor": primeira letra maiúscula
- Não inclua campos extras. Retorne SOMENTE o JSON, sem markdown.`;

async function extractCrlvViaIA(file: File): Promise<Partial<Vehicle>> {
  const json = await performOcr(file, CRLV_PROMPT);

  const result: Partial<Vehicle> = {};
  if (json.placa) result.licensePlate = filterPlate(String(json.placa));
  if (json.renavam) result.renavam = filterDigitsOnly(String(json.renavam));
  if (json.exercicio) result.crlvYear = String(json.exercicio).slice(0, 4);
  if (json.anoFabricacao) {
    const yr = parseInt(String(json.anoFabricacao).slice(0, 4), 10);
    if (!isNaN(yr)) result.year = yr;
  }
  if (json.marca) result.brand = normalizeUpper(String(json.marca));
  if (json.modelo) result.model = normalizeUpper(String(json.modelo));
  if (json.chassi) result.chassi = filterAlphanumeric(String(json.chassi), 17);
  if (json.cor) result.color = capitalizeWords(String(json.cor));
  if (json.pbt) {
    const n = parseFloat(String(json.pbt).replace(',', '.'));
    if (!isNaN(n)) result.pbt = n;
  }
  if (json.cmt) {
    const n = parseFloat(String(json.cmt).replace(',', '.'));
    if (!isNaN(n)) result.cmt = n;
  }
  if (json.eixos) {
    const n = parseInt(String(json.eixos), 10);
    if (!isNaN(n)) result.eixos = n;
  }
  if (json.localUF) result.detranUF = filterAlpha(String(json.localUF), 2);

  return result;
}

// ─────────────────────────────────────────────────────────────
// Gemini Vision — CNH
// ─────────────────────────────────────────────────────────────

const CNH_PROMPT = `Extraia os seguintes campos desta CNH (Carteira Nacional de Habilitação) brasileira.
Retorne APENAS um JSON válido com estas chaves (use null se não encontrar o campo):
{
  "nome": "João da Silva",
  "cpf": "12345678901",
  "dataEmissao": "31/12/2020",
  "validade": "31/12/2030",
  "registro": "12345678901",
  "categoria": "AB",
  "renach": "SP123456789"
}
Regras:
- "cpf": somente 11 dígitos, sem pontos ou traços
- "dataEmissao" e "validade": formato DD/MM/AAAA
- "categoria": letras A-E apenas (ex: A, B, AB, AE, ABCDE)
- "registro": somente dígitos (Nº de Registro)
- "renach": número alfanumérico na lateral esquerda do documento (em posição vertical)
- "nome": nome completo como aparece no documento
- Não inclua campos extras. Retorne SOMENTE o JSON, sem markdown.`;

async function extractCnhViaIA(file: File): Promise<Partial<Driver>> {
  const json = await performOcr(file, CNH_PROMPT);

  const result: Partial<Driver> = {};
  if (json.nome) result.name = capitalizeWords(String(json.nome));
  if (json.cpf) result.cpf = filterCPF(String(json.cpf));
  if (json.dataEmissao) result.issueDate = brDateToIso(String(json.dataEmissao));
  if (json.validade) result.expirationDate = brDateToIso(String(json.validade));
  if (json.registro) result.registrationNumber = filterDigitsOnly(String(json.registro));
  if (json.categoria) result.category = filterCNHCategory(String(json.categoria));
  if (json.renach) result.renach = filterAlphanumeric(String(json.renach));

  return result;
}

// ─────────────────────────────────────────────────────────────
// Contagem de campos extraídos
// ─────────────────────────────────────────────────────────────

const CRLV_FIELDS: (keyof Vehicle)[] = [
  'licensePlate', 'renavam', 'crlvYear', 'year', 'brand', 'model',
  'chassi', 'color', 'pbt', 'cmt', 'eixos', 'detranUF',
];

const CNH_FIELDS: (keyof Driver)[] = [
  'name', 'cpf', 'issueDate', 'expirationDate', 'registrationNumber', 'category', 'renach',
];

function countFields<T>(data: Partial<T>, fields: (keyof T)[]): { count: number; missing: string[] } {
  let count = 0;
  const missing: string[] = [];
  for (const field of fields) {
    const val = data[field];
    if (val !== undefined && val !== null && val !== '') {
      count++;
    } else {
      missing.push(String(field));
    }
  }
  return { count, missing };
}

// ─────────────────────────────────────────────────────────────
// Funções exportadas
// ─────────────────────────────────────────────────────────────

export async function extractCrlvData(file: File): Promise<ExtractionResult<Vehicle>> {
  const totalFields = CRLV_FIELDS.length;

  try {
    // PDFs: tenta regex primeiro
    if (file.type === 'application/pdf') {
      try {
        const text = await extractPdfText(file);
        ocrDebug(`CRLV PDF: ${text.trim().length} chars extraídos`);
        if (text.trim().length > 50) {
          const regexData = extractCrlvFromText(text);
          const { count, missing } = countFields(regexData, CRLV_FIELDS);
          ocrDebug(`CRLV regex: ${count}/${totalFields} campos (mínimo 8). Faltando: ${missing.join(', ') || 'nenhum'}`);
          // Se extraiu pelo menos 8 de 12 campos, considera suficiente
          if (count >= 8) {
            ocrDebug('CRLV: usando regex ✓');
            return {
              data: regexData,
              fieldCount: count,
              totalFields,
              method: 'regex',
              warnings: missing,
            };
          }
          ocrDebug('CRLV: regex insuficiente → fallback Gemini');
        } else {
          ocrDebug('CRLV: texto muito curto → fallback Gemini');
        }
      } catch (err) {
        ocrDebug('CRLV: erro na extração de texto PDF →', err, '→ fallback Gemini');
      }
    }

    // Imagens ou PDF com regex insuficiente → IA Vision
    ocrDebug('Chamando IA Vision...');
    const data = await extractCrlvViaIA(file);
    const { count, missing } = countFields(data, CRLV_FIELDS);
    return {
      data,
      fieldCount: count,
      totalFields,
      method: 'gemini', // Mantemos 'gemini' no tipo por agora, mas o motor é dinâmico
      warnings: missing,
    };
  } catch (err) {
    console.error("OCR FALHOU:", err);
    return {
      data: {},
      fieldCount: 0,
      totalFields,
      method: 'gemini',
      warnings: ['Falha na extração automática'],
    };
  }
}

export async function extractCnhData(file: File): Promise<ExtractionResult<Driver>> {
  const totalFields = CNH_FIELDS.length;

  try {
    // PDFs: tenta regex primeiro
    if (file.type === 'application/pdf') {
      try {
        const text = await extractPdfText(file);
        ocrDebug(`CNH PDF: ${text.trim().length} chars extraídos`);
        if (text.trim().length > 50) {
          const regexData = extractCnhFromText(text);
          const { count, missing } = countFields(regexData, CNH_FIELDS);
          ocrDebug(`CNH regex: ${count}/${totalFields} campos (mínimo 5). Faltando: ${missing.join(', ') || 'nenhum'}`);
          // Se extraiu pelo menos 5 de 7 campos, considera suficiente
          if (count >= 5) {
            ocrDebug('CNH: usando regex ✓');
            return {
              data: regexData,
              fieldCount: count,
              totalFields,
              method: 'regex',
              warnings: missing,
            };
          }
          ocrDebug('CNH: regex insuficiente → fallback Gemini');
        } else {
          ocrDebug('CNH: texto muito curto → fallback Gemini');
        }
      } catch (err) {
        ocrDebug('CNH: erro na extração de texto PDF →', err, '→ fallback Gemini');
      }
    }

    // Imagens ou PDF com regex insuficiente → IA Vision
    ocrDebug('Chamando IA Vision...');
    const data = await extractCnhViaIA(file);
    const { count, missing } = countFields(data, CNH_FIELDS);
    return {
      data,
      fieldCount: count,
      totalFields,
      method: 'gemini',
      warnings: missing,
    };
  } catch (err) {
    console.error("OCR FALHOU:", err);
    return {
      data: {},
      fieldCount: 0,
      totalFields,
      method: 'gemini',
      warnings: ['Falha na extração automática'],
    };
  }
}
