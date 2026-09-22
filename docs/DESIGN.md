# Guia de Design - βetaFleet

## 💡 Visão Geral
O design do **βetaFleet** foi concebido para transmitir confiança, eficiência e modernidade. Ele prioriza a legibilidade em ambientes de alta luminosidade (pátios) e a elegância em ambientes corporativos (dashboard).

---

## 🎨 Identidade Visual

### Paleta de Cores
- **Primária**: `#f97316` (Orange 500) - Energia e atenção.
- **Background (Dark)**: `#09090b` (Zinc 950).
- **Background (Light)**: `#ffffff` (White).
- **Texto**: `#f4f4f5` (Zinc 100 - Dark mode) / `#18181b` (Zinc 900 - Light mode).

### Logotipo
A logo consiste na letra grega **β** em laranja, seguida pelo texto **etaFleet** em fonte geométrica moderna. O slogan "Evolution always" reforça o compromisso com a melhoria contínua.

---

## 📱 UX/UI Principles

### 1. Foco no Operador
As telas de preenchimento de checklist utilizam botões grandes e feedback tátil/visual imediato para facilitar o uso por motoristas em campo.

### 2. Dashboard Estratégico
O dashboard utiliza o princípio de "Progressive Disclosure", mostrando KPIs gerais primeiro e permitindo o detalhamento (drill-down) através de filtros interativos nos gráficos.

### 3. Estados de Dados
- **Vazio (Empty State)**: Mensagens amigáveis e botões de ação (ex: "Nenhum veículo encontrado. Adicione o primeiro!").
- **Erro**: Tons de vermelho com explicações claras sobre como resolver.
- **Sucesso**: Notificações discretas e badges verdes (Esmeralda).

---

## 🛠️ Guia de Estilos

### Botões
- **Primary**: Laranja com texto branco, efeito de hover escurecido.
- **Secondary**: Contorno zinc ou fundo transparente.
- **Destructive**: Vermelho sólido.

### Cards
- Bordas arredondadas (`rounded-2xl`).
- Sombra sutil (`shadow-sm`).
- Border de 1px (`border-zinc-200`).

### Topbar — chip de clima

- A Topbar possui um chip global de clima com estado normal em zinc neutro.
- Atenção usa amber; severidade usa red/amber suave.
- O popover aplica progressive disclosure e exibe previsão de 3 dias.
- Em mobile, o chip reduz o texto para preservar a Topbar.

### Financeiro — shell, cabeçalho de aba e aprovações agrupadas

- Shell com `h1` único (`Financeiro`) e tablist `overflow-x-auto`/`whitespace-nowrap` para as quatro abas em mobile.
- **Ordem das abas principais**: `Aprovação de Orçamentos` · `Aprovações` · `Pagamentos` · `Pagamentos Extras`. Aprovações vem antes de Pagamentos desde 2026-09-14, para seguir o fluxo aprovar → pagar. A ordem de exibição é a ordem do array `TAB_DEFS` em `src/pages/Financeiro.tsx`.
- **OS cancelada na fila de orçamentos pendentes** (`BudgetApprovals`): a linha ganha fundo `bg-red-50` (hover `bg-red-100`) e, abaixo do número da OS, um selo sólido `rounded-full bg-red-600 text-white text-xs font-bold` com `AlertTriangle` e o texto "OS CANCELADA"; o botão "Aprovar" fica desabilitado com a dica "OS cancelada — não é possível aprovar", e "Reprovar" continua disponível. **Contraste deliberado** com a pílula contornada "OS cancelada" da aba Aprovações, que segue contornada porque ali convive com o vermelho sólido de "Reprovado" — não uniformizar.
- Abaixo da tablist, um cabeçalho compacto (ícone + título + subtítulo da aba ativa) é gerado a partir dos metadados de cada aba — não duplica o `h1`.
- **Cards por agregado**: cada card de aprovação representa um agregado (uma OS ou um pedido de Pagamento Extra), nunca uma seleção livre entre agregados. O cabeçalho do card mostra os totais (custo aprovado/total pendente ou valor do pedido/soma das parcelas); a tabela de parcelas abaixo usa header `sticky top-0` e scroll horizontal (`overflow-x-auto`) para telas estreitas.
- **Segmented control** (`Aprovações` → `Pagamentos`/`Extras`): par de botões `role="tab"` dentro de um trilho arredondado (`rounded-xl` com padding), aba ativa em `bg-white` com `shadow-sm`; monta somente o segmento ativo dentro de `Suspense`. O mesmo padrão visual é reutilizado no segmented control interno da aba `Aprovação de Orçamentos` (`Pendentes`/`Histórico` em `BudgetApprovalsTab.tsx`), com a mesma trilha, mesmas classes e mesmo `role="tablist"`/`role="tab"`.
- **Pílulas de decisão do histórico de orçamentos**: `rounded-full px-2 py-0.5 text-xs font-medium` — aprovado em `bg-green-100 text-green-700`; reprovado em `bg-red-100 text-red-700`.
- **Modal de confirmação de lote** (`FinancialApprovalConfirmModal`): título, entidade, quantidade de parcelas e total em BRL; botão de confirmação verde sem exigir texto digitado; desabilita todos os controles e mostra spinner durante o envio; erro aparece dentro do modal, nunca via `window.alert`.
- **Modal Itens/PDF** (`BudgetDocumentPreviewModal`): duas visões internas (`Itens`/`PDF`) com tablist própria; estados de carregamento/erro/vazio independentes por visão — PDF ausente não bloqueia Itens e vice-versa; em mobile ocupa a largura disponível com scroll interno (`max-h-[calc(100vh-2rem)]`).
- Todos os modais financeiros usam `role="dialog"`, `aria-modal="true"` e título associado via `aria-labelledby`; fecham por botão e por Escape (Escape é ignorado enquanto uma submissão está em andamento).
- **Pagamentos — NF/Fatura, Competência e ordenação** (2026-09-16): a coluna "NF / Fatura" mostra os 10 primeiros caracteres seguidos de "…" quando o número é maior; o número completo aparece na dica nativa (`title`) ao passar o mouse e, ao tocar/clicar, a célula se expande no lugar (novo toque recolhe) — componente `TruncatedText`. A coluna "Competência" (`dd/mm/aaaa`, "—" quando vazia) fica imediatamente antes de "Vencimento". Os cabeçalhos dessas duas colunas são ordenáveis (`SortableHeader`, `aria-sort`): 1º clique crescente, 2º decrescente; trocar de coluna reinicia em crescente; parcelas sem data ficam sempre no fim; sem clique, a ordem original é mantida. A ordenação não é persistida e **não** afeta a ordem do XLSX nem a seleção em lote.
- **Centro de Custo nos modais financeiros**: em `Cadastrar Pagamento`, a seleção de uma OS preenche o input editável com o nome da unidade operacional do veículo; em `Novo Pagamento Extra`, a seleção da placa ou o caminho motorista → veículo faz o mesmo. Sem unidade, o campo fica vazio. O input pode ser alterado ou limpo manualmente, não há bloqueio nem sobrescrita posterior sem nova seleção de origem, e o valor final é persistido nas parcelas.

### Manutenção — cancelamento de OS (2026-09-19)

- **Caminho único.** O botão ⊘ da linha e a opção **Cancelar** do menu "Ações" abrem o **mesmo** modal de confirmação. Não existe segundo modal, e não se usa `window.confirm` aqui — confirmação por diálogo próprio é o padrão de ação destrutiva com motivo, como no Financeiro.
- **Modal de cancelamento.** Largura `max-w-md` (subiu de `max-w-sm` para acomodar o campo), a mesma do modal de reabertura de orçamento. Mantém o cabeçalho com ícone `Ban` em círculo `bg-red-100`, o bloco de contexto (OS, placa, status atual) e o aviso âmbar de parcelas lançadas.
- **Campo de motivo.** `<textarea id="cancel-reason" rows={3} maxLength={500}>` com `<label>` "Motivo do cancelamento" seguido de asterisco `text-red-500`, e contador `n/500` alinhado à direita em `text-xs text-zinc-400`. O botão de confirmação fica **desabilitado** enquanto o motivo estiver vazio ou só com espaços — mesma mecânica do "Confirmar reabertura".
- **Sem mínimo de caracteres.** O contrato é o mesmo dos outros quatro campos de motivo do produto: não-vazio após `trim`, máximo 500. Não introduzir piso de caracteres aqui.
- **Erro dentro do modal.** Falha de gravação aparece em faixa `rounded-lg border border-red-200 bg-red-50 text-red-700` logo acima do rodapé, com o modal aberto e o texto digitado preservado. Nunca `window.alert`.
- **Rótulo condicional preservado.** O botão continua alternando entre "Confirmar Cancelamento" e "Cancelar mesmo assim" conforme exista aviso de parcelas.
- **Bloco "Cancelamento" no modal de visualização.** Em OS com status `Cancelado`, o `MaintenanceDetailModal` abre o corpo com uma `<section>` de cabeçalho `Ban` + título `text-red-600 uppercase`, e um cartão `rounded-xl border border-red-200 bg-red-50` em grade de 2 colunas: "Cancelada por", "Data do cancelamento" e, ocupando as duas colunas, "Motivo do cancelamento". Em OS não cancelada o bloco não é renderizado.
- **Rótulos de ausência.** Motivo inexistente (OS canceladas antes desta mudança) exibe **"Não informado"**; autor não resolvível exibe **"Não identificado"**. Nunca campo em branco, nunca travessão nesses dois campos.

### Cadastros — filtros de listagem em multisseleção

- Os filtros de lista de Veículos e Motoristas (Embarcador, Unidade Operacional, Proprietário, Pendência/Situação, Disponibilidade e Última rota) usam um dropdown de multisseleção em checkbox visual.
- Em Veículos, Proprietário reutiliza o mesmo `MultiSelectDropdown`, com checkbox visual e contagem no rótulo; várias opções combinam com OR e dimensões distintas com AND.
- Cada dimensão permite marcar várias opções; dentro da dimensão as opções combinam com OR e entre dimensões com AND.
- O contêiner dos filtros usa `flex-wrap` para quebrar linha sem overflow na largura suportada.
- Disponibilidade reflete a regra de indisponibilidade por ordem de manutenção; Última rota permanece exclusiva do tenant Deluna Transportes.
- A data da última rota também aparece como linha de apoio na listagem de Manutenção, exclusiva do tenant Deluna.

### Responsividade — densidade adaptativa por altura de tela

- **O problema**: em notebooks de 1366×768 (ou 1920×1080 com zoom acima de 110%), a barra superior, os títulos de página e os respiros consumiam tanto espaço vertical que a lista de veículos exibia praticamente uma linha por vez. O usuário rolava a tabela inteira sem nunca ver um conjunto de registros.
- **O que o produto faz**: quando a janela tem **900px de altura ou menos**, a interface entra automaticamente em densidade compacta — barra superior mais baixa, títulos menores, subtítulos de apoio recolhidos, abas e linhas de tabela com menos respiro. Não há botão nem preferência a configurar: o sistema decide pelo espaço disponível, como fazem os *density modes* de Material Design, IBM Carbon e Ant Design.
- **Em telas altas nada muda.** Acima de 900px de altura o produto é idêntico ao que sempre foi — mesmo respiro, mesma altura de linha, mesmos subtítulos.
- **O texto dos dados nunca encolhe.** A densidade vem só de espaçamento e de esconder chrome redundante (subtítulos, cartões de contagem duplicados em Plano de Ação). Reduzir a fonte dos dados prejudicaria a legibilidade e a acessibilidade em campo.
- **Checklists e Agendamentos** passam a rolar pela página inteira em tela baixa, com o cabeçalho de colunas fixo no topo: uma única barra de rolagem em vez de duas. Veículos e Plano de Ação mantêm rolagem interna porque suas tabelas também rolam na horizontal.
