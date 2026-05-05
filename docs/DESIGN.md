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
