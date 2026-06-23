# AGENT-INFRA - Configurações, Deploy e Infraestrutura

Este documento descreve como configurar o ambiente de desenvolvimento, executar testes e realizar o deploy do **βetaFleet**.

## 🌐 Ambiente de Desenvolvimento

### Variáveis de Ambiente (`.env.local`)
O projeto requer as seguintes chaves para funcionamento pleno:
```bash
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
GEMINI_API_KEY=... # Necessário para o OCR inteligente
```

---

## 🧪 Testes E2E (Playwright)

O projeto possui uma suite robusta de mais de 75 testes automatizados.

### Comandos
- **Rodar todos**: `npx playwright test`
- **Modo UI**: `npx playwright test --ui`
- **Relatório**: `npx playwright show-report`

### Perfis de Teste
Os testes são executados simulando diferentes personas:
- **Admin Master**: Controle total e cross-tenant.
- **Fleet Analyst / Manager**: Gestão do tenant específico.
- **Fleet Assistant**: Operacional e visualização.

---

## 🚀 Deploy e Hosting

### Frontend (Vercel)
- O projeto está configurado para deploy automático na Vercel.
- **Rewrites**: O arquivo `vercel.json` garante que as rotas SPA funcionem corretamente (evitando erros 404 ao atualizar a página).

### Backend (Supabase)
- **Database/Auth**: Alterações via migrations manuais no SQL Editor ou pelo CLI (`supabase db query`).
- **Edge Functions**: Deploy via Dashboard (não utiliza CLI).

### Banco de Dados — Dev vs Prod (regra crítica)
- Existem **dois** bancos Supabase separados:
  - **Dev**: `vvbnbzzhpiksacqudmfu` — referenciado em `.env.local`. Toda migration **DEVE** ser aplicada aqui primeiro e validada.
  - **Prod**: `oajfjdadcicgoxrfrnny` — referenciado em `.env.production`. Aplicar migration aqui é **PROIBIDO** exceto com **autorização expressa do usuário**.
- **Regra de ouro**: o agente NUNCA aplica migration em produção por iniciativa própria. Sempre aplicar em Dev primeiro, testar, e somente promover a Prod quando o usuário disser explicitamente "pode aplicar em produção" (ou equivalente).
- **CLI**: ao usar `supabase link --project-ref <ref>`, sempre desvincular (`supabase unlink`) ao terminar, para evitar que o CLI permaneça apontado para produção.
- **MEMORY.md**: a referência ao ref de produção como "legado" é intencional — funciona como barreira de segurança para que agentes não apliquem migrations em prod sem autorização.

---

## 🛠️ Ferramentas e Serviços Externos
- **Google Gemini**: Utilizado para extração de dados complexos (OCR) via Vision API.
- **Supabase Storage**: Armazenamento de documentos e fotos de checklists.
- **IndexedDB**: Cache local para operação offline em dispositivos móveis.
