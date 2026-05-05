# Relatório E2E — Tire Management (Manager)
Data: 05/04/2026, 22:06:32

**Resumo:** 9 passaram · 1 falharam · 4 pulados

## Resultados

| # | Teste | Status | Erro |
|---|-------|--------|------|
| 01 | página /cadastros/pneus carrega com header "Gestão de Pneus" | ✅ PASSOU | — |
| 02 | botão "Adicionar Pneus" visível para Manager | ✅ PASSOU | — |
| 03 | AddModeModal: abre com 2 opções de cadastro | ✅ PASSOU | — |
| 04 | VehiclePickerModal: abre ao clicar "Por Placa (Individual)" | ✅ PASSOU | — |
| 05 | TireForm: abre ao selecionar veículo, campo especificação visível | ✅ PASSOU | — |
| 06 | TireForm: cadastrar pneu individual com sucesso | ✅ PASSOU | — |
| 07 | tabela: pneu cadastrado aparece com classificação e status "Ativo" | ✅ PASSOU | — |
| 08 | busca: filtrar por especificação funciona | ✅ PASSOU | — |
| 09 | TireHistoryModal: abre ao clicar botão Histórico | ✅ PASSOU | — |
| 10 | TireHistoryModal: exibe código do pneu e tabela de histórico | ❌ FALHOU | [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed |
| 11 | TireForm (edição): abre ao clicar Editar, campo Especificação editável | ⏭️ PULADO | — |
| 12 | TireForm (edição): salvar alteração persiste na tabela | ⏭️ PULADO | — |
| 13 | toggle Desativar: modal de confirmação abre e desativa pneu | ⏭️ PULADO | — |
| 14 | AddModeModal: opção "Por Modelo (Lote)" abre TireBatchForm | ⏭️ PULADO | — |

## Bugs Encontrados

- **Teste 10 — TireHistoryModal: exibe código do pneu e tabela de histórico**: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed
