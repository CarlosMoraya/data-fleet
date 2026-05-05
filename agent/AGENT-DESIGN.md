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

### Formulários Modais
- **Estrutura**: `fixed inset-0` com `backdrop-blur`.
- **Transições**: Devem ser suaves (micro-animações).
- **Persistência**: Estados de formulário abertos devem ser sincronizados com `sessionStorage`.

### Tabelas e Listas
- **Padrão de Scroll**: O cabeçalho deve ser sempre `sticky top-0`.
- **Raiz da Página**: `h-full flex flex-col gap-6`.
- **Tabela Wrapper**: `overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm flex-1 min-h-0 flex flex-col`.

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
