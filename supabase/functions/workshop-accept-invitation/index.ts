import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const body = await req.json();
    const { token, cnpj, email, password, name } = body;

    if (!token) return json({ error: "token é obrigatório" }, 400);

    // ─── 1. Validar token ─────────────────────────────────────
    const { data: invitationRaw } = await supabaseAdmin
      .from("workshop_invitations")
      .select("id, client_id, status, expires_at")
      .eq("token", token)
      .single();

    if (!invitationRaw) return json({ error: "Token não encontrado" }, 404);
    if (invitationRaw.status !== "pending") return json({ error: "Convite já utilizado ou revogado" }, 400);
    if (new Date(invitationRaw.expires_at) < new Date()) {
      await supabaseAdmin.from("workshop_invitations").update({ status: "expired" }).eq("id", invitationRaw.id);
      return json({ error: "Convite expirado" }, 400);
    }

    const clientId: string = invitationRaw.client_id;

    // ─── 2. Verificar se usuário já está autenticado ──────────
    const authHeader = req.headers.get("Authorization");
    let existingProfileId: string | null = null;

    if (authHeader) {
      const authToken = authHeader.replace("Bearer ", "");
      const { data: { user: caller } } = await supabaseAdmin.auth.getUser(authToken);
      if (caller) {
        const { data: callerProfile } = await supabaseAdmin
          .from("profiles")
          .select("role, workshop_account_id")
          .eq("id", caller.id)
          .single();
        if (callerProfile?.role === "Workshop") {
          existingProfileId = caller.id;
        }
      }
    }

    let workshopAccountId: string;
    let profileId: string;

    if (existingProfileId) {
      // ─── Caminho A: Oficina já autenticada ─────────────────
      // Buscar workshop_account existente
      const { data: wa } = await supabaseAdmin
        .from("workshop_accounts")
        .select("id")
        .eq("profile_id", existingProfileId)
        .single();

      if (!wa) return json({ error: "Conta de oficina não encontrada para este usuário" }, 404);

      workshopAccountId = wa.id;
      profileId = existingProfileId;
    } else {
      // ─── Caminho B: Nova oficina ou CNPJ já existe ──────────
      if (!cnpj || !email || !password || !name) {
        return json({ error: "Para nova oficina, forneça: cnpj, email, password, name" }, 400);
      }

      const cleanCnpj = cnpj.replace(/\D/g, "");

      // Verificar se CNPJ já tem conta
      const { data: existingWa } = await supabaseAdmin
        .from("workshop_accounts")
        .select("id, profile_id")
        .eq("cnpj", cleanCnpj)
        .single();

      if (existingWa) {
        // CNPJ já existe — só criar a nova partnership
        workshopAccountId = existingWa.id;
        profileId = existingWa.profile_id;
      } else {
        // Criar conta completamente nova

        // Criar Supabase Auth user
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });

        if (createError) return json({ error: createError.message }, 400);

        profileId = newUser.user.id;

        // Criar profile (client_id = NULL, como Admin Master)
        const { error: profileError } = await supabaseAdmin
          .from("profiles")
          .insert({
            id: profileId,
            name,
            role: "Workshop",
            client_id: null,
            can_delete_vehicles: false,
            can_delete_drivers: false,
            can_delete_workshops: false,
          });

        if (profileError) {
          await supabaseAdmin.auth.admin.deleteUser(profileId);
          return json({ error: profileError.message }, 400);
        }

        // Criar workshop_account
        const { data: newWa, error: waError } = await supabaseAdmin
          .from("workshop_accounts")
          .insert({
            profile_id: profileId,
            name,
            cnpj: cleanCnpj,
            email,
            active: true,
          })
          .select("id")
          .single();

        if (waError) {
          await supabaseAdmin.auth.admin.deleteUser(profileId);
          return json({ error: waError.message }, 400);
        }

        workshopAccountId = newWa.id;

        // Atualizar profile com workshop_account_id
        await supabaseAdmin
          .from("profiles")
          .update({ workshop_account_id: workshopAccountId })
          .eq("id", profileId);
      }
    }

    // ─── 3. Verificar se partnership já existe ─────────────────
    const { data: existingPartnership } = await supabaseAdmin
      .from("workshop_partnerships")
      .select("id, status")
      .eq("workshop_account_id", workshopAccountId)
      .eq("client_id", clientId)
      .single();

    if (existingPartnership) {
      if (existingPartnership.status === "active") {
        return json({ error: "Parceria já existe para esta transportadora" }, 400);
      }
      // Reativar partnership inativa
      await supabaseAdmin
        .from("workshop_partnerships")
        .update({ status: "active", accepted_at: new Date().toISOString(), deactivated_at: null, deactivated_by: null })
        .eq("id", existingPartnership.id);
    } else {
      // ─── 4. Criar ou promover registro legado em workshops ──────────────
      // Necessário para FK compatibility com maintenance_orders.workshop_id
      const { data: waData } = await supabaseAdmin
        .from("workshop_accounts")
        .select("name, cnpj, phone, email, contact_person, address_street, address_number, address_complement, address_neighborhood, address_city, address_state, address_zip, specialties, notes, active")
        .eq("id", workshopAccountId)
        .single();

      const cleanCnpjForLookup = waData?.cnpj ?? cnpj.replace(/\D/g, "");

      // Verificar se já existe oficina de referência com mesmo CNPJ para este cliente
      const { data: existingLegacy } = await supabaseAdmin
        .from("workshops")
        .select("id")
        .eq("client_id", clientId)
        .eq("cnpj", cleanCnpjForLookup)
        .maybeSingle();

      let legacyWorkshopId: string;

      if (existingLegacy) {
        // Promover registro existente (reutiliza ID, mantém FKs de OS intactas)
        legacyWorkshopId = existingLegacy.id;
        await supabaseAdmin
          .from("workshops")
          .update({
            profile_id: profileId,
            name: waData?.name ?? name,
            phone: waData?.phone ?? null,
            email: waData?.email ?? null,
            contact_person: waData?.contact_person ?? null,
            address_street: waData?.address_street ?? null,
            address_number: waData?.address_number ?? null,
            address_complement: waData?.address_complement ?? null,
            address_neighborhood: waData?.address_neighborhood ?? null,
            address_city: waData?.address_city ?? null,
            address_state: waData?.address_state ?? null,
            address_zip: waData?.address_zip ?? null,
            specialties: waData?.specialties ?? null,
            notes: waData?.notes ?? null,
            active: waData?.active ?? true,
          })
          .eq("id", existingLegacy.id);
      } else {
        // Criar novo registro legado
        const { data: legacyWorkshop, error: lwError } = await supabaseAdmin
          .from("workshops")
          .insert({
            client_id: clientId,
            profile_id: profileId,
            name: waData?.name ?? name,
            cnpj: cleanCnpjForLookup,
            phone: waData?.phone ?? null,
            email: waData?.email ?? null,
            contact_person: waData?.contact_person ?? null,
            address_street: waData?.address_street ?? null,
            address_number: waData?.address_number ?? null,
            address_complement: waData?.address_complement ?? null,
            address_neighborhood: waData?.address_neighborhood ?? null,
            address_city: waData?.address_city ?? null,
            address_state: waData?.address_state ?? null,
            address_zip: waData?.address_zip ?? null,
            specialties: waData?.specialties ?? null,
            notes: waData?.notes ?? null,
            active: waData?.active ?? true,
          })
          .select("id")
          .single();

        if (lwError) return json({ error: lwError.message }, 400);
        legacyWorkshopId = legacyWorkshop.id;
      }

      // Criar partnership
      const { data: newPartnership, error: partError } = await supabaseAdmin
        .from("workshop_partnerships")
        .insert({
          workshop_account_id: workshopAccountId,
          client_id: clientId,
          legacy_workshop_id: legacyWorkshopId,
          status: "active",
          accepted_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (partError) return json({ error: partError.message }, 400);

      // Registrar em audit
      await supabaseAdmin
        .from("workshop_partnership_audit")
        .insert({
          partnership_id: newPartnership.id,
          action: "created",
          performed_by: profileId,
          details: { via: "invitation", invitation_id: invitationRaw.id },
        });
    }

    // ─── 5. Marcar convite como aceito ─────────────────────────
    await supabaseAdmin
      .from("workshop_invitations")
      .update({
        status: "accepted",
        accepted_by: workshopAccountId,
      })
      .eq("id", invitationRaw.id);

    return json({ success: true, profileId, workshopAccountId }, 200);
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
