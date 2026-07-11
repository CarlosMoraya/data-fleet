# Testes Humanos — BetaFleet

> Checklist de testes manuais seguindo o fluxo feliz (happy path) de ponta a ponta.
> Conforme você testar cada item, substitua `[ ]` por `[x]`.

---

## 1. Autenticação e Primeiro Acesso

### 1.1 Login
- [x] Acessar a tela de login (`/login`)
- [x] Fazer login com e-mail/senha de um usuário válido
- [x] Verificar redirecionamento para o Dashboard
- [x] Fazer logout e confirmar que voltou à tela de login
- [x] Tentar login com credenciais inválidas — verificar mensagem de erro

### 1.2 Navegação e Layout
- [x] Sidebar exibe apenas os menus que o papel do usuário tem permissão
- [x] Topbar exibe nome do usuário e papel (role)
- [x] Trocar de tenant (se aplicável) — seletor de cliente no topo

---

## 2. Dashboard

### 2.1 Painel Operacional
- [x] KPIs são carregados: total de veículos, veículos em manutenção, checklists atrasados, CRLVs vencidos, CNHs vencidas
- [x] Gráficos são renderizados: distribuição por tipo de veículo, manutenção por tipo, frota por embarcador/unidade operacional
- [ ] Filtro de período de datas funciona e persiste no `localStorage` - REAVALIAR ESSE TIPO DE FILTRO (TALVEZ SÓ FAÇA SENTIDO PARA A GUIA Painel de custos de manutenção)
- [x] Filtros de tipo de veículo e tipo de manutenção funcionam

---

## 3. Cadastros — Usuários

- [x] Acessar `/cadastros/usuarios`
- [x] Criar novo usuário com papel (role) inferior ao seu
- [x] Definir limites de exclusão (`can_delete_vehicles`, `can_delete_drivers`, `can_delete_workshops`)
- [x] Definir limite de aprovação de orçamento (`budget_approval_limit`)
- [x] Se papel for "Operations Manager", associar escopos (embarcador/unidade operacional)
- [x] Editar usuário existente
- [O] Desativar/ativar usuário - VERIFICAR O CONTEXTO DISSO
- [x] Excluir usuário (se tiver permissão)

---

## 4. Cadastros — Veículos

- [x] Acessar `/cadastros/veiculos`
- [x] Criar novo veículo preenchendo todos os campos obrigatórios:
  - Placa, RENAVAM, chassi, marca, modelo, ano, cor
  - Tipo de veículo, fonte de energia, tipo de aquisição
  - Status (Ativo/Inativo)
- [x] Associar um motorista ao veículo (`driver_id`)
- [x] Associar embarcador e unidade operacional
- [x] Configurar eixos (configuração de rodagem, tipo de eixo, pneus físicos)
- [x] Inserir dados de garantia e revisão (km da primeira revisão, data limite)
- [x] Anexar documentos: CRLV, vistoria sanitária, GR, apólice de seguro, contrato de manutenção
- [x] Configurar intervalo de KM (`VehicleKmIntervalSettings`)
- [x] Salvar e verificar o veículo na listagem
- [x] Editar o veículo
- [x] Visualizar detalhes do veículo no modal
- [O] Alternar status ativo/inativo - VERIFICAR ONDE ESTÁ ESSA VISUALIZAÇÃO DE ATIVO E INATIVO

---

## 5. Cadastros — Motoristas

- [X] Acessar `/cadastros/motoristas`
- [X] Criar novo motorista com CPF único
- [X] Preencher dados da CNH: número, categoria, Renach, data de emissão, data de validade
- [X] Anexar documentos: CNH, GR, certificados (até 3)
- [X] Vincular perfil de usuário (`profileId`)
- [X] Editar motorista
- [X] Visualizar detalhes no modal
- [X] Excluir motorista (se tiver permissão)

---

## 6. Cadastros — Oficinas

- [x] Acessar `/cadastros/oficinas`
- [x] Criar nova oficina com CNPJ, endereço, especialidades, contato
- [x] Editar oficina
- [x] Convidar oficina (workshop invitation):
  - [x] Gerar convite com token
  - [x] Aceitar convite pelo link `/workshop/join`
  - [x] Verificar parceria ativa em `workshop_partnerships`
- [x] Desativar/reativar parceria com oficina
- [O] Visualizar histórico de auditoria da parceria - NÃO LOCALIZEI ESSA FUNÇÃO

---

## 7. Cadastros — Embarcadores

- [x] Acessar `/cadastros/embarcadores`
- [x] Criar novo embarcador com CNPJ
- [x] Editar embarcador
- [x] Alternar status ativo/inativo

---

## 8. Cadastros — Unidades Operacionais

- [x] Acessar `/cadastros/unidades-operacionais`
- [x] Criar unidade operacional vinculada a um embarcador
- [x] Preencher código, cidade, estado
- [x] Editar unidade operacional

---

## 9. Cadastros — Pneus

- [x] Acessar `/cadastros/pneus`
- [x] Cadastrar pneu individual: código do pneu, DOT, fogo, fabricante, marca, especificação
- [x] Classificar visualmente: `Novo`, `Meia vida`, `Troca`
- [x] Posicionar o pneu em um veículo (selecionar eixo e posição)
- [X] Cadastro em lote (batch registration)
- [X] Visualizar histórico de posições do pneu
- [x] Visualizar diagrama da planta baixa do veículo com posições dos pneus
- [X] Editar pneu
- [X] Editar configuração de eixos do veículo (`AxleConfigEditor`)

---

## 10. Checklists — Templates

- [x] Acessar `/checklist-templates`
- [x] Criar novo template:
  - [x] Definir contexto: `Rotina`, `Auditoria`, `Reboque`, `Entrada em Oficina`, `Saida de Oficina`, `Seguranca`
  - [x] Definir categoria do veículo: `Leve`, `Medio`, `Pesado`, `Eletrico`
- [x] Adicionar itens ao template:
  - Título, descrição, obrigatório, foto em não conformidade, pode bloquear veículo, ação padrão
- [x] Salvar template como rascunho (draft)
- [x] Publicar template (publish) — cria uma versão
- [x] Editar template (gera nova versão)
- [x] Depreciar template (deprecated)

---

## 11. Checklists — Preenchimento

- [x] Acessar `/checklists`
- [x] Iniciar novo checklist a partir de um template publicado
- [x] Responder cada item: `ok` / `issue` / `skipped` / `not_applicable`
- [x] Para itens com `photo_on_issue`, tirar foto ao marcar `issue`
- [x] Capturar coordenadas GPS
- [x] Informar odômetro (km)
- [x] Finalizar o checklist
- [x] Verificar checklist na listagem com status correto
- [ ] Testar preenchimento offline: PONTO QUE AINDA PRECISA SER MELHORADO
  - [X] Desativar internet
  - [X] Preencher checklist
  - [X] Fotos armazenadas no IndexedDB
  - [X] Reativar internet — verificar sincronização automática - SINCRONIZA, MAS PÁGINA FICA EM LOOP ATÉ RECONECTAR

---

## 12. Planos de Ação

- [x] Acessar `/acoes`
- [O] Criar plano de ação a partir de um item de checklist com `issue` - A AÇÃO É CRIADA MAS PARA APARECER NA TELA PRECISA DE REFLESH NA TELA
- [X] Preencher: nome, responsável, data de vencimento
- [x] Associar foto como evidência
- [o] Capturar localização GPS - NÃO IDENTIFIQUEI A CAPTURA DE LOCALIZAÇÃO
- [x] Avançar status: `pending` → `in_progress` → `awaiting_conclusion` → `completed`
- [x] Responsável assume o plano (claim)
- [x] Concluir com evidência de conclusão (foto)
- [o] Cancelar plano de ação (com motivo) - NÃO LOCALIZEI ESSA FUNCIONALIDADE

---

## 13. Inspeção de Pneus

- [x] Acessar `/inspecao-pneus/:inspectionId`
- [x] Iniciar inspeção para um veículo
- [x] Inspecionar pneu por pneu nas posições geradas dinamicamente
- [x] Marcar cada pneu como `conforme` ou `nao_conforme`
- [o] Tirar foto por pneu (com timestamp) - VERIFICAR SE TIMESTAMP ESTA APARECENDO
- [x] Informar odômetro e GPS
- [x] Finalizar inspeção
- [o] Testar inspeção offline com sincronização - AINDA NÃO TESTEI

---

## 14. Agendamentos (Oficina)

- [x] Acessar `/agendamentos`
- [x] Agendar veículo para oficina: veículo, oficina, data
- [x] Verificar status inicial: `scheduled`
- [x] Completar agendamento automaticamente via checklist "Saida de Oficina"
- [x] Cancelar agendamento

---

## 15. Ordens de Manutenção

- [x] Acessar `/manutencao`
- [x] Criar ordem de manutenção:
  - [x] Tipo: `Preventiva`, `Preditiva`, `Corretiva`
  - [x] Veículo, oficina, mecânico, datas (entrada, previsão de saída)
  - [x] Número OS da oficina
- [x] Avançar fluxo de orçamento:
  - [x] Status inicial: `Aguardando orcamento`
  - [x] Adicionar itens do orçamento (nome, sistema, quantidade, valor)
  - [x] Anexar PDF do orçamento
  - [x] Extrair dados via OCR (Gemini Vision) — se disponível
  - [x] Status muda para `Aguardando aprovacao`
- [x] Aprovar orçamento (se dentro do limite):
  - [x] Status muda para `Orcamento aprovado` → `Servico em execucao`
- [x] Concluir manutenção: status `Concluido`
- [x] Cancelar ordem de manutenção (com motivo)

---

## 16. Aprovação de Orçamentos

- [x] Acessar `/aprovacao-orcamentos`
- [x] Visualizar orçamentos pendentes
- [x] Aprovar orçamento (dentro do limite de aprovação)
- [x] Reprovar orçamento
- [o] Visualizar histórico de revisão (reviewed by/at) - NÃO LOCALIZEI HISTÓRICO DE REVISÕES
- [ ] Aprovar um orçamento com itens conhecidos (ex.: soma R$ 1.370,00) e confirmar que em Financeiro → Cadastrar Pagamento a OS aparece com o valor real (não R$ 0,00) e permite salvar parcelas
- [ ] Modal de "Cadastrar Pagamento": abrir, preencher campos, alternar para outra aba do navegador, voltar — confirmar que o modal continua aberto com os campos preservados
- [ ] Fazer logout e login com outro usuário — confirmar que o perfil recarrega normalmente (sem regressão da guarda de `SIGNED_IN`)

---

## 17. Configurações (Settings)

- [x] Acessar `/settings`
- [x] Ajustar intervalo de dias para checklists: `Rotina`, `Seguranca`, `Pneus`
- [x] Configurar KM máximo entre revisões por veículo (`VehicleKmIntervalSettings`)

---

## 18. Admin (Admin Master)

- [x] Acessar `/admin/clients`
- [x] Criar/editar cliente (tenant)
- [x] Acessar `/admin/users`
- [x] Gerenciar usuários de todos os tenants

---

## 19. Fluxo Logado como Oficina

- [x] Fazer login como usuário de oficina (workshop)
- [x] Seletor de transportadora (transporter selector) funciona
- [x] Visualizar apenas ordens de manutenção da sua oficina
- [x] Atualizar status das ordens
- [x] Visualizar agendamentos da oficina

---

## 20. Testes Transversais

### 20.1 Controle de Acesso (RBAC)
- [x] Usuário sem permissão não consegue acessar rota restrita (verificar redirect ou erro)
- [x] Usuário não consegue criar outro usuário com papel superior ao seu

### 20.2 Documentos e Uploads
- [x] Upload de imagem para documento de veículo

---

## 21. Self-service de Senha (Supabase Auth)

### 21.1 Recuperação real por e-mail
- [ ] Acessar `/recuperar-senha`
- [ ] Informar um e-mail de teste real
- [ ] Confirmar recebimento do e-mail de recuperação com assunto/template βetaFleet em PT-BR
- [ ] Clicar no link do e-mail e confirmar redirecionamento para `/redefinir-senha`
- [ ] Definir uma nova senha válida
- [ ] Confirmar redirecionamento para `/login` com o banner "Senha redefinida com sucesso. Faça login com a nova senha."
- [ ] Entrar usando a nova senha

### 21.2 Alteração de senha com usuário logado
- [ ] Fazer login
- [ ] Acessar "Alterar senha" no rodapé da Sidebar
- [ ] Informar senha atual incorreta e confirmar erro "Senha atual incorreta."
- [ ] Informar senha atual correta e nova senha válida
- [ ] Confirmar banner "Senha alterada com sucesso."
- [ ] Fazer logout e login novamente com a nova senha

### 21.3 Resposta segura contra enumeração de e-mail
- [ ] Repetir a recuperação em `/recuperar-senha` com e-mail inexistente
- [ ] Confirmar que a tela mostra a mesma mensagem neutra exibida para e-mail existente
- [ ] Confirmar que nenhum e-mail é recebido para o endereço inexistente
- [x] Upload de imagem para documento de motorista
- [x] Upload de PDF para orçamento de manutenção
- [x] Visualizar/documentos anexados nos modais de detalhe

### 20.3 Offline
- [x] Checklist preenchido offline é sincronizado ao voltar online
- [x] Inspeção de pneus offline é sincronizada ao voltar online
- [x] Banner offline é exibido quando sem conexão

### 20.4 Sessão
- [x] Sessão expira após 60 minutos de inatividade (idle timeout)
- [x] Redirecionamento para login ao expirar

---

## Resumo de Progresso

| Módulo | Itens | Concluídos |
|--------|-------|------------|
| 1. Autenticação | — | **0 / 0** |
| 2. Dashboard | — | **0 / 0** |
| 3. Usuários | — | **0 / 0** |
| 4. Veículos | — | **0 / 0** |
| 5. Motoristas | — | **0 / 0** |
| 6. Oficinas | — | **0 / 0** |
| 7. Embarcadores | — | **0 / 0** |
| 8. Unid. Operacionais | — | **0 / 0** |
| 9. Pneus | — | **0 / 0** |
| 10. Templates Checklist | — | **0 / 0** |
| 11. Preenchimento Checklist | — | **0 / 0** |
| 12. Planos de Ação | — | **0 / 0** |
| 13. Inspeção de Pneus | — | **0 / 0** |
| 14. Agendamentos | — | **0 / 0** |
| 15. Manutenção | — | **0 / 0** |
| 16. Aprovação Orçamentos | — | **0 / 0** |
| 17. Settings | — | **0 / 0** |
| 18. Admin | — | **0 / 0** |
| 19. Fluxo Oficina | — | **0 / 0** |
| 20. Testes Transversais | — | **0 / 0** |
| **Total** | — | **0 / 0** |
