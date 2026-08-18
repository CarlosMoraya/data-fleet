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
- **Segmented control** (`Aprovações` → `Pagamentos`/`Extras`): par de botões `role="tab"` dentro de um trilho arredondado (`rounded-xl` com padding), aba ativa em `bg-white` com `shadow-sm`; monta somente o segmento ativo dentro de `Suspense`. O mesmo padrão visual é reutilizado no segmented control interno da aba `Aprovação de Orçamentos` (`Pendentes`/`Histórico` em `BudgetApprovalsTab.tsx`), com a mesma trilha, mesmas classes e mesmo `role="tablist"`/`role="tab"`.
- **Pílulas de decisão do histórico de orçamentos**: `rounded-full px-2 py-0.5 text-xs font-medium` — aprovado em `bg-green-100 text-green-700`; reprovado em `bg-red-100 text-red-700`.
- **Modal de confirmação de lote** (`FinancialApprovalConfirmModal`): título, entidade, quantidade de parcelas e total em BRL; botão de confirmação verde sem exigir texto digitado; desabilita todos os controles e mostra spinner durante o envio; erro aparece dentro do modal, nunca via `window.alert`.
- **Modal Itens/PDF** (`BudgetDocumentPreviewModal`): duas visões internas (`Itens`/`PDF`) com tablist própria; estados de carregamento/erro/vazio independentes por visão — PDF ausente não bloqueia Itens e vice-versa; em mobile ocupa a largura disponível com scroll interno (`max-h-[calc(100vh-2rem)]`).
- Todos os modais financeiros usam `role="dialog"`, `aria-modal="true"` e título associado via `aria-labelledby`; fecham por botão e por Escape (Escape é ignorado enquanto uma submissão está em andamento).

### Cadastros — filtros de listagem em multisseleção

- Os filtros de lista de Veículos e Motoristas (Embarcador, Unidade Operacional, Pendência/Situação, Disponibilidade e Última rota) usam um dropdown de multisseleção em checkbox visual.
- Cada dimensão permite marcar várias opções; dentro da dimensão as opções combinam com OR e entre dimensões com AND.
- O contêiner dos filtros usa `flex-wrap` para quebrar linha sem overflow na largura suportada.
- Disponibilidade reflete a regra de indisponibilidade por ordem de manutenção; Última rota permanece exclusiva do tenant Deluna Transportes.

### Responsividade — densidade adaptativa por altura de tela

- **O problema**: em notebooks de 1366×768 (ou 1920×1080 com zoom acima de 110%), a barra superior, os títulos de página e os respiros consumiam tanto espaço vertical que a lista de veículos exibia praticamente uma linha por vez. O usuário rolava a tabela inteira sem nunca ver um conjunto de registros.
- **O que o produto faz**: quando a janela tem **900px de altura ou menos**, a interface entra automaticamente em densidade compacta — barra superior mais baixa, títulos menores, subtítulos de apoio recolhidos, abas e linhas de tabela com menos respiro. Não há botão nem preferência a configurar: o sistema decide pelo espaço disponível, como fazem os *density modes* de Material Design, IBM Carbon e Ant Design.
- **Em telas altas nada muda.** Acima de 900px de altura o produto é idêntico ao que sempre foi — mesmo respiro, mesma altura de linha, mesmos subtítulos.
- **O texto dos dados nunca encolhe.** A densidade vem só de espaçamento e de esconder chrome redundante (subtítulos, cartões de contagem duplicados em Plano de Ação). Reduzir a fonte dos dados prejudicaria a legibilidade e a acessibilidade em campo.
- **Checklists e Agendamentos** passam a rolar pela página inteira em tela baixa, com o cabeçalho de colunas fixo no topo: uma única barra de rolagem em vez de duas. Veículos e Plano de Ação mantêm rolagem interna porque suas tabelas também rolam na horizontal.
