# Mapa de Permissoes — BetaFleet

> Ultima atualizacao: 2026-03-26
> Este arquivo e apenas referencia. Nao afeta o build nem o codigo.

---

## 1. Hierarquia de Roles

| Rank | Role | Descricao |
|------|------|-----------|
| 9 | Admin Master | Sistema inteiro, `client_id = NULL`, cross-tenant |
| 8 | Director | Lideranca executiva do tenant |
| 7 | Manager | Gestao completa do tenant |
| 6 | Coordinator | Coordenacao cross-tenant |
| 5 | Supervisor | Coordenacao de equipes |
| 4 | Fleet Analyst | Analise de dados e compliance |
| 3 | Fleet Assistant | Suporte operacional |
| 2 | Yard Auditor | Auditor de patio |
| 1 | Driver | Motorista — preenche checklists |
| 1 | Workshop | Oficina parceira — atualiza OS |

---

## 2. Quem Cria Quem

| Criador | Pode Criar |
|---------|-----------|
| Admin Master | Todos os roles, qualquer cliente |
| Director | Manager, Coordinator, Supervisor, Fleet Analyst, Fleet Assistant, Yard Auditor |
| Manager | Coordinator, Supervisor, Fleet Analyst, Fleet Assistant, Yard Auditor |
| Coordinator | Supervisor, Fleet Analyst, Fleet Assistant, Yard Auditor |
| Supervisor | Fleet Analyst, Fleet Assistant, Yard Auditor |
| Fleet Analyst | Fleet Assistant, Yard Auditor |
| Fleet Assistant | Ninguem |
| Driver | Ninguem (criado via Cadastros > Motoristas) |
| Workshop | Ninguem (criado via Cadastros > Oficinas) |

---

## 3. Matriz CRUD por Modulo

| Modulo | Driver | Yard Aud. | Workshop | Fl.Assist | Fl.Analyst | Supervisor | Manager | Coordinator | Director | Admin Master |
|--------|--------|-----------|----------|-----------|------------|------------|---------|-------------|----------|-------------|
| Dashboard | — | — | — | — | R | R | R | R | R | R |
| Veiculos | — | — | — | C,R | C,R,U | C,R,U | C,R,U,D | C,R,U,D | C,R,U,D | C,R,U,D |
| Motoristas | — | — | — | C,R | C,R,U | C,R,U | C,R,U,D | C,R,U,D | C,R,U,D | C,R,U,D |
| Oficinas | — | — | — | C,R | C,R,U | C,R,U | C,R,U,D | C,R,U,D | C,R,U,D | C,R,U,D |
| Embarcadores | — | — | — | C,R | C,R,U | C,R,U | C,R,U,D | C,R,U,D | C,R,U,D | C,R,U,D |
| Unid.Operac. | — | — | — | C,R | C,R,U | C,R,U | C,R,U,D | C,R,U,D | C,R,U,D | C,R,U,D |
| Checklists | C,R* | C,R,U | — | C,R,U | C,R,U | C,R,U | C,R,U | C,R,U | C,R,U | C,R,U,D |
| Templates | — | — | — | — | C,R,U | C,R,U | C,R,U,D | C,R,U,D | C,R,U,D | C,R,U,D |
| Plano Acao | — | — | — | C,R,U | C,R,U | C,R,U | C,R,U | C,R,U | C,R,U | C,R,U,D |
| Manutencao | — | — | R** | C,R,U | C,R,U | C,R,U | C,R,U | C,R,U | C,R,U | C,R,U,D |
| Aprov.Orcam. | — | — | — | R+lim | R+lim | R+lim | R+lim | R(ilim) | R(ilim) | R(ilim) |
| Pneus | — | — | — | R | R | R | C,R,U | C,R,U | C,R,U | C,R,U,D |
| Config(Campos) | — | — | — | — | — | — | R,U | R,U | R,U | R,U |
| Config(KM/Dias) | — | — | — | R,U | R,U | R,U | R,U | R,U | R,U | R,U |
| Usuarios | — | — | — | C,R | C,R | C,R | C,R,U | C,R,U | C,R,U | C,R,U,D |
| Admin Clientes | — | — | — | — | — | — | — | — | — | C,R,U,D |
| Admin Usuarios | — | — | — | — | — | — | — | — | — | C,R,U,D |

**Legenda:** C=Criar, R=Ler, U=Atualizar, D=Deletar, — = sem acesso

- `*` Driver: apenas checklists proprios do veiculo atribuido
- `**` Workshop: apenas OS da propria oficina, update parcial (4 campos)
- `R+lim` = pode aprovar ate o valor de `budgetApprovalLimit`
- `R(ilim)` = aprovacao ilimitada

---

## 4. Flags Condicionais (atribuidas por Manager+)

| Flag | Efeito | Aplica-se a |
|------|--------|-------------|
| `canDeleteVehicles` | Habilita exclusao de veiculos | Fleet Analyst, Supervisor |
| `canDeleteDrivers` | Habilita exclusao de motoristas | Fleet Analyst, Supervisor |
| `canDeleteWorkshops` | Habilita exclusao de oficinas | Fleet Analyst, Supervisor |
| `budgetApprovalLimit` | Valor maximo para aprovar orcamentos | Fleet Assistant, Fleet Analyst, Supervisor, Manager |

---

## 5. Sidebar — Visibilidade

| Item | Quem ve |
|------|---------|
| Dashboard | Fleet Analyst, Supervisor, Manager, Coordinator, Director, Admin Master |
| Cadastros | Fleet Assistant+ |
| Checklists | Todos |
| Plano de Acao | Fleet Assistant+ |
| Agendamentos | Driver, Fleet Assistant+ |
| Manutencao | Workshop, Fleet Assistant+ |
| Aprov. Orcamentos | Fleet Assistant+ |
| Templates | Fleet Analyst+ |
| Configuracoes | Fleet Assistant+ |
| Admin (Clientes/Usuarios) | Admin Master |

---

## 6. Redirect ao Login

| Role | Destino |
|------|---------|
| Driver / Yard Auditor | `/checklists` |
| Workshop | `/manutencao` |
| Demais | `/` (Dashboard) |

---

## 7. Detalhes Especiais

### Workshop
- Ve apenas Manutencao na sidebar
- So ve OS da propria oficina (filtro `workshop_id`)
- Update limitado a 4 campos: data prevista de saida, OS da oficina, nome do mecanico, km atual
- Nao pode criar, cancelar ou reabrir OS
- Upload de PDF de orcamento e obrigatorio

### Driver
- Ve apenas Checklists e Agendamentos na sidebar
- Preenche checklists apenas do veiculo atribuido
- Ve apenas os proprios checklists
- Nao pode deletar, criar planos de acao ou gerenciar nada

### Admin Master
- `client_id = NULL` — acesso cross-tenant
- Troca entre todos os clientes via dropdown
- RLS exige `OR role = 'Admin Master'` em todas as policies
- Unico que acessa secao Admin (Clientes + Usuarios globais)
- Unico que pode deletar pneus

### Yard Auditor
- Acesso a checklists de todos os veiculos (nao apenas atribuidos)
- Pode preencher checklists de contexto Auditoria
- Nao tem acesso a Dashboard nem modulos administrativos

---

## 8. Contextos de Checklist por Role

| Contexto | Driver | Yard Auditor | Fleet Assistant+ |
|----------|--------|-------------|-----------------|
| Rotina | Sim | Sim | Sim |
| Seguranca | Sim | Sim | Sim |
| Auditoria | Nao | Sim | Fleet Analyst+ |
| Entrada/Saida Oficina | Nao | Nao | Sim |
| Reboque | Nao | Nao | Sim |

---

## 9. Aprovacao de Orcamentos — Logica

```
canApprove(user, total) =
  user.role in ['Coordinator','Director','Admin Master']   → aprovacao ilimitada
  OR (user.budgetApprovalLimit > 0 AND total <= limite)    → aprovacao ate o limite
  SENAO                                                     → nao pode aprovar
```

---

## 10. Multi-Tenancy

| Aspecto | Admin Master | Demais |
|---------|-------------|--------|
| `client_id` | NULL | ID do tenant |
| Troca de cliente | Todos os clientes | Apenas se Manager+ com multiplos clientes |
| RLS | Precisa de `OR role = 'Admin Master'` | Filtro automatico por `client_id` |
| Criacao de usuarios | Qualquer cliente | Apenas proprio tenant |
