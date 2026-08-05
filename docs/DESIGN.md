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
- Abaixo da tablist, um cabeçalho compacto (ícone + título + subtítulo da aba ativa) é gerado a partir dos metadados de cada aba — não duplica o `h1`.
- **Cards por agregado**: cada card de aprovação representa um agregado (uma OS ou um pedido de Pagamento Extra), nunca uma seleção livre entre agregados. O cabeçalho do card mostra os totais (custo aprovado/total pendente ou valor do pedido/soma das parcelas); a tabela de parcelas abaixo usa header `sticky top-0` e scroll horizontal (`overflow-x-auto`) para telas estreitas.
- **Segmented control** (`Aprovações` → `Pagamentos`/`Extras`): par de botões `role="tab"` dentro de um trilho arredondado (`rounded-xl` com padding), aba ativa em `bg-white` com `shadow-sm`; monta somente o segmento ativo dentro de `Suspense`.
- **Modal de confirmação de lote** (`FinancialApprovalConfirmModal`): título, entidade, quantidade de parcelas e total em BRL; botão de confirmação verde sem exigir texto digitado; desabilita todos os controles e mostra spinner durante o envio; erro aparece dentro do modal, nunca via `window.alert`.
- **Modal Itens/PDF** (`BudgetDocumentPreviewModal`): duas visões internas (`Itens`/`PDF`) com tablist própria; estados de carregamento/erro/vazio independentes por visão — PDF ausente não bloqueia Itens e vice-versa; em mobile ocupa a largura disponível com scroll interno (`max-h-[calc(100vh-2rem)]`).
- Todos os modais financeiros usam `role="dialog"`, `aria-modal="true"` e título associado via `aria-labelledby`; fecham por botão e por Escape (Escape é ignorado enquanto uma submissão está em andamento).
