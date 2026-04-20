import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { BudgetItem } from './maintenanceMappers';
import { performOcr } from './ocr/ocrEngine';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const DEBUG = import.meta.env.VITE_DEBUG_OCR === '1';
const debug = (...args: unknown[]) => {
  if (DEBUG) console.log('[BudgetOCR]', ...args);
};

export interface BudgetExtractionResult {
  items: BudgetItem[];
  workshopOs?: string;
  currentKm?: number;
  method: 'regex' | 'gemini';
  warnings: string[];
}

// ─────────────────────────────────────────────────────────────
// PDF helpers
// ─────────────────────────────────────────────────────────────

async function extractPdfText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ');
    pages.push(pageText);
  }
  const fullText = pages.join('\n');
  debug('Texto extraído:\n', fullText);
  return fullText;
}

// ─────────────────────────────────────────────────────────────
// Sistemas conhecidos para classificação automática
// ─────────────────────────────────────────────────────────────

const KNOWN_SYSTEMS: [RegExp, string][] = [
  [/freio|pastilha|disco|lonas?|tambor|abs/i, 'Sistema de Freio'],
  [/motor|cabeçote|virabrequim|biela|pistão|válvula|filtro de óleo/i, 'Motor'],
  [/suspensão|amortecedor|mola|pivô|bandeja|barra estabilizadora/i, 'Suspensão'],
  [/câmbio|embreagem|transmissão|caixa de câmbio/i, 'Transmissão'],
  [/elétric|alternador|bateria|motor de partida|fusível|relé/i, 'Sistema Elétrico'],
  [/arrefecimento|radiador|termostato|bomba d[ae] água|ventoinha/i, 'Arrefecimento'],
  [/direção|caixa de direção|bomba hidráulica|terminal|bieleta/i, 'Direção'],
  [/ar.condicionado|compressor|evaporador|condensador|gás/i, 'Ar Condicionado'],
  [/pneu|rodas?|aro|alinhamento|balanceamento/i, 'Pneus e Rodas'],
  [/combustível|injetor|bico|bomba de combustível|filtro de combustível/i, 'Sistema de Combustível'],
  [/carroceria|lataria|funilaria|pintura|para.choque|espelho/i, 'Carroceria'],
  [/mão.de.obra|revisão|inspeção|troca de óleo|lubrificação/i, 'Mão de Obra'],
];

function inferSystem(itemName: string): string {
  for (const [pattern, system] of KNOWN_SYSTEMS) {
    if (pattern.test(itemName)) return system;
  }
  return '';
}

// ─────────────────────────────────────────────────────────────
// Extração por regex
// ─────────────────────────────────────────────────────────────

function parseNumber(s: string): number {
  // Remove separadores de milhar e normaliza decimal
  return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
}

function extractBudgetFromText(text: string): {
  items: BudgetItem[];
  workshopOs?: string;
  currentKm?: number;
} {
  const items: BudgetItem[] = [];
  let workshopOs: string | undefined;
  let currentKm: number | undefined;

  // OS da oficina
  const osPatterns = [
    /\bO\.?S\.?\s*[:#]?\s*(\w[\w\-\/]*)/i,
    /Ordem\s+de\s+Servi[çc]o\s*[:#]?\s*(\w[\w\-\/]*)/i,
  ];
  for (const pattern of osPatterns) {
    const m = text.match(pattern);
    if (m && m[1] && m[1].length >= 2) {
      workshopOs = m[1].trim();
      break;
    }
  }

  // Km atual
  const kmPatterns = [
    /(?:KM|Km|km)\s*(?:atual|odômetro|hodômetro)?\s*[:#]?\s*([\d.,]+)/i,
    /(?:quilometragem|hodômetro|odômetro)\s*[:#]?\s*([\d.,]+)/i,
  ];
  for (const pattern of kmPatterns) {
    const m = text.match(pattern);
    if (m && m[1]) {
      const km = parseNumber(m[1]);
      if (km > 0) { currentKm = Math.round(km); break; }
    }
  }

  // Itens: procurar linhas com padrão tabular
  // Tenta linha com: descrição + qtd + valor unitário (ex: "Pastilha de freio 2 180,00")
  const linePatterns = [
    // item  qtd  unit  total  (ex: "Disco de freio  2  120,00  240,00")
    /^(.{5,60}?)\s+(\d{1,3}(?:[.,]\d+)?)\s+([\d.,]+)\s+([\d.,]+)\s*$/,
    // item  qtd  valor (sem total)
    /^(.{5,60}?)\s+(\d{1,3}(?:[.,]\d+)?)\s+([\d.,]+)\s*$/,
    // item  valor (qtd implícita 1)
    /^(.{5,80}?)\s+([\d]{1,4}[.,]\d{2})\s*$/,
  ];

  const lines = text.split(/[\n\r]+/);
  let sortOrder = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 5) continue;

    // Ignora linhas que são claramente cabeçalhos ou totais
    if (/^(item|descrição|serviço|produto|quantidade|valor|total|subtotal|desconto|data|cliente|cnpj|endereço|fone|tel)/i.test(trimmed)) continue;
    if (/^(total geral|valor total|desconto|taxa)/i.test(trimmed)) continue;

    for (const pattern of linePatterns) {
      const m = trimmed.match(pattern);
      if (!m) continue;

      let itemName = '', quantity = 1, value = 0;

      if (pattern === linePatterns[0] && m[4]) {
        // item qtd unit total
        itemName = m[1].trim();
        quantity = parseNumber(m[2]);
        value = parseNumber(m[3]);
      } else if (pattern === linePatterns[1] && m[3]) {
        // item qtd valor
        itemName = m[1].trim();
        quantity = parseNumber(m[2]);
        value = parseNumber(m[3]);
      } else if (pattern === linePatterns[2] && m[2]) {
        // item valor
        itemName = m[1].trim();
        quantity = 1;
        value = parseNumber(m[2]);
      }

      if (itemName && itemName.length >= 4 && value > 0) {
        items.push({
          itemName,
          system: inferSystem(itemName),
          quantity: quantity || 1,
          value,
          sortOrder: sortOrder++,
        });
        break;
      }
    }
  }

  debug('Regex result:', { items: items.length, workshopOs, currentKm });
  return { items, workshopOs, currentKm };
}

// ─────────────────────────────────────────────────────────────
// Gemini fallback
// ─────────────────────────────────────────────────────────────

const BUDGET_PROMPT = `Você está analisando um orçamento/ordem de serviço de oficina automotiva.
Extraia as informações abaixo. Retorne SOMENTE JSON válido:
{
  "items": [{"item_name":"...","system":"...","quantity":1,"value":0.00}],
  "workshop_os": "número da OS da oficina ou null",
  "current_km": 12345
}
Regras:
- items.system = sistema do veículo (ex: Sistema de Freio, Motor, Suspensão...); null se não identificar.
- items.value = valor unitário do item em reais (número); 0 se não informado.
- workshop_os = número/código da ordem de serviço da oficina (campo OS, O.S., Ordem de Serviço); null se não encontrar.
- current_km = leitura do hodômetro/quilometragem atual do veículo (número inteiro); null se não constar.
- Ignore totais gerais, CNPJ, endereços e dados do cliente.
Retorne SOMENTE o JSON, sem markdown.`;

async function extractBudgetViaIA(file: File): Promise<BudgetExtractionResult> {
  const json = await performOcr(file, BUDGET_PROMPT);

  const items: BudgetItem[] = (json.items ?? []).map((it: any, idx: number) => ({
    itemName: String(it.item_name || ''),
    system: String(it.system || ''),
    quantity: Number(it.quantity) || 1,
    value: Number(it.value) || 0,
    sortOrder: idx,
  })).filter((it: BudgetItem) => it.itemName.length > 0);

  const workshopOs = json.workshop_os ? String(json.workshop_os) : undefined;
  const currentKm = json.current_km ? Math.round(Number(json.current_km)) : undefined;

  return { items, workshopOs, currentKm, method: 'gemini', warnings: [] };
}

// ─────────────────────────────────────────────────────────────
// Função exportada
// ─────────────────────────────────────────────────────────────

export async function extractBudgetData(file: File): Promise<BudgetExtractionResult> {
  try {
    if (file.type === 'application/pdf') {
      try {
        const text = await extractPdfText(file);
        if (text.trim().length > 30) {
          const { items, workshopOs, currentKm } = extractBudgetFromText(text);
          if (items.length >= 2) {
            debug('Usando regex ✓ — itens:', items.length);
            return { items, workshopOs, currentKm, method: 'regex', warnings: [] };
          }
          debug('Regex insuficiente → fallback Gemini');
        }
      } catch (err) {
        debug('Erro ao extrair texto PDF →', err, '→ fallback Gemini');
      }
    }

    debug('Chamando IA Vision...');
    return await extractBudgetViaIA(file);
  } catch (err) {
    debug('Falha total na extração:', err);
    return {
      items: [],
      method: 'gemini',
      warnings: ['Falha na extração automática. Preencha os itens manualmente.'],
    };
  }
}
