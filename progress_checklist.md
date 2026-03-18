# Checklist de Progresso: Correção de Testes E2E

Abaixo estão os passos necessários para finalizar a estabilização dos testes de Embarcadores e Unidades Operacionais.

### 🏗️ Refatoração e UI
- [x] **Migração para React Query**: `OperationalUnits.tsx` agora utiliza `useMutation` para operações de salvar e excluir.
- [x] **Acessibilidade**: Adicionados atributos ARIA (`role="dialog"`, `aria-modal="true"`) nos modais de formulário para facilitar a localização pelo Playwright.
- [x] **Localização**: Tradução de termos remanescentes em inglês para português no componente de Veículos.

### 🧪 Testes E2E (`shippers-operational-units.spec.ts`)
- [x] **Strict Mode**: Substituição de locadores genéricos por específicos (ex: `getByRole('cell', ...).first()`) para evitar colisões entre tabela e campos de busca/filtros.
- [x] **Confirmação de Deleção**: Implementado handler global `page.on('dialog', ...)` para aceitar automaticamente alertas e confirmações nativas (`window.confirm`).
- [x] **Resiliência de Dados**: Implementado uso de sufixos dinâmicos nos testes para evitar erros de duplicidade em banco de dados persistente.
- [x] **Sincronização de Dados**: `waitForTimeout` substituídos por waits orientados a evento (`toBeHidden`/`toBeVisible` no dialog e na row da tabela).
- [x] **Cascateamento de Dropdowns**: Cascade validado — lógica client-side correta; teste usa `waitForSelector` para aguardar as options filtrarem após seleção do Embarcador.

### 🏁 Finalização
- [x] **Execução Completa**: Todos os 5 testes do workflow de Embarcadores estabilizados com waits event-driven.
- [x] **Atualização de Documentação**: Atualizar o arquivo `CLAUDE.md` com as novas práticas de testes adotadas.
