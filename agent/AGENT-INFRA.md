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
- **Database/Auth**: Alterações feitas via migrations manuais no Dashboard.
- **Edge Functions**: Deploy via Dashboard (não utiliza CLI).

---

## 🛠️ Ferramentas e Serviços Externos
- **Google Gemini**: Utilizado para extração de dados complexos (OCR) via Vision API.
- **Supabase Storage**: Armazenamento de documentos e fotos de checklists.
- **IndexedDB**: Cache local para operação offline em dispositivos móveis.
