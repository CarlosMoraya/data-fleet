import * as fs from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";
import { parse } from "csv-parse/sync";

// ============================================================
// CONFIGURAÇÃO
// ============================================================
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const CLIENT_ID = "da9ad1ff-9a9a-43ba-96c5-05f14fd5f5b4"; // Deluna Transportes
const CSV_FILE = path.join(__dirname, "../public/Motoristas beta Fleet - Página1.csv");

// ============================================================
// INTERFACES
// ============================================================
interface DriverRecord {
  MOTORISTA: string;
  CPF: string;
  CONTATO: string;
  "E-mail": string;
}

interface DriverImportResult {
  name: string;
  cpf: string;
  email: string;
  password: string;
  status: "success" | "error";
  message: string;
  userId?: string;
  driverId?: string;
}

// ============================================================
// UTILITÁRIOS
// ============================================================
function removeCPFFormatting(cpf: string): string {
  return cpf.replace(/\D/g, "");
}

function generatePassword(cpf: string): string {
  const cleanCPF = removeCPFFormatting(cpf);
  const first6Digits = cleanCPF.substring(0, 6);
  return `Beta${first6Digits}`;
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  console.log("🚀 Iniciando importação em lote de motoristas...\n");

  // Validação de variáveis de ambiente
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error(
      "❌ Erro: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY não estão configuradas"
    );
    console.error(
      "   Execute: export SUPABASE_URL=... && export SUPABASE_SERVICE_ROLE_KEY=..."
    );
    process.exit(1);
  }

  // Inicializar cliente Supabase com chave admin
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Ler e parsear CSV
  console.log(`📄 Lendo arquivo CSV: ${CSV_FILE}`);
  if (!fs.existsSync(CSV_FILE)) {
    console.error(`❌ Arquivo não encontrado: ${CSV_FILE}`);
    process.exit(1);
  }

  const fileContent = fs.readFileSync(CSV_FILE, "utf-8");
  const records: DriverRecord[] = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
  });

  console.log(`✅ ${records.length} motoristas encontrados\n`);

  // Processar cada motorista
  const results: DriverImportResult[] = [];
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const name = record.MOTORISTA.trim();
    const cpf = removeCPFFormatting(record.CPF);
    const email = record["E-mail"].trim();
    const password = generatePassword(record.CPF);

    console.log(
      `[${i + 1}/${records.length}] ${name} (${email}) - CPF: ${cpf}...`
    );

    try {
      // Verificar se motorista já existe (CPF único por cliente)
      const { data: existingDriver } = await supabase
        .from("drivers")
        .select("id")
        .eq("client_id", CLIENT_ID)
        .eq("cpf", cpf)
        .single();

      if (existingDriver) {
        console.log(`   ⚠️  Motorista já existe com este CPF\n`);
        results.push({
          name,
          cpf,
          email,
          password,
          status: "error",
          message: "CPF já existe para este cliente",
        });
        errorCount++;
        continue;
      }

      // Criar usuário no Auth
      const { data: authUser, error: authError } =
        await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true, // Confirmar email automaticamente
        });

      if (authError) {
        console.log(`   ❌ Erro ao criar usuário: ${authError.message}\n`);
        results.push({
          name,
          cpf,
          email,
          password,
          status: "error",
          message: `Auth error: ${authError.message}`,
        });
        errorCount++;
        continue;
      }

      const authUserId = authUser?.user?.id;
      if (!authUserId) {
        console.log("   ❌ Erro ao criar usuário: ID do usuário não retornado\n");
        results.push({
          name,
          cpf,
          email,
          password,
          status: "error",
          message: "Auth error: user id não retornado",
        });
        errorCount++;
        continue;
      }

      // Garantir profile para o usuário recém-criado (evita inconsistência auth.users x public.profiles)
      const { error: profileError } = await supabase.from("profiles").upsert({
        id: authUserId,
        name,
        role: "Driver",
        client_id: CLIENT_ID,
      });

      if (profileError) {
        console.log(`   ❌ Erro ao criar profile: ${profileError.message}\n`);
        results.push({
          name,
          cpf,
          email,
          password,
          status: "error",
          message: `Profile upsert error: ${profileError.message}`,
          userId: authUserId,
        });
        errorCount++;
        continue;
      }

      // Inserir motorista em drivers
      const { data: driver, error: driverError } = await supabase
        .from("drivers")
        .insert({
          client_id: CLIENT_ID,
          name,
          cpf,
          profile_id: authUserId,
        })
        .select("id")
        .single();

      if (driverError) {
        console.log(`   ❌ Erro ao criar motorista: ${driverError.message}\n`);
        results.push({
          name,
          cpf,
          email,
          password,
          status: "error",
          message: `Driver insert error: ${driverError.message}`,
          userId: authUserId,
        });
        errorCount++;
        continue;
      }

      console.log(`   ✅ Motorista criado com sucesso\n`);
      results.push({
        name,
        cpf,
        email,
        password,
        status: "success",
        message: "Motorista e usuário criados",
        userId: authUserId,
        driverId: driver?.id,
      });
      successCount++;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`   ❌ Erro inesperado: ${errorMessage}\n`);
      results.push({
        name,
        cpf,
        email,
        password,
        status: "error",
        message: `Erro inesperado: ${errorMessage}`,
      });
      errorCount++;
    }
  }

  // ============================================================
  // RELATÓRIO
  // ============================================================
  console.log("\n" + "=".repeat(60));
  console.log("📊 RELATÓRIO DE IMPORTAÇÃO");
  console.log("=".repeat(60));
  console.log(`✅ Sucesso: ${successCount}/${records.length}`);
  console.log(`❌ Erros: ${errorCount}/${records.length}\n`);

  // Salvar relatório em arquivo
  const reportPath = path.join(
    __dirname,
    `../import-report-${new Date().toISOString().split("T")[0]}.json`
  );
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`💾 Relatório salvo em: ${reportPath}`);

  // Resumo de erros
  const errors = results.filter((r) => r.status === "error");
  if (errors.length > 0) {
    console.log("\n⚠️  Motoristas com erro:");
    errors.forEach((error) => {
      console.log(`   - ${error.name}: ${error.message}`);
    });
  }

  // Mostrar alguns sucessos
  const successes = results.filter((r) => r.status === "success").slice(0, 3);
  if (successes.length > 0) {
    console.log("\n✅ Exemplos de motoristas criados:");
    successes.forEach((success) => {
      console.log(`   - ${success.name} (${success.email})`);
      console.log(`     Senha: ${success.password}`);
    });
  }

  process.exit(errorCount > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error("❌ Erro fatal:", error);
  process.exit(1);
});
