import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const DEV_PROJECT_REF = 'vvbnbzzhpiksacqudmfu';
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const fallbackPassword = process.env.DEMO_SEED_PASSWORD || 'BetaFleet@12345';

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Erro: configure SUPABASE_URL/VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.');
  process.exit(1);
}

if (!supabaseUrl.includes(DEV_PROJECT_REF) && process.env.ALLOW_DEMO_SEED !== '1') {
  console.error(`Seed bloqueado: a URL atual nao parece ser o projeto Dev (${DEV_PROJECT_REF}).`);
  console.error('Se voce realmente quiser rodar em outro ambiente, use ALLOW_DEMO_SEED=1.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

function env(name, fallback) {
  return process.env[name] || fallback;
}

function todayIso(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

async function selectOne(table, filters) {
  let query = supabase.from(table).select('*');
  for (const [column, value] of Object.entries(filters)) {
    query = query.eq(column, value);
  }
  const { data, error } = await query.limit(1).maybeSingle();
  if (error) throw new Error(`${table}: ${error.message}`);
  return data;
}

async function insertIfMissing(table, filters, payload) {
  const existing = await selectOne(table, filters);
  if (existing) return existing;

  const { data, error } = await supabase
    .from(table)
    .insert(payload)
    .select('*')
    .single();

  if (error) throw new Error(`${table}: ${error.message}`);
  return data;
}

async function allAuthUsers() {
  const users = [];
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`auth.listUsers: ${error.message}`);

    users.push(...(data.users || []));
    if (!data.users || data.users.length < 1000) break;
    page += 1;
  }

  return users;
}

async function ensureUser(users, { email, password, name, role, clientId, workshopAccountId = null }) {
  const existing = users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
  let userId = existing?.id;

  if (!userId) {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role },
    });
    if (error) throw new Error(`auth.createUser ${email}: ${error.message}`);
    userId = data.user.id;
    users.push(data.user);
  } else {
    const { error } = await supabase.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
      user_metadata: { name, role },
    });
    if (error) throw new Error(`auth.updateUser ${email}: ${error.message}`);
  }

  const canDelete = ['Manager', 'Coordinator', 'Director', 'Admin Master'].includes(role);
  const { error: profileError } = await supabase.from('profiles').upsert({
    id: userId,
    name,
    role,
    client_id: clientId,
    workshop_account_id: workshopAccountId,
    can_delete_vehicles: canDelete,
    can_delete_drivers: canDelete,
    can_delete_workshops: canDelete,
    budget_approval_limit: ['Coordinator', 'Director', 'Admin Master'].includes(role) ? 10000 : 0,
  });

  if (profileError) throw new Error(`profiles ${email}: ${profileError.message}`);
  return userId;
}

async function ensureDemoUsers(primaryClientId) {
  const users = await allAuthUsers();
  const specs = {
    admin: {
      email: env('TEST_ADMIN_EMAIL', 'admin@demo.betafleet.local'),
      password: env('TEST_ADMIN_PASSWORD', fallbackPassword),
      name: 'DataStack',
      role: 'Admin Master',
      clientId: null,
    },
    analyst: {
      email: env('TEST_ANALYST_EMAIL', 'analyst@demo.betafleet.local'),
      password: env('TEST_ANALYST_PASSWORD', fallbackPassword),
      name: 'Mariana Analista',
      role: 'Fleet Analyst',
      clientId: primaryClientId,
    },
    assistant: {
      email: env('TEST_ASSISTANT_EMAIL', 'assistant@demo.betafleet.local'),
      password: env('TEST_ASSISTANT_PASSWORD', fallbackPassword),
      name: 'Pedro Assistente',
      role: 'Fleet Assistant',
      clientId: primaryClientId,
    },
    manager: {
      email: env('TEST_MANAGER_EMAIL', 'manager@demo.betafleet.local'),
      password: env('TEST_MANAGER_PASSWORD', fallbackPassword),
      name: 'Alexandre Gestor',
      role: 'Manager',
      clientId: primaryClientId,
    },
    auditor: {
      email: env('TEST_AUDITOR_EMAIL', 'auditor@demo.betafleet.local'),
      password: env('TEST_AUDITOR_PASSWORD', fallbackPassword),
      name: 'Carlos Auditor',
      role: 'Yard Auditor',
      clientId: primaryClientId,
    },
    driver: {
      email: env('TEST_DRIVER_EMAIL', 'driver.jorge@demo.betafleet.local'),
      password: env('TEST_DRIVER_PASSWORD', fallbackPassword),
      name: 'Jorge Motorista',
      role: 'Driver',
      clientId: primaryClientId,
    },
    coordinator: {
      email: env('TEST_COORDINATOR_EMAIL', 'coordinator@demo.betafleet.local'),
      password: env('TEST_COORDINATOR_PASSWORD', fallbackPassword),
      name: 'Beatriz Lima',
      role: 'Coordinator',
      clientId: primaryClientId,
    },
    supervisor: {
      email: env('TEST_SUPERVISOR_EMAIL', 'supervisor@demo.betafleet.local'),
      password: env('TEST_SUPERVISOR_PASSWORD', fallbackPassword),
      name: 'Camila Torres',
      role: 'Supervisor',
      clientId: primaryClientId,
    },
    operationsManager: {
      email: env('TEST_GESTOROP_EMAIL', 'operations@demo.betafleet.local'),
      password: env('TEST_GESTOROP_PASSWORD', fallbackPassword),
      name: 'Alex Gestor Operacional',
      role: 'Operations Manager',
      clientId: primaryClientId,
    },
    workshop: {
      email: env('TEST_WORKSHOP_EMAIL', 'workshop@demo.betafleet.local'),
      password: env('TEST_WORKSHOP_PASSWORD', fallbackPassword),
      name: 'Oficina Demo Usuario',
      role: 'Workshop',
      clientId: null,
    },
  };

  const ids = {};
  for (const [key, spec] of Object.entries(specs)) {
    ids[key] = await ensureUser(users, spec);
  }

  return { ids, specs, users };
}

async function ensureWorkshopAccount(users, workshopUserId, primaryClientId, legacyWorkshopId) {
  const account = await insertIfMissing(
    'workshop_accounts',
    { cnpj: '99888777000166' },
    {
      profile_id: workshopUserId,
      name: 'Rede Oficina Demo',
      cnpj: '99888777000166',
      phone: '(11) 4555-9090',
      email: env('TEST_WORKSHOP_EMAIL', 'workshop@demo.betafleet.local'),
      contact_person: 'Renata Oficina',
      address_city: 'Sao Paulo',
      address_state: 'SP',
      specialties: ['Preventiva', 'Corretiva'],
      active: true,
    },
  );

  await supabase.from('profiles').update({ workshop_account_id: account.id }).eq('id', workshopUserId);

  await insertIfMissing(
    'workshop_partnerships',
    { workshop_account_id: account.id, client_id: primaryClientId },
    {
      workshop_account_id: account.id,
      client_id: primaryClientId,
      legacy_workshop_id: legacyWorkshopId,
      status: 'active',
      invited_at: new Date().toISOString(),
      accepted_at: new Date().toISOString(),
    },
  );

  return account;
}

async function ensureVehicle(clientId, overrides) {
  return insertIfMissing(
    'vehicles',
    { license_plate: overrides.license_plate },
    {
      client_id: clientId,
      type: 'Truck',
      energy_source: 'Combustão',
      cooling_equipment: true,
      semi_reboque: false,
      fuel_type: 'Diesel',
      tank_capacity: 300,
      avg_consumption: 3.2,
      cooling_brand: 'Thermo King',
      license_plate: overrides.license_plate,
      renavam: overrides.renavam,
      chassi: overrides.chassi,
      detran_uf: 'SP',
      brand_model: overrides.brand_model,
      brand: overrides.brand ?? overrides.brand_model.split(' ')[0],
      model: overrides.model ?? overrides.brand_model.split(' ').slice(1).join(' '),
      year: overrides.year ?? 2024,
      color: 'Branco',
      acquisition: 'Owned',
      fipe_price: overrides.fipe_price ?? 280000,
      tracker: 'Sascar',
      antt: '123456789',
      owner: 'BetaFleet Demo',
      status: overrides.status ?? 'Available',
      autonomy: 960,
      driver_id: overrides.driver_id ?? null,
      shipper_id: overrides.shipper_id ?? null,
      operational_unit_id: overrides.operational_unit_id ?? null,
      initial_km: overrides.initial_km ?? 24500,
      pbt: 11,
      cmt: 18,
      eixos: 2,
      vehicle_usage: 'Operação',
      warranty: true,
      warranty_end_date: todayIso(180),
      first_revision_max_km: 30000,
      first_revision_deadline: todayIso(30),
      cooling_first_revision_deadline: todayIso(45),
      has_insurance: true,
      has_maintenance_contract: false,
      crlv_expiration_date: overrides.crlv_expiration_date ?? todayIso(45),
      axle_config: [{ axle: 1, left: 'D', right: 'D' }, { axle: 2, left: 'T', right: 'T' }],
      steps_count: 1,
      category: overrides.category ?? 'Pesado',
    },
  );
}

async function main() {
  console.log('Criando massa oficial de desenvolvimento/testes no Supabase Dev...');

  const primaryClient = await insertIfMissing('clients', { name: 'BetaFleet Demo' }, { name: 'BetaFleet Demo' });
  const otherClient = await insertIfMissing('clients', { name: 'BetaFleet Isolamento' }, { name: 'BetaFleet Isolamento' });
  const delunaClient = await insertIfMissing('clients', { name: 'Deluna Transportes' }, { name: 'Deluna Transportes' });
  const betaFleetClient = await insertIfMissing('clients', { name: 'BetaFleet' }, { name: 'BetaFleet' });

  const { ids, specs } = await ensureDemoUsers(primaryClient.id);

  const shipper = await insertIfMissing('shippers', { client_id: primaryClient.id, name: 'Demo Foods' }, {
    client_id: primaryClient.id,
    name: 'Demo Foods',
    cnpj: '11222333000181',
    phone: '(11) 3000-1000',
    email: 'operacao@demofoods.example',
    contact_person: 'Patricia Lima',
    active: true,
  });

  const unit = await insertIfMissing('operational_units', { client_id: primaryClient.id, name: 'CD Sao Paulo' }, {
    client_id: primaryClient.id,
    shipper_id: shipper.id,
    name: 'CD Sao Paulo',
    code: 'SP-01',
    city: 'Sao Paulo',
    state: 'SP',
    active: true,
  });

  const driver = await insertIfMissing('drivers', { client_id: primaryClient.id, cpf: '12345678901' }, {
    client_id: primaryClient.id,
    name: 'Jorge Motorista',
    cpf: '12345678901',
    profile_id: ids.driver,
    category: 'E',
    registration_number: 'CNH123456',
    expiration_date: todayIso(90),
    gr_expiration_date: todayIso(20),
    phone: '(11) 99999-0001',
  });

  const backupDriver = await insertIfMissing('drivers', { client_id: primaryClient.id, cpf: '22233344455' }, {
    client_id: primaryClient.id,
    name: 'Paula Reserva',
    cpf: '22233344455',
    category: 'D',
    registration_number: 'CNH654321',
    expiration_date: todayIso(-10),
    gr_expiration_date: todayIso(60),
    phone: '(11) 99999-0002',
  });

  const workshop = await insertIfMissing('workshops', { client_id: primaryClient.id, cnpj: '22333444000192' }, {
    client_id: primaryClient.id,
    name: 'Oficina Demo',
    cnpj: '22333444000192',
    phone: '(11) 4000-2000',
    email: 'oficina@demo.example',
    contact_person: 'Roberto Alves',
    address_city: 'Sao Paulo',
    address_state: 'SP',
    active: true,
    specialties: ['Preventiva', 'Corretiva'],
  });

  await ensureWorkshopAccount(await allAuthUsers(), ids.workshop, primaryClient.id, workshop.id);

  const vehicle = await ensureVehicle(primaryClient.id, {
    license_plate: 'DEV1A23',
    renavam: '12345678901',
    chassi: '9BWZZZ377VT004251',
    brand_model: 'VOLKSWAGEN DELIVERY 11.180',
    brand: 'VOLKSWAGEN',
    model: 'DELIVERY 11.180',
    category: 'Pesado',
    driver_id: driver.id,
    shipper_id: shipper.id,
    operational_unit_id: unit.id,
    crlv_expiration_date: todayIso(45),
  });

  const maintenanceVehicle = await ensureVehicle(primaryClient.id, {
    license_plate: 'DEV2B34',
    renavam: '23456789012',
    chassi: '9BWZZZ377VT004252',
    brand_model: 'MERCEDES ACCELO 1016',
    brand: 'MERCEDES',
    model: 'ACCELO 1016',
    category: 'Pesado',
    driver_id: backupDriver.id,
    shipper_id: shipper.id,
    operational_unit_id: unit.id,
    status: 'Maintenance',
    crlv_expiration_date: todayIso(-5),
    initial_km: 88500,
  });

  await ensureVehicle(otherClient.id, {
    license_plate: 'ISO1C23',
    renavam: '34567890123',
    chassi: '9BWZZZ377VT004253',
    brand_model: 'IVECO DAILY 35S14',
    brand: 'IVECO',
    model: 'DAILY 35S14',
    category: 'Médio',
    crlv_expiration_date: todayIso(120),
  });

  await ensureVehicle(delunaClient.id, {
    license_plate: 'DEL1A23',
    renavam: '45678901234',
    chassi: '9BWZZZ377VT004254',
    brand_model: 'SCANIA R450',
    brand: 'SCANIA',
    model: 'R450',
    category: 'Pesado',
    crlv_expiration_date: todayIso(90),
  });

  await ensureVehicle(betaFleetClient.id, {
    license_plate: 'BTF1B23',
    renavam: '56789012345',
    chassi: '9BWZZZ377VT004255',
    brand_model: 'FORD CARGO 816',
    brand: 'FORD',
    model: 'CARGO 816',
    category: 'Médio',
    crlv_expiration_date: todayIso(90),
  });

  await insertIfMissing('workshop_schedules', { client_id: primaryClient.id, vehicle_id: vehicle.id, workshop_id: workshop.id }, {
    client_id: primaryClient.id,
    vehicle_id: vehicle.id,
    workshop_id: workshop.id,
    scheduled_date: todayIso(7),
    status: 'scheduled',
    notes: 'Revisao preventiva demo.',
    created_by: ids.coordinator,
  });

  const template = await insertIfMissing('checklist_templates', { client_id: primaryClient.id, name: 'Checklist Demo - Rotina Pesado' }, {
    client_id: primaryClient.id,
    vehicle_category: 'Pesado',
    is_free_form: false,
    name: 'Checklist Demo - Rotina Pesado',
    description: 'Checklist basico para validacao do ambiente Dev.',
    current_version: 1,
    status: 'published',
    created_by: ids.coordinator,
    context: 'Rotina',
  });

  await insertIfMissing('checklist_template_versions', { template_id: template.id, version_number: 1 }, {
    template_id: template.id,
    version_number: 1,
    published_at: new Date().toISOString(),
    published_by: ids.coordinator,
  });

  const tireItem = await insertIfMissing('checklist_items', { template_id: template.id, version_number: 1, order_number: 1 }, {
    template_id: template.id,
    version_number: 1,
    title: 'Verificar pneus',
    description: 'Conferir calibragem e desgaste.',
    is_mandatory: true,
    require_photo_if_issue: true,
    default_action: 'Abrir plano de acao para avaliacao dos pneus.',
    order_number: 1,
    can_block_vehicle: true,
  });

  await insertIfMissing('checklist_items', { template_id: template.id, version_number: 1, order_number: 2 }, {
    template_id: template.id,
    version_number: 1,
    title: 'Verificar documentacao',
    description: 'Conferir CRLV e documentos obrigatorios.',
    is_mandatory: true,
    require_photo_if_issue: false,
    default_action: 'Regularizar documento pendente.',
    order_number: 2,
    can_block_vehicle: false,
  });

  const checklist = await insertIfMissing('checklists', { client_id: primaryClient.id, vehicle_id: vehicle.id, filled_by: ids.driver }, {
    client_id: primaryClient.id,
    template_id: template.id,
    version_number: 1,
    vehicle_id: vehicle.id,
    filled_by: ids.driver,
    started_at: new Date(Date.now() - 3600_000).toISOString(),
    completed_at: new Date(Date.now() - 1800_000).toISOString(),
    status: 'completed',
    odometer_km: 24620,
    notes: 'Checklist demo concluido.',
  });

  const response = await insertIfMissing('checklist_responses', { checklist_id: checklist.id, item_id: tireItem.id }, {
    checklist_id: checklist.id,
    item_id: tireItem.id,
    status: 'issue',
    observation: 'Pneu dianteiro com desgaste irregular.',
    responded_at: new Date().toISOString(),
  });

  await insertIfMissing('action_plans', { checklist_id: checklist.id, suggested_action: 'Avaliar pneu dianteiro' }, {
    client_id: primaryClient.id,
    checklist_id: checklist.id,
    checklist_response_id: response.id,
    vehicle_id: vehicle.id,
    reported_by: ids.driver,
    suggested_action: 'Avaliar pneu dianteiro',
    observed_issue: 'Pneu dianteiro com desgaste irregular.',
    status: 'pending',
    name: 'Corrigir desgaste de pneu',
    responsible_id: ids.assistant,
    due_date: todayIso(5),
    assigned_by: ids.coordinator,
  });

  await insertIfMissing('maintenance_orders', { client_id: primaryClient.id, os_number: 'DEV-OS-001' }, {
    client_id: primaryClient.id,
    vehicle_id: maintenanceVehicle.id,
    workshop_id: workshop.id,
    os_number: 'DEV-OS-001',
    workshop_os_number: 'OF-001',
    entry_date: todayIso(-1),
    expected_exit_date: todayIso(3),
    type: 'Preventiva',
    status: 'Aguardando orçamento',
    description: 'Revisao preventiva criada pelo seed de desenvolvimento.',
    mechanic_name: 'Roberto Alves',
    estimated_cost: 1800,
    created_by_id: ids.coordinator,
    current_km: 88500,
    budget_status: 'pendente',
  });

  const tire = await insertIfMissing('tires', { client_id: primaryClient.id, tire_code: 'PNEU-DEV-001' }, {
    client_id: primaryClient.id,
    vehicle_id: vehicle.id,
    tire_code: 'PNEU-DEV-001',
    specification: '295/80 R22.5',
    dot: 'DOT2625',
    fire_marking: 'FIRE001',
    manufacturer: 'Michelin',
    brand: 'X Multi',
    rotation_interval_km: 10000,
    useful_life_km: 80000,
    retread_interval_km: 50000,
    visual_classification: 'Meia vida',
    current_position: '1L',
    position_type: 'single',
    active: true,
    created_by: ids.manager,
    updated_by: ids.manager,
  });

  const tireInspection = await insertIfMissing('tire_inspections', { client_id: primaryClient.id, vehicle_id: vehicle.id, filled_by: ids.auditor }, {
    client_id: primaryClient.id,
    vehicle_id: vehicle.id,
    filled_by: ids.auditor,
    started_at: new Date(Date.now() - 7200_000).toISOString(),
    completed_at: new Date(Date.now() - 7000_000).toISOString(),
    status: 'completed',
    odometer_km: 24630,
    notes: 'Inspecao demo de pneus.',
    axle_config_snapshot: [{ axle: 1, left: 'D', right: 'D' }, { axle: 2, left: 'T', right: 'T' }],
    steps_count_snapshot: 1,
  });

  await insertIfMissing('tire_inspection_responses', { inspection_id: tireInspection.id, position_code: '1L' }, {
    inspection_id: tireInspection.id,
    tire_id: tire.id,
    position_code: '1L',
    position_label: 'Eixo 1 esquerdo',
    dot: 'DOT2625',
    fire_marking: 'FIRE001',
    manufacturer: 'Michelin',
    brand: 'X Multi',
    photo_url: 'https://example.com/demo-pneu.jpg',
    photo_timestamp: new Date().toISOString(),
    status: 'nao_conforme',
    observation: 'Sulco abaixo do recomendado para demo.',
    responded_at: new Date().toISOString(),
  });

  // Garante >=2 categorias distintas no primaryClient para os E2E de filtros de Custos.
  // Inserção direta sem brand_model (coluna inexistente no schema atual).
  const costFilterVehicleMedio = await insertIfMissing('vehicles', { license_plate: 'DEV4D56' }, {
    client_id: primaryClient.id,
    license_plate: 'DEV4D56',
    renavam: '67890123456',
    chassi: '9BWZZZ377VT004256',
    brand: 'IVECO',
    model: 'DAILY 35S14',
    type: 'Van',
    category: 'Médio',
    energy_source: 'Combustão',
    fuel_type: 'Diesel',
    color: 'Branco',
    acquisition: 'Owned',
    year: 2022,
    shipper_id: shipper.id,
    operational_unit_id: unit.id,
    detran_uf: 'SP',
    status: 'Available',
    crlv_expiration_date: todayIso(60),
    has_insurance: true,
    has_maintenance_contract: false,
  });

  await insertIfMissing('vehicles', { license_plate: 'DEV5E67' }, {
    client_id: primaryClient.id,
    license_plate: 'DEV5E67',
    renavam: '78901234567',
    chassi: '9BWZZZ377VT004257',
    brand: 'SCANIA',
    model: 'R450',
    type: 'Truck',
    category: 'Pesado',
    energy_source: 'Combustão',
    fuel_type: 'Diesel',
    color: 'Cinza',
    acquisition: 'Owned',
    year: 2023,
    shipper_id: shipper.id,
    operational_unit_id: unit.id,
    detran_uf: 'SP',
    status: 'Available',
    crlv_expiration_date: todayIso(60),
    has_insurance: true,
    has_maintenance_contract: false,
  });

  // OS no mês atual para costFilterVehicleMedio (category Médio) — necessária para o card Custo no Período.
  await insertIfMissing('maintenance_orders', { client_id: primaryClient.id, os_number: 'DEV-OS-002' }, {
    client_id: primaryClient.id,
    vehicle_id: costFilterVehicleMedio.id,
    workshop_id: workshop.id,
    os_number: 'DEV-OS-002',
    entry_date: todayIso(-2),
    expected_exit_date: todayIso(5),
    type: 'Corretiva',
    status: 'Concluído',
    description: 'OS de custo demo para filtro de Categoria Médio.',
    mechanic_name: 'Roberto Alves',
    estimated_cost: 950,
    approved_cost: 950,
    created_by_id: ids.coordinator,
    current_km: 45000,
    budget_status: 'aprovado',
  });

  // Segundo checklist para vehicle (DEV1A23) com odometer_km crescente — garante KM válido para Custo por KM.
  await insertIfMissing('checklists', { client_id: primaryClient.id, vehicle_id: vehicle.id, filled_by: ids.analyst }, {
    client_id: primaryClient.id,
    template_id: template.id,
    version_number: 1,
    vehicle_id: vehicle.id,
    filled_by: ids.analyst,
    started_at: new Date(Date.now() - 90_000_000).toISOString(),
    completed_at: new Date(Date.now() - 86_400_000).toISOString(),
    status: 'completed',
    odometer_km: 25820,
    notes: 'Segundo checklist demo para validacao de KM rodado.',
  });

  console.log('\nSeed concluido.');
  console.log(`Clientes demo: ${primaryClient.name}, ${otherClient.name}, ${delunaClient.name}, ${betaFleetClient.name}`);
  console.log(`Usuarios alinhados ao Playwright: ${Object.keys(specs).join(', ')}`);
  console.log('Dados criados: veiculos (DEV4D56 Medio, DEV5E67 Pesado), OS DEV-OS-002, checklist KM, motoristas, oficina, agendamento, plano de acao e pneus.');
}

main().catch((error) => {
  console.error(`Erro no seed: ${error.message}`);
  process.exit(1);
});
