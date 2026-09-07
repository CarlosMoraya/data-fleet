// Carga histórica única do módulo de Abastecimento: invoca a Edge Function
// `veloe-fuel-sync` mês a mês, cobrindo os 12 meses anteriores ao mês corrente.
//
// Toda escrita passa pela Edge Function — este script nunca toca a tabela
// `fuel_supplies` diretamente e não conhece nenhuma credencial Veloe.
//
// Uso:
//   npx tsx scripts/backfill-veloe-fuel.ts           # dry-run: lista as 12 janelas
//   npx tsx scripts/backfill-veloe-fuel.ts --apply   # executa

import * as path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const APPLY = process.argv.includes("--apply");
const DELAY_MS = 3000;
const MONTHS = 12;

interface MonthWindow {
  label: string;
  startDate: string;
  endDate: string;
}

function formatVeloeDate(date: Date): string {
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getUTCFullYear()}`;
}

/** Os 12 meses anteriores ao mês corrente, do mais antigo para o mais recente. */
function buildWindows(): MonthWindow[] {
  const now = new Date();
  const windows: MonthWindow[] = [];

  for (let offset = MONTHS; offset >= 1; offset--) {
    const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
    const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0));
    windows.push({
      label: `${String(first.getUTCMonth() + 1).padStart(2, "0")}/${first.getUTCFullYear()}`,
      startDate: formatVeloeDate(first),
      endDate: formatVeloeDate(last),
    });
  }

  return windows;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const windows = buildWindows();

  console.log(`Carga histórica de abastecimento — ${windows.length} janelas mensais\n`);
  for (const window of windows) {
    console.log(`  ${window.label}: ${window.startDate} → ${window.endDate}`);
  }
  console.log("");

  if (!APPLY) {
    console.log("🔍 Dry-run concluído. Rode novamente com --apply para executar a carga.");
    return;
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error("❌ SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios em .env.local");
    process.exit(1);
  }

  const url = `${SUPABASE_URL}/functions/v1/veloe-fuel-sync`;
  let ok = 0;
  let fail = 0;

  for (const [index, window] of windows.entries()) {
    if (index > 0) await sleep(DELAY_MS);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ startDate: window.startDate, endDate: window.endDate }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        fail++;
        console.error(`❌ ${window.label}: HTTP ${response.status} ${JSON.stringify(payload)}`);
        continue;
      }

      ok++;
      const summary = payload as {
        fetched: number;
        upserted: number;
        skipped: number;
        unmatchedPlates: number;
      };
      console.log(
        `✅ ${window.label}: fetched=${summary.fetched} upserted=${summary.upserted} ` +
          `skipped=${summary.skipped} unmatchedPlates=${summary.unmatchedPlates}`,
      );
    } catch (error) {
      fail++;
      console.error(`❌ ${window.label}: ${error instanceof Error ? error.message : "erro"}`);
    }
  }

  console.log(`\nJanelas processadas: ${ok} | Falhas: ${fail}`);
  if (fail > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error("❌ Erro inesperado:", err);
  process.exit(1);
});
