#!/usr/bin/env node

/*
 * This diagnostic intentionally uses an invalid token. It is read-only: it
 * does not create a session, send an email, or change anything.
 */

const INVALID_TOKEN = "diagnostic-invalid-token";

const DEFAULT_SCENARIOS = [
  {
    name: "prod",
    projectRef: "oajfjdadcicgoxrfrnny",
    expectedBaseUrl: "https://app.betafleet.com.br",
  },
  {
    name: "dev",
    projectRef: "vvbnbzzhpiksacqudmfu",
    expectedBaseUrl: "http://localhost:3000",
  },
];

function usage() {
  console.error(
    "Uso: node scripts/check-auth-redirect-urls.mjs [project-ref base-url]",
  );
  console.error(
    "Ou defina SUPABASE_PROJECT_REF e SUPABASE_EXPECTED_BASE_URL para um cenário.",
  );
}

function normalizeBaseUrl(value) {
  const baseUrl = value.trim().replace(/\/+$/, "");

  if (!baseUrl) {
    throw new Error("a base URL esperada não pode ser vazia");
  }

  try {
    const parsed = new URL(baseUrl);
    if (!parsed.protocol || !parsed.host) {
      throw new Error("URL inválida");
    }
  } catch {
    throw new Error(`base URL esperada inválida: ${value}`);
  }

  return baseUrl;
}

function getScenarios() {
  const args = process.argv.slice(2);

  if (args.length !== 0 && args.length !== 2) {
    usage();
    throw new Error("informe exatamente project-ref e base URL, ou nenhum argumento");
  }

  if (args.length === 2) {
    return [
      {
        name: "custom",
        projectRef: args[0],
        expectedBaseUrl: normalizeBaseUrl(args[1]),
      },
    ];
  }

  const projectRef = process.env.SUPABASE_PROJECT_REF;
  const expectedBaseUrl = process.env.SUPABASE_EXPECTED_BASE_URL;

  if (projectRef || expectedBaseUrl) {
    if (!projectRef || !expectedBaseUrl) {
      usage();
      throw new Error(
        "SUPABASE_PROJECT_REF e SUPABASE_EXPECTED_BASE_URL devem ser informadas juntas",
      );
    }

    return [
      {
        name: "custom",
        projectRef,
        expectedBaseUrl: normalizeBaseUrl(expectedBaseUrl),
      },
    ];
  }

  return DEFAULT_SCENARIOS.map((scenario) => ({
    ...scenario,
    expectedBaseUrl: normalizeBaseUrl(scenario.expectedBaseUrl),
  }));
}

function buildVerifyUrl(projectRef, expectedBaseUrl, redirectTo) {
  const url = new URL(
    `https://${projectRef}.supabase.co/auth/v1/verify`,
  );
  url.searchParams.set("token", INVALID_TOKEN);
  url.searchParams.set("type", "recovery");

  if (redirectTo) {
    url.searchParams.set(
      "redirect_to",
      `${expectedBaseUrl}/redefinir-senha`,
    );
  }

  return url;
}

async function readLocation(url) {
  const response = await fetch(url, {
    method: "GET",
    redirect: "manual",
  });

  return response.headers.get("location");
}

function printCheck({ label, location, expectedPrefix, error }) {
  const observed = error
    ? `erro na requisição: ${error.message}`
    : location ?? "(header Location ausente)";
  const ok = !error && location?.startsWith(expectedPrefix);

  console.log(`  ${label}: ${ok ? "OK" : "FALHA"}`);
  console.log(`    observado: ${observed}`);
  console.log(`    esperado: começa com ${expectedPrefix}`);

  return ok;
}

async function checkScenario(scenario) {
  const { name, projectRef, expectedBaseUrl } = scenario;
  const redirectUrl = buildVerifyUrl(projectRef, expectedBaseUrl, true);
  const siteUrl = buildVerifyUrl(projectRef, expectedBaseUrl, false);

  console.log(`\n[${name}] project ref: ${projectRef}`);

  let redirectLocation;
  let redirectError;
  try {
    redirectLocation = await readLocation(redirectUrl);
  } catch (error) {
    redirectError = error;
  }

  let siteLocation;
  let siteError;
  try {
    siteLocation = await readLocation(siteUrl);
  } catch (error) {
    siteError = error;
  }

  const redirectOk = printCheck({
    label: "com redirect_to",
    location: redirectLocation,
    expectedPrefix: `${expectedBaseUrl}/redefinir-senha`,
    error: redirectError,
  });
  const siteOk = printCheck({
    label: "sem redirect_to",
    location: siteLocation,
    expectedPrefix: expectedBaseUrl,
    error: siteError,
  });

  return redirectOk && siteOk;
}

async function main() {
  const scenarios = getScenarios();
  let allPassed = true;

  for (const scenario of scenarios) {
    const passed = await checkScenario(scenario);
    allPassed = passed && allPassed;
  }

  if (!allPassed) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`\nErro: ${error.message}`);
  process.exitCode = 1;
});
