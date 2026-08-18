# Design System - βetaFleet

## 💡 Visão Geral

O design do **βetaFleet** foi concebido para transmitir confiança, eficiência e modernidade. Ele prioriza a legibilidade em ambientes de alta luminosidade (pátios) e a elegância em ambientes corporativos (dashboard). Utiliza uma estética premium, moderna e focada em alta performance visual com Tailwind CSS v4.

---

## 🎨 Identidade Visual & Design System

### Paleta de Cores (Tailwind CSS v4)

#### Cores Principais
- **Primária**: `#f97316` (Orange 500) - Energia e atenção, ação e destaque.
- **Background (Dark)**: `#09090b` (Zinc 950).
- **Background (Light)**: `#ffffff` (White).
- **Texto (Dark Mode)**: `#f4f4f5` (Zinc 100).
- **Texto (Light Mode)**: `#18181b` (Zinc 900).

#### Alertas & Estados
- **Sucesso**: Esmeralda (Green) - Notificações discretas e badges verdes.
- **Erro**: Tons de vermelho (Red-500) - Explicações claras sobre como resolver.
- **Aviso**: Amber-500 - Para avisos e atenção.

### Tipografia
- **Font-family**: Inter (ou similar moderna sem serifa).
- **Logo**: Tipográfica com a letra grega **β** (Beta) em Orange-500, seguida por **etaFleet** em fonte geométrica moderna. Slogan: "Evolution always".

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

## 🛠️ Guia de Estilos & Componentes

### Botões
- **Primary**: Laranja (#f97316) com texto branco, efeito de hover escurecido.
- **Secondary**: Contorno zinc ou fundo transparente.
- **Destructive**: Vermelho sólido.
- **Estados**: `hover`, `active` e `disabled` bem definidos.
- **Extras**: Gradientes sutis em botões de ação e estados de loading.

### Cards
- Bordas arredondadas (`rounded-2xl`).
- Sombra sutil (`shadow-sm`).
- Border de 1px (`border-zinc-200`).
- Usar `backdrop-blur` em cards flutuantes (glassmorphism).

### Badges
- Use cores harmoniosas (HSL) para status.
- Exemplos: Esmeralda para "Ativo", Rosa para "Em Manutenção".

---

## 🏗️ Padrões de Componentes

### Multisseleção de filtros (checkbox visual)

Filtros de listagem em Cadastros usam `MultiSelectDropdown` (`src/components/MultiSelectDropdown.tsx`), uma multisseleção visual em checkbox:

- Gatilho com `aria-label` igual ao rótulo, `aria-haspopup="listbox"`, `aria-expanded` e `aria-controls`; texto `Rótulo` sem seleção e `Rótulo (N)` com seleção.
- Menu com `role="listbox"` e `aria-multiselectable="true"`; cada opção com `role="option"` e um único estado exposto por `aria-checked` (não usar `aria-selected` junto).
- O quadrado de checkbox é **apenas visual** (`aria-hidden="true"`); não inserir `input` interativo dentro de `role="option"`.
- Os botões "Selecionar todos" e "Limpar seleção" ficam fora do elemento `role="listbox"`.
- Teclado: `Enter`/`Espaço` alternam, `ArrowDown`/`ArrowUp` movem com ciclo, `Home`/`End` focam a primeira/última, `Escape` fecha e devolve o foco ao gatilho; ao abrir, foca a primeira opção selecionada (ou a primeira disponível).
- Opções aceitam `string[]` (retrocompatível com Manutenção) ou `{ value, label }[]`.

### Formulários Modais
- **Estrutura**: `fixed inset-0` com `backdrop-blur`.
- **Transições**: Devem ser suaves (micro-animações).
- **Persistência**: Persistência de formulários modais deve usar `useFormDraftState` ou `useSessionUiState` para estado de sessão, e `useUiPreference` para preferências duradouras.
- **Dados sensíveis**: Rascunhos sensíveis (senha, CPF, CNH) não são persistidos.

### Tabelas e Listas
- **Padrão de Scroll**: O cabeçalho deve ser sempre `sticky top-0`.
- **Raiz da Página**: `h-full flex flex-col gap-6`.
- **Tabela Wrapper**: `overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm flex-1 min-h-0 flex flex-col`.

> Este é o comportamento de **janela alta**. Em janelas de 900px de altura ou
> menos, ver "Densidade adaptativa por altura" logo abaixo — Checklists e
> Agendamentos passam a rolar pela página.

#### Densidade adaptativa por altura

A variante `tall` está registrada em `src/index.css`:

```css
@custom-variant tall (@media (min-height: 901px));
```

**Convenção obrigatória: `<valor-compacto> tall:<valor-confortável>`.** O valor
compacto é a classe base; a variante `tall` restaura o espaçamento de sempre.
A inversão é deliberada: escrever "compacto sobrepõe" faria o resultado depender
da ordem em que o Tailwind emite as variantes (`md:` vs. `tall:`), o que é uma
fonte real de comportamento imprevisível. Com a inversão, qualquer classe que
não receba um par `tall:` continua produzindo exatamente o resultado atual em
qualquer tela.

Regras:

- **Fonte de dados não encolhe.** Células, cabeçalhos de coluna e textos de dado
  mantêm o tamanho tipográfico em qualquer altura de janela — reduzir agravaria
  as violações de contraste já mapeadas. A densidade vem **exclusivamente** de
  espaçamento (`py-*`, `gap-*`, `h-*`) e de ocultar chrome redundante.
- **Sem detecção em JavaScript.** Nada de `matchMedia`, hook, contexto ou
  preferência persistida: é CSS puro, sem re-render.
- Chrome global (`Layout.tsx`, `Topbar.tsx`) recupera ~190px verticais: barra
  superior `h-12 tall:h-16` e área de conteúdo `p-4 tall:md:p-8`.

**Política de rolagem por tela em janela baixa:**

| Tela | Janela alta (>900px) | Janela baixa (≤900px) |
| :--- | :--- | :--- |
| Checklists | rolagem interna do card | **rolagem da página** (`<main>`), `thead` fixo no topo |
| Agendamentos | rolagem interna do card | **rolagem da página** (`<main>`), `thead` fixo no topo |
| Veículos | rolagem interna | rolagem interna |
| Plano de Ação | rolagem interna | rolagem interna |
| Demais telas com tabela | rolagem interna | rolagem interna |

A assimetria é consciente: Veículos e Plano de Ação têm tabelas mais largas que
1280px e, portanto, precisam de `overflow-x: auto` no contêiner. Um elemento com
`overflow-x: auto` também é scrollport **vertical**, então trocá-las para rolagem
de página custaria o cabeçalho de colunas fixo. **Não uniformizar as quatro
telas** sem resolver antes a priorização de colunas.

Ao migrar uma tela para rolagem de página, a cadeia **inteira** de contêineres
entre o `<thead>` e o `<main>` precisa liberar o overflow em janela baixa
(`overflow-visible tall:overflow-hidden` / `tall:overflow-auto`). `position: sticky`
só funciona dentro do scrollport mais próximo: qualquer ancestral com overflow
intermediário mata o cabeçalho fixo.

Contrato executável: `e2e/completed/table-scroll-shell.spec.ts` (valida as duas
alturas) e `e2e/completed/compact-density.spec.ts` (valida o ponto de corte).

---

## ✨ Estética Premium - Regras Mandatárias

1. **Glassmorphism**: Use `backdrop-blur` em overlays e cards flutuantes.
2. **Gradients**: Use gradientes sutis em botões de ação e estados de loading.
3. **Feedback Visual**: Botões devem ter estados de `hover`, `active` e `disabled` bem definidos.
4. **Badges**: Use cores harmoniosas (HSL) para status.
5. **Micro-animações**: Transições suaves em modais e interações.

---

## 📱 Responsividade (Mobile-First)

- O sistema deve ser totalmente operacional em dispositivos móveis.
- **Sidebar**: Transforma-se em um Drawer (Menu Hambúrguer) em telas menores.
- **Formulários**: Devem empilhar colunas em telas `sm` e `md`.
- **Modais**: Devem ocupar a largura total em dispositivos móveis.
- **Botões**: Aumentam de tamanho em telas pequenas para melhor acessibilidade em campo.
