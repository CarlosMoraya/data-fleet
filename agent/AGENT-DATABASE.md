# AGENT-DATABASE - Camada de Dados e Migrações

Este documento serve como a especificação técnica para o banco de dados PostgreSQL (Supabase) do **βetaFleet**.

## 🛡️ Row Level Security (RLS) - O Padrão de Ouro

Todas as tabelas **DEVEM** ter RLS habilitado. O padrão de filtragem é por `client_id` do usuário autenticado.

### Exceção Crítica: Admin Master
O `Admin Master` possui `client_id = NULL`. Para que ele tenha acesso cross-tenant, todas as políticas devem incluir:
```sql
OR (role = 'Admin Master')
```
**Atenção**: Evite usar subqueries lentas. Prefira checar o campo `role` no JWT ou usar `EXISTS` em tabelas de cache se necessário.

---

## 📊 Principais Tabelas e Relacionamentos

### Núcleo de Operação
- **`profiles`**: Dados estendidos do usuário e permissões granulares (`can_delete_vehicles`, etc).
- **`clients`**: Tenants do sistema.
- **`vehicles`**: Veículos da frota. Possui relacionamento 1:1 com `drivers` e N:1 com `shippers`.
- **`drivers`**: Motoristas. Linkados a um `profile_id` único para acesso ao app de checklist.

### Logística e Parceiros
- **`shippers`**: Embarcadores (clientes da transportadora).
- **`operational_units`**: Bases ou unidades de operação vinculadas a um embarcador.
- **`workshops`**: Referências de oficinas para os clientes.
- **`workshop_accounts`**: Contas globais de oficinas parceiras (multi-tenant).

### Manutenção e Checklist
- **`checklists`**: Registros de inspeção com suporte offline.
- **`maintenance_orders`**: Ordens de serviço com workflow de aprovação de orçamento.
- **`tires`**: Gestão individual de pneus por código de fogo e posição.

---

## ⚙️ Configurações Dinâmicas

Existem tabelas dedicadas para permitir que cada cliente (`client_id`) configure a obrigatoriedade de campos:
- **`vehicle_field_settings`**: Controla campos como Renavam, Chassi, etc.
- **`driver_field_settings`**: Controla campos de documentos do motorista.
- **`checklist_day_intervals`**: Define o intervalo (em dias) entre checklists de rotina e segurança.

---

## 📜 Histórico Recente de Migrações (Destaques)

1.  **`20260405000000_fix_workshop_partnership_rls.sql`**: Correção de recursão infinita (42P17) entre policies de oficinas.
2.  **`20260326000000_fix_supervisor_coordinator_rls.sql`**: Atualização da hierarquia de roles e permissões de visibilidade.
3.  **`20260324000000_create_tire_management.sql`**: Implementação completa do módulo de pneus.
4.  **`20260319000000_add_budget_to_maintenance.sql`**: Campos de orçamento e auditoria em ordens de serviço.

> [!IMPORTANT]
> Migrações são executadas manualmente no SQL Editor do Supabase. O projeto não utiliza sistema de migração por linha de comando no momento.
