import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

import { validateOcrRequest, type ValidationSuccess } from "./validation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GEMINI_MODEL = "gemini-2.5-flash";

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Valida o Bearer contra o Supabase Auth e devolve o client já autenticado.
 * Fail closed: sem token válido, nada prossegue.
 */
async function authenticate(req: Request): Promise<
  { ok: true; supabase: SupabaseClient } | { ok: false; response: Response }
> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return { ok: false, response: json({ error: "Não autorizado" }, 401) };

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return { ok: false, response: json({ error: "Token inválido ou expirado" }, 401) };
  }

  return { ok: true, supabase };
}

interface QuotaResult {
  allowed: boolean;
  reason?: string;
  retry_after_seconds?: number;
}

/**
 * Reserva a cota do usuário ANTES da chamada ao Gemini.
 * A RPC é atômica e usa auth.uid() — o user_id nunca vem do cliente.
 */
async function reserveQuota(
  supabase: SupabaseClient,
  fileBytes: number,
): Promise<Response | null> {
  const { data, error } = await supabase.rpc("consume_gemini_ocr_quota", {
    p_file_bytes: fileBytes,
  });

  if (error) {
    console.error("[gemini-ocr] Falha ao consumir cota:", error.message);
    return json({ error: "Não foi possível validar o limite de uso." }, 500);
  }

  const quota = data as QuotaResult | null;
  if (!quota?.allowed) {
    if (quota?.reason === "unauthenticated") {
      return json({ error: "Não autorizado" }, 401);
    }
    if (quota?.reason === "invalid_size") {
      return json({ error: "Arquivo inválido para processamento." }, 400);
    }
    return json(
      {
        error: "Limite de uso do OCR atingido. Tente novamente mais tarde.",
        reason: quota?.reason,
        retry_after_seconds: quota?.retry_after_seconds,
      },
      429,
    );
  }

  return null;
}

/** Chama o Gemini com o documento em inlineData. */
async function callGemini(apiKey: string, request: ValidationSuccess): Promise<Response> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        role: "user",
        parts: [
          { inlineData: { data: request.fileBase64, mimeType: request.mimeType } },
          { text: request.prompt },
        ],
      }],
      generationConfig: { responseMimeType: "application/json" },
    }),
  });
}

/**
 * Converte a resposta do Gemini no JSON do contrato atual.
 * Logs registram apenas status — nunca o Base64, o prompt completo,
 * o conteúdo do documento ou a resposta completa do provedor.
 */
async function parseGeminiResponse(geminiRes: Response): Promise<Response> {
  if (!geminiRes.ok) {
    console.error(`[gemini-ocr] Gemini API error: ${geminiRes.status}`);
    return json({ error: "Serviço de leitura de documentos indisponível." }, 502);
  }

  const geminiData = await geminiRes.json();
  const raw = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!raw) return json({ error: "Não foi possível extrair dados do documento." }, 502);

  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

  try {
    return json({ result: JSON.parse(cleaned) }, 200);
  } catch {
    console.error("[gemini-ocr] Resposta do Gemini não é JSON válido.");
    return json({ error: "Não foi possível extrair dados do documento." }, 502);
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const auth = await authenticate(req);
    if (!auth.ok) return auth.response;

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) return json({ error: "Serviço de OCR não configurado." }, 500);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Requisição inválida." }, 400);
    }

    // Validação server-side é a autoridade real: tipo, assinatura,
    // Base64, tamanho e prompt são checados antes de qualquer custo.
    const validation = validateOcrRequest(body);
    if (!validation.ok) return json({ error: validation.message }, validation.status);

    const quotaDenial = await reserveQuota(auth.supabase, validation.fileBytes);
    if (quotaDenial) return quotaDenial;

    return await parseGeminiResponse(await callGemini(apiKey, validation));
  } catch (err) {
    console.error("[gemini-ocr] Erro inesperado:", err instanceof Error ? err.message : "desconhecido");
    return json({ error: "Erro inesperado ao processar o documento." }, 500);
  }
});
