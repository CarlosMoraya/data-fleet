// Seed completo para testes E2E
// Cria clientes, veículos, motoristas, oficinas, action plans, etc.
// Execute com: node scripts/seed-e2e.mjs

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function seed() {
  console.log('🌱 Seed E2E completo - populando banco de teste...\n');

  // ── 1. Clientes ───────────────────────────────────────────────────────
  const { data: existingClients } = await supabase.from('clients').select('id, name');
  let clienteTestId = null;

  if (existingClients?.length === 0) {
    // Criar clientes base
    const clients = [
      { name: 'Cliente Teste' },
      { name: 'PRALOG' },
      { name: 'Deluna Soluções em transportes' },
      { name: 'Grupo LLE' },
    ];
    const { data, error } = await supabase.from('clients').insert(clients).select();
    if (error) { console.error('❌ Clientes:', error.message); return; }
    console.log(`✅ ${data.length} clientes criados`);
    clienteTestId = data.find(c => c.name === 'Cliente Teste')?.id;
  } else {
    clienteTestId = existingClients.find(c => c.name === 'Cliente Teste')?.id;
    console.log(`✅ ${existingClients.length} clientes já existem`);
  }

  if (!clienteTestId) { console.error('❌ Cliente Teste não encontrado'); return; }
  console.log(`📌 Cliente Teste ID: ${clienteTestId}\n`);

  // ── 2. Veículos ───────────────────────────────────────────────────────
  const { count: vCount } = await supabase.from('vehicles').select('*', { count: 'exact', head: true });
  if (vCount === 0) {
    const vehicles = [
      { client_id: clienteTestId, license_plate: 'ABC1D23', brand: 'Fiat', model: 'Strada', year: 2024, color: 'Branco', type: 'Utilitário', energy_source: 'Combustão', acquisition: 'Owned', owner: 'Cliente Teste', fipe_price: 120000, tracker: 'TK001', antt: '1234567890' },
      { client_id: clienteTestId, license_plate: 'DEF2G34', brand: 'Volkswagen', model: 'Delivery', year: 2023, color: 'Branco', type: 'Vuc', energy_source: 'Combustão', acquisition: 'Owned', owner: 'Cliente Teste', fipe_price: 180000, tracker: 'TK002', antt: '0987654321' },
      { client_id: clienteTestId, license_plate: 'GHI3J45', brand: 'Mercedes', model: 'Accelo', year: 2022, color: 'Branco', type: 'Toco', energy_source: 'Combustão', acquisition: 'Rented', owner: 'Locadora X', fipe_price: 250000, tracker: 'TK003', antt: '1122334455' },
    ];
    const { error } = await supabase.from('vehicles').insert(vehicles);
    console.log(error ? `⚠️  Veículos: ${error.message}` : `✅ ${vehicles.length} veículos criados`);
  } else {
    console.log(`✅ ${vCount} veículos já existem`);
  }

  // ── 3. Motoristas ─────────────────────────────────────────────────────
  const { count: dCount } = await supabase.from('drivers').select('*', { count: 'exact', head: true });
  if (dCount === 0) {
    const drivers = [
      { client_id: clienteTestId, name: 'João Motorista', cpf: '12345678901', category: 'AB' },
      { client_id: clienteTestId, name: 'Maria Motorista', cpf: '98765432100', category: 'AB' },
    ];
    const { error } = await supabase.from('drivers').insert(drivers);
    console.log(error ? `⚠️  Motoristas: ${error.message}` : `✅ ${drivers.length} motoristas criados`);
  } else {
    console.log(`✅ ${dCount} motoristas já existem`);
  }

  // ── 4. Oficinas ───────────────────────────────────────────────────────
  const { count: wCount } = await supabase.from('workshops').select('*', { count: 'exact', head: true });
  if (wCount === 0) {
    const workshops = [
      { client_id: clienteTestId, name: 'Oficina Teste', cnpj: '11222333000181', active: true },
      { client_id: clienteTestId, name: 'Mecânica Rápida', cnpj: '22333444000192', active: true },
    ];
    const { error } = await supabase.from('workshops').insert(workshops);
    console.log(error ? `⚠️  Oficinas: ${error.message}` : `✅ ${workshops.length} oficinas criadas`);
  } else {
    console.log(`✅ ${wCount} oficinas já existem`);
  }

  // ── 5. Embarcadores e Unidades Operacionais ───────────────────────────
  const { count: sCount } = await supabase.from('shippers').select('*', { count: 'exact', head: true });
  if (sCount === 0) {
    const { data: shipper } = await supabase.from('shippers').insert({
      client_id: clienteTestId, name: 'Embarcador Teste', cnpj: '33444555000103', active: true
    }).select().single();

    if (shipper) {
      await supabase.from('operational_units').insert({
        client_id: clienteTestId, shipper_id: shipper.id, name: 'Unidade SP', city: 'São Paulo', state: 'SP', active: true
      });
      console.log('✅ Embarcador + Unidade Operacional criados');
    }
  } else {
    console.log(`✅ ${sCount} embarcadores já existem`);
  }

  // ── 6. Agendamento de oficina (para teste assistant-maintenance) ──────
  const { data: vehicle1 } = await supabase.from('vehicles').select('id').eq('license_plate', 'ABC1D23').single();
  const { data: workshop1 } = await supabase.from('workshops').select('id').eq('name', 'Oficina Teste').single();

  if (vehicle1 && workshop1) {
    const { count: schedCount } = await supabase.from('workshop_schedules').select('*', { count: 'exact', head: true });
    if (schedCount === 0) {
      // Pega o user_id do Pedro (Fleet Assistant) para created_by
      const { data: session } = await supabase.auth.getSession();
      const createdBy = session?.session?.user?.id || '';

      const { error } = await supabase.from('workshop_schedules').insert({
        client_id: clienteTestId,
        vehicle_id: vehicle1.id,
        workshop_id: workshop1.id,
        scheduled_date: new Date().toISOString().split('T')[0],
        status: 'scheduled',
        created_by: createdBy,
      });
      console.log(error ? `⚠️  Agendamento: ${error.message}` : '✅ Agendamento de oficina criado');
    } else {
      console.log(`✅ ${schedCount} agendamentos já existem`);
    }
  }

  // ── 7. Action Plan (para teste assistant-actions) ─────────────────────
  const { data: template } = await supabase
    .from('checklist_templates')
    .select('id, current_version')
    .eq('client_id', clienteTestId)
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (template) {
    const { count: apCount } = await supabase.from('action_plans').select('*', { count: 'exact', head: true });
    if (apCount === 0) {
      const { data: session2 } = await supabase.auth.getSession();
      const filledBy = session2?.session?.user?.id || '';

      const { data: checklist } = await supabase.from('checklists').insert({
        client_id: clienteTestId,
        template_id: template.id,
        version_number: template.current_version,
        filled_by: filledBy,
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        status: 'completed',
      }).select('id').single();

      if (checklist) {
        const { error } = await supabase.from('action_plans').insert({
          client_id: clienteTestId,
          checklist_id: checklist.id,
          reported_by: filledBy,
          suggested_action: 'Trocar pneu dianteiro esquerdo',
          observed_issue: 'Pneu com desgaste irregular detectado no checklist',
          status: 'pending',
        });
        console.log(error ? `⚠️  Action Plan: ${error.message}` : '✅ Action Plan criado');
      }
    } else {
      console.log(`✅ ${apCount} action plans já existem`);
    }
  } else {
    console.log('⚠️  Nenhum template publicado — pulando Action Plan');
  }

  // ── 8. Templates de checklist (caso não existam) ──────────────────────
  const { count: tCount } = await supabase.from('checklist_templates').select('*', { count: 'exact', head: true });
  if (tCount === 0) {
    const { data: session3 } = await supabase.auth.getSession();
    const createdBy = session3?.session?.user?.id || '';

    const { data: tpl } = await supabase.from('checklist_templates').insert({
      client_id: clienteTestId,
      vehicle_category: 'Leve',
      context: 'Rotina',
      name: 'Template E2E Rotina Leve',
      current_version: 1,
      status: 'published',
      created_by: createdBy,
    }).select().single();

    if (tpl) {
      await supabase.from('checklist_template_versions').insert({
        template_id: tpl.id,
        version_number: 1,
        published_at: new Date().toISOString(),
        published_by: createdBy,
      });
      await supabase.from('checklist_items').insert([
        { template_id: tpl.id, version_number: 1, title: 'Verificar pneus', is_mandatory: true, require_photo_if_issue: true, can_block_vehicle: true, order_number: 1 },
        { template_id: tpl.id, version_number: 1, title: 'Verificar óleo', is_mandatory: true, require_photo_if_issue: false, can_block_vehicle: false, order_number: 2 },
      ]);
      console.log('✅ Template de checklist criado com 2 itens');
    }
  } else {
    console.log(`✅ ${tCount} templates já existem`);
  }

  console.log('\n✅ Seed E2E concluído!');
}

seed().catch(err => {
  console.error('❌ Erro fatal:', err.message);
  process.exit(1);
});
