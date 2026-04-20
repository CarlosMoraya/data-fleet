import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Autenticar o caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autorizado" }, 401);

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) return json({ error: "GEMINI_API_KEY não configurada no servidor" }, 500);

    const body = await req.json();
    const { file_base64, mime_type, prompt } = body;

    if (!file_base64 || !prompt) {
      return json({ error: "file_base64 e prompt são obrigatórios." }, 400);
    }

    // Chamar Gemini API diretamente
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const geminiRes = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          role: "user",
          parts: [
            { inlineData: { data: file_base64, mimeType: mime_type || "application/pdf" } },
            { text: prompt },
          ],
        }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error(`[gemini-ocr] Gemini API error: ${geminiRes.status}`, errText);
      return json({ error: `Gemini API error: ${geminiRes.status}` }, 502);
    }

    const geminiData = await geminiRes.json();
    const raw = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    if (!raw) {
      return json({ error: "Gemini retornou resposta vazia." }, 502);
    }

    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    const result = JSON.parse(cleaned);

    return json({ result }, 200);
  } catch (err) {
    console.error(`[gemini-ocr] Erro inesperado:`, err);
    return json({ error: String(err) }, 500);
  }
});
