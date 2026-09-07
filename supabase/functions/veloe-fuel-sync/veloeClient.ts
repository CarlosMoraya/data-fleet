// Camada HTTP da Veloe. Não conhece o Supabase nem o modelo `fuel_supplies`.

import type { VeloeSupplyRecord } from "./veloeMapping.ts";

export interface VeloeConfig {
  baseUrl: string;
  ibmClientId: string;
  ibmClientSecret: string;
  contract: string;
}

export interface SupplyHistoryParams {
  startDate: string;
  endDate: string;
  pageNumber: number;
  pageSize: number;
  /** Placas da frota, usadas apenas no fallback quando a API exige `vehiclePlates`. */
  plates: string[];
}

/** Obtém o accessToken da Veloe. Nunca inclui o corpo da resposta na mensagem de erro. */
export async function loginVeloe(config: VeloeConfig): Promise<string> {
  const response = await fetch(`${config.baseUrl}/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-ibm-client-secret": config.ibmClientSecret,
      "x-ibm-client-id": config.ibmClientId,
      "ClientId": config.ibmClientId,
    },
  });

  if (!response.ok) {
    console.error(`[veloe-fuel-sync] login falhou: ${response.status}`);
    throw new Error("veloe_login_failed");
  }

  const payload = await response.json() as { body?: { accessToken?: string } };
  const token = payload?.body?.accessToken;
  if (!token) {
    console.error("[veloe-fuel-sync] login falhou: accessToken ausente");
    throw new Error("veloe_login_failed");
  }
  return token;
}

/**
 * Busca uma página do histórico de abastecimento.
 *
 * O PDF v1.4.0 marca `vehiclePlates` como obrigatório na tabela de parâmetros,
 * mas o exemplo de request não o envia. Tenta primeiro sem o campo e, diante de
 * um 400, repete a mesma página com as placas da frota em lotes de até 200.
 */
export async function fetchSupplyHistoryPage(
  config: VeloeConfig,
  token: string,
  params: SupplyHistoryParams,
): Promise<VeloeSupplyRecord[]> {
  const url = `${config.baseUrl}/v1/supply-history-anp/contract/${config.contract}`;
  const headers = {
    "Content-Type": "application/json",
    // O PDF usa o token exatamente como devolvido pelo login, sem prefixo "Bearer".
    "Authorization": token,
    "x-ibm-client-secret": config.ibmClientSecret,
    "x-ibm-client-id": config.ibmClientId,
    "contract": config.contract,
  };
  const baseBody = {
    startDate: params.startDate,
    endDate: params.endDate,
    pageNumber: params.pageNumber,
    pageSize: params.pageSize,
    transactionStatus: "Aprovada",
  };

  const response = await fetch(url, { method: "POST", headers, body: JSON.stringify(baseBody) });

  if (response.status === 400) {
    console.log("[veloe-fuel-sync] fallback vehiclePlates ativado");
    const records: VeloeSupplyRecord[] = [];
    for (let start = 0; start < params.plates.length; start += 200) {
      const batch = params.plates.slice(start, start + 200);
      const batchResponse = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({ ...baseBody, vehiclePlates: batch }),
      });
      if (!batchResponse.ok) {
        console.error(`[veloe-fuel-sync] falha na consulta: ${batchResponse.status}`);
        throw new Error(`veloe_fetch_failed:${batchResponse.status}`);
      }
      records.push(...readRecords(await batchResponse.json()));
    }
    return records;
  }

  if (!response.ok) {
    console.error(`[veloe-fuel-sync] falha na consulta: ${response.status}`);
    throw new Error(`veloe_fetch_failed:${response.status}`);
  }

  return readRecords(await response.json());
}

function readRecords(payload: unknown): VeloeSupplyRecord[] {
  const body = (payload as { body?: unknown } | null)?.body;
  return Array.isArray(body) ? body as VeloeSupplyRecord[] : [];
}
