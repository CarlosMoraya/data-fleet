# PRD - Documento de Requisitos do Produto (βetaFleet)

## 🎯 Objetivo do Produto
O **βetaFleet** é um sistema de gestão de frotas de alta performance, projetado para transportadoras que buscam digitalizar processos operacionais, reduzir custos de manutenção e garantir a conformidade de segurança através de inspeções rigorosas.

## 👥 Público-Alvo
1.  **Gestores de Frota**: Tomada de decisão baseada em custos e disponibilidade de veículos.
2.  **Analistas/Assistentes**: Operação diária, cadastros e aprovação de orçamentos.
3.  **Motoristas**: Preenchimento de checklists e comunicação de problemas.
4.  **Oficinas Parceiras**: Atualização de ordens de serviço e envio de orçamentos.
5.  **Auditores de Pátio**: Verificação externa e controle de qualidade.

---

## 🛠️ Escopo Funcional

### 1. Gestão de Ativos
- Cadastro completo de veículos e motoristas.
- Associação dinâmica de motoristas e veículos.
- Gestão de documentos com alertas de vencimento (CRLV, CNH, GR).

### 2. Checklists Inteligentes
- Criação de templates personalizados por categoria de veículo e contexto (Rotina, Segurança, Auditoria, etc).
- Preenchimento offline com sincronização automática.
- Captura de fotos e evidências.

### 3. Manutenção e Custos
- Workflow de Ordens de Serviço (OS) do orçamento à conclusão.
- Aprovação de orçamentos com limites de alçada por usuário.
- Extração automática de dados de orçamentos (OCR).

### 4. Gestão de Pneus
- Controle individualizado por código de fogo.
- Configuração visual de eixos do veículo.
- Histórico de movimentação e classificação visual (Novo, Meia Vida, Troca).

---

## 📈 Critérios de Sucesso
- **Disponibilidade**: Redução do tempo de veículo parado por falha em checklist.
- **Eficiência**: Menor tempo de aprovação de orçamentos via OCR.
- **Conformidade**: 100% dos veículos com checklists de segurança em dia.
- **Performance**: Tempo de carregamento do dashboard inferior a 2 segundos.
