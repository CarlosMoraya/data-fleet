# Relatório E2E — Axle Configuration (Manager)
Data: 12/04/2026, 12:53:46

**Resumo:** 6 passaram · 1 falharam · 5 pulados

## Resultados

| # | Teste | Status | Erro |
|---|-------|--------|------|
| 01 | AxleConfigEditor aparece ao preencher eixos=2 (tipo não Moto) | ✅ PASSOU | — |
| 02 | Eixo 1 automaticamente inicializado como Direcional | ✅ PASSOU | — |
| 03 | Eixo 1: select Tipo desabilitado (não editável) | ✅ PASSOU | — |
| 04 | Eixo 1: rodagem "Tripla" não aparece como opção | ✅ PASSOU | — |
| 05 | badge "1/2 eixos configurados" exibido (incompleto = amarelo) | ✅ PASSOU | — |
| 06 | botão "+ Adicionar eixo 2" visível quando configuração incompleta | ✅ PASSOU | — |
| 07 | clicar "+ Adicionar eixo 2" adiciona nova linha de eixo | ❌ FALHOU | [2mexpect([22m[31mlocator[39m[2m).[22mtoHaveCount[2m([22m[32mexpected[39m[2m)[22m failed |
| 08 | badge "2/2 eixos configurados" exibido após completar (verde) | ⏭️ PULADO | — |
| 09 | total de pneus calculado e exibido após configuração completa | ⏭️ PULADO | — |
| 10 | Estepes de fábrica: incrementar adiciona ao total de pneus | ⏭️ PULADO | — |
| 11 | warning "Configure todos os eixos" visível quando incompleto | ⏭️ PULADO | — |
| 12 | eixos=3 com Duplo: tipo multi-eixo disponível quando slots >= 2 | ⏭️ PULADO | — |

## Bugs Encontrados

- **Teste 07 — clicar "+ Adicionar eixo 2" adiciona nova linha de eixo**: [2mexpect([22m[31mlocator[39m[2m).[22mtoHaveCount[2m([22m[32mexpected[39m[2m)[22m failed
