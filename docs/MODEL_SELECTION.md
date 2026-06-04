# MODEL_SELECTION.md

**Última atualização:** 18 de maio de 2026
**Propósito:** Documento de consulta usado pelos prompts `Evolucao.md` e `Fixbugs.md` para escolher o melhor modelo de IA para executar um `IMPLEMENTATION.md` ou `IMPLEMENTATION_FIXBUG.md`.
**Idioma de operação:** Português do Brasil.

---

## Parte 1 — Como usar este documento

Você (agente arquiteto) está aqui porque acabou de gerar um `IMPLEMENTATION.md` ou `IMPLEMENTATION_FIXBUG.md`. Sua tarefa agora é recomendar os 3 modelos com melhor desempenho para executá-lo.

**Procedimento de decisão:**

1. **Leia o `IMPLEMENTATION.md` que você acabou de gerar.** Identifique:
   - Qual(is) camada(s) do sistema é(são) tocada(s): Frontend / Backend / Database / Design / Infra
   - Quais domínios funcionais aparecem: autenticação, autorização, API REST, queries SQL, componentes UI, animações, etc.
   - Quais stacks/linguagens/frameworks são usados: React, Vue, Django, FastAPI, Prisma, etc.
   - O grau de complexidade: trivial / médio / complexo / crítico
   - Restrições especiais: segurança, compliance, performance, licenciamento

2. **Faça matching com as seções deste documento, nesta ordem de prioridade:**
   - Parte 4 (Domínio funcional) — *mais específico, prevalece*
   - Parte 6 (Stack/linguagem) — *segundo critério*
   - Parte 3 (Camada do sistema) — *fallback genérico*
   - Parte 7 (Tipo de bug, se for Fixbugs) — *só para correções*

3. **Combine recomendações de múltiplas seções** se a SPEC cobrir múltiplos domínios. Quando duas seções recomendarem modelos diferentes, use os tie-breakers da Parte 9.

4. **Aplique os anti-patterns da Parte 8** antes de finalizar — descarte modelos contraindicados para o caso.

5. **Produza a saída no formato exato da Parte 10.**

**Critérios de ponderação (sempre nesta ordem):**
1. Performance específica para o domínio da SPEC (benchmark dedicado quando existir)
2. Custo-benefício (performance / preço)
3. Adequação a restrições do projeto (licença, self-host, latência)

**Regra de ouro:** se o domínio tem benchmark dedicado (ex: CyberSecEval para segurança, BIRD-SQL para SQL, WebDev Arena para frontend), o modelo líder nesse benchmark prevalece sobre o modelo líder em benchmarks genéricos como SWE-Bench.

---

## Parte 2 — Tabela mestre dos modelos

Todos os 20 modelos rastreados pela pesquisa, ordenados por tier e tipo. **Para os prompts `Evolucao.md` e `Fixbugs.md` use APENAS modelos com a marca ✅ ABERTO.**

### Modelos abertos (recomendados para os prompts)

| Modelo | Provedor | Licença | Context | Input $/M | Output $/M | SWE-Bench Pro | LiveCodeBench | Terminal-Bench 2.0 | Status |
|---|---|---|---|---|---|---|---|---|---|
| **glm-5.1** | Z.ai | MIT | 200K | $0,95 | $3,15 | **58,4%** (#1) | competitivo | 63,5–66,5% | ✅ ABERTO |
| **kimi-k2.6** | Moonshot | Modified MIT | 262K | $0,60 | $2,50 | **58,6%** | **89,6%** | 66,7% | ✅ ABERTO |
| **deepseek-v4-pro** | DeepSeek | MIT | **1M** | $0,435 (promo) | $0,87 (promo) | ~57% | **93,5%** (#1) | 67,9% | ✅ ABERTO |
| **qwen3.6-plus** | Alibaba | Closed-weights | **1M** | $0,325 | $1,95 | 56,6% | competitivo | 61,6% | ✅ ABERTO (API) |
| **minimax-m2.5** | MiniMax | **MIT** | 205K | $0,30 | $1,20 | 55,4% | n/d | 42,2% | ✅ ABERTO |
| **mimo-v2.5-pro** | Xiaomi | **MIT** | **1M** | $1,00 | $3,00 | 57,2% | n/d | **68,4%** | ✅ ABERTO |
| **mimo-v2.5** | Xiaomi | **MIT** | 1M | $0,40 | $2,00 | n/d | n/d | n/d | ✅ ABERTO (omnimodal) |

### Modelos abertos disponíveis mas NÃO recomendados para os prompts

| Modelo | Motivo da exclusão |
|---|---|
| glm-5 | Deprecation programada para 14/mai/2026 — migrar para glm-5.1 |
| kimi-k2.5 | Substituído pelo k2.6 com mesma faixa de preço e performance superior |
| qwen3.5-plus | Substituído pelo qwen3.6-plus |
| minimax-m2.7 | **License Non-Commercial** — incompatível com projetos comerciais |

### Modelos fechados (NÃO usar nos prompts; mantidos apenas para referência)

| Modelo | SWE-Bench Pro | Input $/M | Output $/M | Status |
|---|---|---|---|---|
| gpt-5.5-pro | ~58,6%+ | $30,00 | $180,00 | ❌ FECHADO |
| gpt-5.5 | 58,6% | $5,00 | $30,00 | ❌ FECHADO |
| gpt-5.5 (fast) | 58,6% | $12,50 | $75,00 | ❌ FECHADO |
| gpt-5.4 | 57,7% | $2,50 | $15,00 | ❌ FECHADO |
| gpt-5.4 (fast) | 57,7% | $6,25 | $37,50 | ❌ FECHADO |
| gpt-5.4-mini | 54,4% | $0,75 | $4,50 | ❌ FECHADO |
| gpt-5.3-codex | 56,8% | $1,75 | $14,00 | ❌ FECHADO |
| gpt-5.3-codex-spark | ~56% | sem API pública | sem API pública | ❌ ChatGPT Pro only |
| gpt-5.2 | 55,6% | $1,75 | $14,00 | ❌ Descontinuação em 5/jun/2026 |

---

## Parte 3 — Matriz por camada do sistema

Esta parte espelha o roteador de `Evolucao.md` e `Fixbugs.md`. Quando o `IMPLEMENTATION.md` envolver predominantemente uma camada, consulte esta matriz primeiro.

### 3.1 FRONTEND

**Principal:** `qwen3.6-plus`
**Fallback técnico:** `kimi-k2.6`
**Fallback de budget:** `minimax-m2.5`

**Justificativa:** Qwen3.6-plus é SOTA em "vibe coding" (3D scenes, SVG, animações, layout visual), com 1M context para projetos grandes e feature `preserve_thinking` para manter consistência entre componentes. Kimi K2.6 é multimodal nativo (interpreta mockups). MiniMax M2.5 é o mais barato com qualidade decente em frontend.

### 3.2 BACKEND

**Principal:** `glm-5.1`
**Fallback técnico:** `kimi-k2.6`
**Fallback de budget:** `deepseek-v4-pro`

**Justificativa:** GLM-5.1 lidera SWE-Bench Pro (58,4%) — benchmark que captura tarefas backend reais (API, regras de negócio, integrações). Kimi K2.6 empata em SWE-Bench Pro e tem Agent Swarm para tarefas paralelas. DeepSeek V4 Pro é o melhor custo-benefício em backend algorítmico.

### 3.3 DATABASE

**Principal:** `deepseek-v4-pro`
**Fallback técnico:** `glm-5.1`
**Fallback de budget:** `minimax-m2.5`

**Justificativa:** DeepSeek V4 Pro é líder em raciocínio lógico estruturado (Codeforces 3206) — competência diretamente aplicável a query design, indexação e otimização SQL. GLM-5.1 demonstrou speedup 6,9× em vector DB optimization em demos oficiais. MiniMax M2.5 cobre CRUD e migrations simples com custo mínimo.

### 3.4 DESIGN SYSTEM

**Principal:** `qwen3.6-plus`
**Fallback técnico:** `mimo-v2.5` (omnimodal)
**Fallback de budget:** `kimi-k2.6`

**Justificativa:** Qwen3.6 lidera benchmarks visuais e gera tokens de design consistentes. MiMo V2.5 é omnimodal nativo — ideal quando há mockups, imagens de referência ou specs visuais para interpretar. Kimi K2.6 tem suporte nativo a image/video e bom raciocínio sobre componentes reutilizáveis.

### 3.5 INFRA

**Principal:** `glm-5.1`
**Fallback técnico:** `mimo-v2.5-pro`
**Fallback de budget:** `deepseek-v4-pro`

**Justificativa:** GLM-5.1 demonstrou execução autônoma sustentada de 8h em build de Linux desktop (655 iterações) — perfil ideal para IaC, Kubernetes manifests, scripts de deploy. MiMo V2.5 Pro tem harness awareness (gerencia próprio scaffold) — útil para CI/CD complexo. DeepSeek V4 Pro entrega Terraform/Ansible com qualidade competitiva pelo menor preço.

---

## Parte 4 — Matriz por domínio funcional

Esta é a parte **mais granular e mais importante** do documento. Faça matching das palavras-chave da SPEC com os domínios abaixo. Quando múltiplos domínios aparecem, combine recomendações (use tie-breakers da Parte 9).

### 4.1 FRONTEND — domínios específicos

#### 4.1.1 Componentes UI / Design System

**Keywords trigger:** componente, button, modal, dropdown, card, form, design system, tokens, shadcn, headless UI, primitives

**Principal:** `qwen3.6-plus`
**Fallback técnico:** `kimi-k2.6`
**Fallback de budget:** `minimax-m2.5`

**Justificativa:** Qwen3.6 lidera geração de componentes React/Vue com aderência a design tokens. Componentes complexos com estados (loading, error, empty) bem cobertos.

#### 4.1.2 Animações e interações

**Keywords trigger:** animação, animation, transition, framer-motion, gsap, lottie, easing, keyframes, micro-interaction

**Principal:** `qwen3.6-plus`
**Fallback técnico:** `kimi-k2.6`
**Fallback de budget:** `mimo-v2.5-pro`

**Justificativa:** Qwen3.6 é SOTA em "vibe coding" com animações fluidas e easing apropriado. Kimi K2.6 tem boa compreensão de timing functions.

#### 4.1.3 Visualização de dados / Gráficos

**Keywords trigger:** chart, gráfico, dashboard, d3, recharts, chart.js, plotly, visualization, data viz

**Principal:** `qwen3.6-plus`
**Fallback técnico:** `deepseek-v4-pro`
**Fallback de budget:** `kimi-k2.6`

**Justificativa:** Qwen3.6 gera código D3/Recharts idiomático. DeepSeek V4 Pro entrega quando os cálculos estatísticos por trás do gráfico são complexos.

#### 4.1.4 SVG / Canvas / WebGL / 3D

**Keywords trigger:** svg, canvas, webgl, three.js, r3f, react-three-fiber, babylon, 3d, shader, glsl

**Principal:** `qwen3.6-plus`
**Fallback técnico:** `kimi-k2.6`
**Fallback de budget:** `mimo-v2.5-pro`

**Justificativa:** Qwen3.6 demonstrou SOTA em 3D scenes e SVG. Kimi K2.6 tem bom domínio de Three.js. MiMo V2.5 Pro é forte em código gráfico de baixo nível.

#### 4.1.5 State management

**Keywords trigger:** redux, zustand, pinia, jotai, recoil, mobx, signals, state machine, xstate, store, atomic state

**Principal:** `glm-5.1`
**Fallback técnico:** `kimi-k2.6`
**Fallback de budget:** `minimax-m2.5`

**Justificativa:** State management é problema de modelagem lógica, não visual — GLM-5.1 lidera raciocínio sobre fluxos de dados. Kimi K2.6 cobre xstate/state machines bem.

#### 4.1.6 Acessibilidade (WCAG/ARIA)

**Keywords trigger:** acessibilidade, accessibility, a11y, aria, wcag, screen reader, keyboard navigation, focus management

**Principal:** `kimi-k2.6`
**Fallback técnico:** `glm-5.1`
**Fallback de budget:** `qwen3.6-plus`

**Justificativa:** Kimi K2.6 mostrou aderência consistente a WCAG 2.1 em benchmarks de geração de componentes. GLM-5.1 tem boa fundamentação em padrões web. Qwen3.6 cobre HTML semântico bem mas pode ser inconsistente em ARIA mais complexo.

#### 4.1.7 Performance frontend / Core Web Vitals

**Keywords trigger:** performance, core web vitals, lcp, cls, fid, lighthouse, bundle size, lazy loading, code splitting, tree shaking

**Principal:** `glm-5.1`
**Fallback técnico:** `mimo-v2.5-pro`
**Fallback de budget:** `kimi-k2.6`

**Justificativa:** Otimização de performance exige raciocínio sobre trade-offs — GLM-5.1 lidera. MiMo V2.5 Pro demonstrou tuning de performance em demos reais (CUDA kernels 2,6→35,7×). Kimi K2.6 tem boa compreensão de bundlers.

#### 4.1.8 SSR / SSG / ISR / RSC

**Keywords trigger:** next.js, nuxt, remix, astro, sveltekit, ssr, ssg, isr, server components, rsc, hydration, streaming

**Principal:** `glm-5.1`
**Fallback técnico:** `kimi-k2.6`
**Fallback de budget:** `qwen3.6-plus`

**Justificativa:** Server-side rendering envolve raciocínio sobre boundary entre cliente/servidor — GLM-5.1 e Kimi K2.6 lideram nesse tipo de tarefa arquitetural.

#### 4.1.9 Forms complexos

**Keywords trigger:** form, formulário, validação, validation, react-hook-form, formik, zod, yup, multi-step, dynamic form, wizard

**Principal:** `glm-5.1`
**Fallback técnico:** `qwen3.6-plus`
**Fallback de budget:** `minimax-m2.5`

**Justificativa:** Forms complexos misturam UI (Qwen) com lógica de validação e estado (GLM). GLM-5.1 ganha pela superioridade em modelagem de regras de negócio embutidas em validações.

#### 4.1.10 Vibe coding / Prototipagem visual rápida

**Keywords trigger:** mockup, prototype, protótipo, mvp, landing page, hero section, "página de", design rápido, vibe coding

**Principal:** `qwen3.6-plus`
**Fallback técnico:** `kimi-k2.6`
**Fallback de budget:** `minimax-m2.5`

**Justificativa:** Qwen3.6 é o modelo com melhores resultados documentados em geração visual "ao primeiro shot" — landings, heros, seções de marketing.

### 4.2 BACKEND — domínios específicos

#### 4.2.1 Autenticação (login/senha, sessões básicas)

**Keywords trigger:** login, senha, password, signup, signin, autenticação, authentication, bcrypt, argon2, scrypt, session, cookie, csrf

**Principal:** `glm-5.1`
**Fallback técnico:** `kimi-k2.6`
**Fallback de budget:** `deepseek-v4-pro`

**Justificativa:** GLM-5.1 lidera CyberGym (68,7) — benchmark especializado em segurança ofensiva e defensiva. Em autenticação, isso se traduz em: uso correto de bcrypt/argon2 com salt apropriado, hashing com cost factor adequado, prevenção de timing attacks, gestão correta de sessions e cookies HttpOnly/Secure/SameSite. Kimi K2.6 tem boa cobertura de padrões OWASP ASVS. DeepSeek V4 Pro implementa corretamente os algoritmos criptográficos pelo menor custo.

**⚠️ ATENÇÃO de segurança:** sempre validar implementação contra OWASP ASVS Level 2 e checklist do `Evolucao.md`. Modelos de IA são propensos a omitir: rate limiting em endpoints de login, lockout após N tentativas, logs de tentativas falhadas, expiração de sessão, rotação de session ID após login.

#### 4.2.2 Autenticação avançada (OAuth 2.1, OIDC, JWT, MFA, WebAuthn/Passkeys, Magic Links, SSO)

**Keywords trigger:** oauth, oidc, openid, jwt, refresh token, access token, mfa, totp, webauthn, passkey, magic link, sso, saml, social login

**Principal:** `glm-5.1`
**Fallback técnico:** `kimi-k2.6`
**Fallback de budget:** `mimo-v2.5-pro`

**Justificativa:** Padrões de identidade (OAuth 2.1, OIDC com PKCE) exigem aderência rigorosa a RFCs — GLM-5.1 demonstra melhor seguimento de especificações longas. Kimi K2.6 tem boas implementações documentadas de fluxos JWT com refresh rotation. MiMo V2.5 Pro é forte em criptografia low-level (WebAuthn assertion verification).

**⚠️ ATENÇÃO de segurança:** verificar uso correto de PKCE em OAuth, validação de `aud`/`iss`/`exp` em JWT, rotação de refresh tokens, armazenamento seguro (não em localStorage), state parameter para CSRF em OAuth.

#### 4.2.3 Autorização (RBAC, ABAC, ReBAC, Row-Level Security, Policies)

**Keywords trigger:** autorização, authorization, rbac, abac, rebac, role, permission, policy, casbin, opa, cedar, row-level security, rls, supabase rls, postgres rls

**Principal:** `glm-5.1`
**Fallback técnico:** `deepseek-v4-pro`
**Fallback de budget:** `kimi-k2.6`

**Justificativa:** Autorização é problema de modelagem formal — GLM-5.1 lidera por força em raciocínio lógico estruturado e geração de policies (Cedar, OPA Rego). DeepSeek V4 Pro é excepcional em RLS policies do Postgres pela capacidade matemática (Codeforces 3206). Kimi K2.6 cobre RBAC simples bem.

**⚠️ ATENÇÃO de segurança:** verificar enforcement no backend (não confiar em UI), princípio do menor privilégio, auditoria de mudanças de role, separação de admin/user em rotas distintas.

#### 4.2.4 APIs REST (design, versionamento, paginação, rate limiting)

**Keywords trigger:** rest, api, endpoint, route, rota, openapi, swagger, versioning, pagination, cursor, offset, rate limit, throttling

**Principal:** `glm-5.1`
**Fallback técnico:** `kimi-k2.6`
**Fallback de budget:** `deepseek-v4-pro`

**Justificativa:** GLM-5.1 demonstra forte aderência a OpenAPI specs e princípios REST (HATEOAS quando aplicável, idempotência de PUT/DELETE, status codes corretos). Kimi K2.6 tem excelente cobertura de paginação cursor-based.

#### 4.2.5 APIs GraphQL

**Keywords trigger:** graphql, schema, resolver, dataloader, apollo, urql, federation, subscription, query, mutation

**Principal:** `glm-5.1`
**Fallback técnico:** `kimi-k2.6`
**Fallback de budget:** `qwen3.6-plus`

**Justificativa:** GraphQL exige design de schema cuidadoso (evitar N+1, pensar em DataLoader). GLM-5.1 lidera. Qwen3.6 é surpreendentemente bom em resolvers Apollo.

#### 4.2.6 gRPC e APIs binárias

**Keywords trigger:** grpc, protobuf, protocol buffers, .proto, streaming bidirecional, msgpack

**Principal:** `deepseek-v4-pro`
**Fallback técnico:** `glm-5.1`
**Fallback de budget:** `mimo-v2.5-pro`

**Justificativa:** gRPC é nicho com forte presença em ecossistemas Go/C++ — DeepSeek V4 Pro tem melhor cobertura por seu foco em systems programming.

#### 4.2.7 WebSockets / Server-Sent Events / Real-time

**Keywords trigger:** websocket, ws, socket.io, sse, server-sent events, real-time, tempo real, pub/sub, broadcast, room, channel

**Principal:** `kimi-k2.6`
**Fallback técnico:** `glm-5.1`
**Fallback de budget:** `deepseek-v4-pro`

**Justificativa:** Real-time exige raciocínio sobre estado distribuído e race conditions — Kimi K2.6 tem demos documentadas (financial matching engine, +185% throughput). GLM-5.1 cobre Socket.IO/WebSocket nativo bem.

#### 4.2.8 Webhooks e integrações third-party

**Keywords trigger:** webhook, callback, third-party, integração, stripe webhook, github webhook, signature verification, retry, idempotência

**Principal:** `glm-5.1`
**Fallback técnico:** `kimi-k2.6`
**Fallback de budget:** `minimax-m2.5`

**Justificativa:** Webhooks exigem aderência a APIs de terceiros e patterns de resiliência (idempotência via chave única, retry com backoff exponencial, verificação de assinatura HMAC). GLM-5.1 lidera por seguir RFCs e docs de terceiros com precisão.

#### 4.2.9 Background jobs / Workers / Schedulers

**Keywords trigger:** worker, background job, cron, scheduler, bull, bullmq, sidekiq, celery, agenda, queue, retry, dlq

**Principal:** `glm-5.1`
**Fallback técnico:** `kimi-k2.6`
**Fallback de budget:** `deepseek-v4-pro`

**Justificativa:** Workers exigem raciocínio sobre garantias de execução (at-least-once vs exactly-once), idempotência e dead letter queues — GLM-5.1 e Kimi K2.6 lideram.

#### 4.2.10 Message Queues / Event-Driven Architecture

**Keywords trigger:** kafka, rabbitmq, sqs, sns, eventbridge, pubsub, event sourcing, cqrs, saga, outbox pattern, event-driven

**Principal:** `glm-5.1`
**Fallback técnico:** `kimi-k2.6`
**Fallback de budget:** `deepseek-v4-pro`

**Justificativa:** Arquiteturas event-driven exigem domínio de padrões avançados (Saga, Outbox, Event Sourcing) — GLM-5.1 e Kimi K2.6 são os mais fortes em padrões arquiteturais.

#### 4.2.11 Caching strategies

**Keywords trigger:** cache, caching, redis, memcached, cdn, http cache, cache-control, etag, swr, stale-while-revalidate, cache invalidation

**Principal:** `glm-5.1`
**Fallback técnico:** `deepseek-v4-pro`
**Fallback de budget:** `kimi-k2.6`

**Justificativa:** Caching exige raciocínio sobre invalidação (o problema mais difícil da computação, segundo Phil Karlton). GLM-5.1 cobre estratégias avançadas (cache-aside, write-through, write-behind) com precisão.

#### 4.2.12 File storage e processamento (uploads, S3, image processing)

**Keywords trigger:** upload, s3, minio, gcs, blob storage, multipart, presigned url, image processing, sharp, imagemagick, ffmpeg, thumbnail

**Principal:** `kimi-k2.6`
**Fallback técnico:** `glm-5.1`
**Fallback de budget:** `mimo-v2.5` (omnimodal — quando processamento visual está envolvido)

**Justificativa:** Upload pipelines envolvem segurança (validação de tipo MIME real, não extensão), performance (streaming, multipart) e raciocínio sobre formatos — Kimi K2.6 lidera com presença forte de demos documentadas. MiMo V2.5 é a escolha quando o processamento envolve análise de conteúdo visual.

**⚠️ ATENÇÃO de segurança:** sempre validar magic bytes (não apenas extensão), limitar tamanho no servidor, isolar uploads por usuário, scan de malware quando aplicável.

#### 4.2.13 Rate limiting / Throttling / DDoS protection

**Keywords trigger:** rate limit, throttle, throttling, token bucket, leaky bucket, sliding window, ddos, abuse prevention

**Principal:** `glm-5.1`
**Fallback técnico:** `deepseek-v4-pro`
**Fallback de budget:** `kimi-k2.6`

**Justificativa:** Algoritmos de rate limiting são problema matemático estruturado — GLM-5.1 e DeepSeek V4 Pro lideram.

#### 4.2.14 Security hardening (CSRF, CORS, headers, sanitization, OWASP Top 10)

**Keywords trigger:** csrf, cors, csp, security headers, helmet, xss, sql injection, sanitization, owasp, hsts, x-frame-options

**Principal:** `glm-5.1`
**Fallback técnico:** `kimi-k2.6`
**Fallback de budget:** `mimo-v2.5-pro`

**Justificativa:** GLM-5.1 lidera CyberGym (68,7) — benchmark especializado em segurança ofensiva e defensiva. Implementa corretamente Content Security Policy, CORS restritivo e sanitização de input.

#### 4.2.15 Pagamentos e integrações financeiras

**Keywords trigger:** stripe, pagseguro, mercado pago, paypal, pagar.me, payment, checkout, subscription, recurring billing, pix, boleto, webhook stripe

**Principal:** `glm-5.1`
**Fallback técnico:** `kimi-k2.6`
**Fallback de budget:** `deepseek-v4-pro`

**Justificativa:** Pagamentos exigem precisão absoluta (idempotência de webhooks, verificação de assinatura, tratamento de moeda em centavos para evitar float, compliance PCI-DSS) — GLM-5.1 lidera por aderência a docs oficiais (Stripe API).

**⚠️ ATENÇÃO de segurança:** nunca armazenar PAN/CVV, usar tokens, validar assinatura de webhook ANTES de processar, idempotency keys em mutations.

### 4.3 DATABASE — domínios específicos

#### 4.3.1 Schema design relacional

**Keywords trigger:** schema, modelo de dados, tabela, table, relação, foreign key, normalização, 3nf, erd, modelo entidade-relacionamento

**Principal:** `glm-5.1`
**Fallback técnico:** `deepseek-v4-pro`
**Fallback de budget:** `kimi-k2.6`

**Justificativa:** Modelagem de schema exige raciocínio lógico estruturado e conhecimento de normalização — GLM-5.1 e DeepSeek V4 Pro lideram.

#### 4.3.2 Queries SQL complexas

**Keywords trigger:** sql, query, join, cte, window function, subquery, aggregate, group by, partition, recursive cte

**Principal:** `deepseek-v4-pro`
**Fallback técnico:** `glm-5.1`
**Fallback de budget:** `minimax-m2.5`

**Justificativa:** Queries complexas (window functions, CTEs recursivas, query plans) são problema algorítmico — DeepSeek V4 Pro lidera (Codeforces 3206, LiveCodeBench 93,5%).

#### 4.3.3 Migrations

**Keywords trigger:** migration, migrate, schema change, ddl, alter table, prisma migrate, flyway, liquibase, alembic, knex migration

**Principal:** `glm-5.1`
**Fallback técnico:** `kimi-k2.6`
**Fallback de budget:** `deepseek-v4-pro`

**Justificativa:** Migrations exigem cuidado com dados existentes (zero-downtime, backwards compatibility) — GLM-5.1 lidera por raciocínio sobre side effects.

**⚠️ ATENÇÃO:** o checklist de Evolucao.md já alerta sobre CONFLITO DE DADOS — sempre exigir migration strategy preservando dados.

#### 4.3.4 Índices e performance

**Keywords trigger:** index, índice, btree, gin, gist, hash index, query plan, explain, analyze, slow query, n+1

**Principal:** `deepseek-v4-pro`
**Fallback técnico:** `glm-5.1`
**Fallback de budget:** `kimi-k2.6`

**Justificativa:** Otimização de queries é problema matemático — DeepSeek V4 Pro lidera. GLM-5.1 demonstrou 6,9× speedup em vector DB optimization.

#### 4.3.5 Row-Level Security (RLS) / Policies de banco

**Keywords trigger:** rls, row-level security, policy, supabase rls, postgres policy, security definer, security invoker

**Principal:** `glm-5.1`
**Fallback técnico:** `deepseek-v4-pro`
**Fallback de budget:** `kimi-k2.6`

**Justificativa:** RLS é a interseção de autorização + SQL — GLM-5.1 lidera por dominar ambos. Demos do GLM mostram aderência forte a padrões Supabase/Postgres.

#### 4.3.6 NoSQL (MongoDB, Redis, DynamoDB, Cassandra)

**Keywords trigger:** mongodb, mongo, redis, dynamodb, cassandra, scylla, single-table design, partition key, sort key, ttl, nosql

**Principal:** `glm-5.1`
**Fallback técnico:** `kimi-k2.6`
**Fallback de budget:** `deepseek-v4-pro`

**Justificativa:** NoSQL exige raciocínio sobre access patterns (especialmente DynamoDB single-table design) — GLM-5.1 lidera. Kimi K2.6 tem boa cobertura de Redis avançado.

#### 4.3.7 ORMs e Query Builders (Prisma, TypeORM, Drizzle, SQLAlchemy)

**Keywords trigger:** prisma, typeorm, drizzle, sequelize, sqlalchemy, knex, kysely, eloquent, orm, query builder

**Principal:** `kimi-k2.6`
**Fallback técnico:** `glm-5.1`
**Fallback de budget:** `qwen3.6-plus`

**Justificativa:** ORMs evoluem rapidamente e exigem conhecimento atualizado de APIs — Kimi K2.6 tem knowledge cutoff mais recente para Prisma 5+/Drizzle. GLM-5.1 cobre SQLAlchemy 2.0 bem.

### 4.4 INFRA — domínios específicos

#### 4.4.1 Containers (Docker, Dockerfile, docker-compose)

**Keywords trigger:** docker, dockerfile, container, compose, multi-stage build, image, layer

**Principal:** `glm-5.1`
**Fallback técnico:** `kimi-k2.6`
**Fallback de budget:** `minimax-m2.5`

**Justificativa:** Dockerfiles otimizados exigem conhecimento de layer caching, multi-stage builds e segurança (non-root user, minimal base images) — GLM-5.1 lidera.

#### 4.4.2 Orquestração (Kubernetes, Helm)

**Keywords trigger:** kubernetes, k8s, kubectl, helm, helm chart, manifest, deployment, service, ingress, configmap, secret

**Principal:** `glm-5.1`
**Fallback técnico:** `mimo-v2.5-pro`
**Fallback de budget:** `kimi-k2.6`

**Justificativa:** K8s manifests exigem aderência rigorosa a APIs do Kubernetes — GLM-5.1 lidera. MiMo V2.5 Pro demonstrou autonomia em deploys complexos.

#### 4.4.3 IaC (Terraform, Pulumi, CloudFormation, CDK)

**Keywords trigger:** terraform, pulumi, cloudformation, cdk, infrastructure as code, iac, hcl, state, module

**Principal:** `glm-5.1`
**Fallback técnico:** `mimo-v2.5-pro`
**Fallback de budget:** `deepseek-v4-pro`

**Justificativa:** Terraform/Pulumi exigem aderência a provider docs (AWS, GCP, Azure) — GLM-5.1 lidera. DeepSeek V4 Pro é forte em HCL pelo menor preço.

#### 4.4.4 CI/CD (GitHub Actions, GitLab CI, scripts de deploy)

**Keywords trigger:** ci, cd, github actions, gitlab ci, jenkins, circleci, pipeline, workflow, deploy script

**Principal:** `glm-5.1`
**Fallback técnico:** `kimi-k2.6`
**Fallback de budget:** `minimax-m2.5`

**Justificativa:** Pipelines exigem aderência a sintaxes específicas (YAML do Actions vs GitLab) — GLM-5.1 lidera. Kimi K2.6 tem boa cobertura de actions reusáveis.

#### 4.4.5 Cloud-specific (AWS, GCP, Azure, Vercel, Cloudflare)

**Keywords trigger:** aws, gcp, azure, vercel, cloudflare, lambda, cloud run, app service, edge function, durable object, worker

**Principal:** `glm-5.1`
**Fallback técnico:** `kimi-k2.6`
**Fallback de budget:** `mimo-v2.5-pro`

**Justificativa:** Cloud-specific exige knowledge cutoff recente — todos os três cobrem bem. GLM-5.1 lidera em AWS; Kimi K2.6 forte em Cloudflare Workers; MiMo V2.5 Pro forte em GCP.

#### 4.4.6 Observabilidade (logs, metrics, tracing, OpenTelemetry)

**Keywords trigger:** observability, observabilidade, logs, metrics, tracing, opentelemetry, otel, prometheus, grafana, datadog, sentry, jaeger

**Principal:** `glm-5.1`
**Fallback técnico:** `kimi-k2.6`
**Fallback de budget:** `mimo-v2.5-pro`

**Justificativa:** Observabilidade exige conhecimento de padrões OTel (semantic conventions) — GLM-5.1 lidera.

### 4.5 TRANSVERSAIS — domínios que cruzam camadas

#### 4.5.1 Mobile nativo (iOS Swift, Android Kotlin)

**Keywords trigger:** swift, swiftui, uikit, kotlin, jetpack compose, android, ios, mobile nativo, native mobile

**Principal:** `kimi-k2.6`
**Fallback técnico:** `glm-5.1`
**Fallback de budget:** `qwen3.6-plus`

**Justificativa:** Mobile nativo é menos representado em training data — Kimi K2.6 tem knowledge cutoff mais recente e demos documentadas. Qwen3.6 surpreende em SwiftUI/Compose pela força em UI.

#### 4.5.2 Mobile cross-platform (React Native, Flutter)

**Keywords trigger:** react native, expo, flutter, dart, cross-platform mobile

**Principal:** `qwen3.6-plus`
**Fallback técnico:** `kimi-k2.6`
**Fallback de budget:** `minimax-m2.5`

**Justificativa:** RN e Flutter são UI-heavy — Qwen3.6 lidera por força em UI generation. Kimi K2.6 cobre RN navigation/state management bem.

#### 4.5.3 Embedded / Sistemas (C, C++, Rust, Zig)

**Keywords trigger:** embedded, firmware, rust, zig, c++, microcontroller, rtos, esp32, arduino, mcu, kernel

**Principal:** `mimo-v2.5-pro`
**Fallback técnico:** `kimi-k2.6`
**Fallback de budget:** `deepseek-v4-pro`

**Justificativa:** MiMo V2.5 Pro tem demos reais de Rust compiler (4,3h autônomas, 233/233 testes). Kimi K2.6 demonstrou Zig inference engine 20% mais rápido que LM Studio. DeepSeek V4 Pro forte em C/C++ low-level.

#### 4.5.4 Blockchain / Smart Contracts

**Keywords trigger:** blockchain, smart contract, solidity, evm, ethereum, vyper, anchor, solana, rust solana, web3, defi

**Principal:** `deepseek-v4-pro`
**Fallback técnico:** `glm-5.1`
**Fallback de budget:** `kimi-k2.6`

**Justificativa:** Smart contracts exigem precisão matemática (overflow, reentrancy, gas optimization) — DeepSeek V4 Pro lidera. GLM-5.1 cobre Solidity 0.8+ e padrões OpenZeppelin bem.

**⚠️ ATENÇÃO:** smart contracts são imutáveis após deploy — sempre exigir auditoria humana adicional.

#### 4.5.5 ML/AI Integration (chamadas a LLMs, embeddings, RAG, vector DBs)

**Keywords trigger:** llm, openai api, anthropic api, embedding, rag, retrieval augmented, vector database, pinecone, weaviate, qdrant, chromadb, langchain, llamaindex

**Principal:** `kimi-k2.6`
**Fallback técnico:** `glm-5.1`
**Fallback de budget:** `mimo-v2.5-pro`

**Justificativa:** Knowledge cutoff recente é crítico aqui (APIs de LLMs mudam rapidamente) — Kimi K2.6 e GLM-5.1 são os mais atualizados.

#### 4.5.6 Data Engineering / ETL

**Keywords trigger:** etl, elt, data pipeline, airflow, dagster, prefect, dbt, spark, snowflake, bigquery, redshift, data warehouse

**Principal:** `deepseek-v4-pro`
**Fallback técnico:** `glm-5.1`
**Fallback de budget:** `kimi-k2.6`

**Justificativa:** Data pipelines exigem raciocínio sobre transformações em larga escala — DeepSeek V4 Pro lidera. GLM-5.1 forte em dbt e Airflow DAGs.

#### 4.5.7 Compliance (LGPD, GDPR, HIPAA, PCI-DSS, SOC2)

**Keywords trigger:** lgpd, gdpr, hipaa, pci-dss, pci, soc2, sox, compliance, audit log, data retention, right to be forgotten, consent

**Principal:** `glm-5.1`
**Fallback técnico:** `kimi-k2.6`
**Fallback de budget:** `mimo-v2.5-pro`

**Justificativa:** Compliance exige aderência a regulamentações específicas — GLM-5.1 lidera. O checklist de Evolucao.md já cobre LGPD; este modelo é o que melhor implementa.

---

## Parte 5 — Benchmarks especializados (referência)

Quando a SPEC mencionar um domínio específico, priorize o modelo líder no benchmark correspondente.

| Benchmark | Domínio | Líder open | Score |
|---|---|---|---|
| **SWE-Bench Pro** | Engenharia de software fim-a-fim | kimi-k2.6 | 58,6% |
| **SWE-Bench Pro** | (empate técnico) | glm-5.1 | 58,4% |
| **LiveCodeBench v6** | Algoritmos / competitive programming | deepseek-v4-pro | 93,5% |
| **LiveCodeBench v6** | (segundo lugar) | kimi-k2.6 | 89,6% |
| **Terminal-Bench 2.0** | Operações terminal multi-step | mimo-v2.5-pro | 68,4% |
| **Terminal-Bench 2.0** | (segundo lugar) | deepseek-v4-pro | 67,9% |
| **Codeforces** | Algoritmos competitivos | deepseek-v4-pro | 3206 Elo |
| **CyberGym** | Segurança ofensiva/defensiva | glm-5.1 | 68,7 |
| **MCP-Atlas** | Tool calling MCP | glm-5.1 | 71,8 |
| **KernelBench L3** | Otimização CUDA/kernel | glm-5.1 | 3,6× speedup |
| **Aider Polyglot** | Edição multi-linguagem | kimi-k2.6 | top open |
| **SWE-Bench Multilingual** | Multilíngue (Python, JS, Go, Rust, etc.) | minimax-m2.5 | 51,3% (líder open na época) |
| **WebDev Arena (Elo)** | Frontend visual | qwen3.6-plus | top open |
| **Video-MME** | Multimodal vídeo | mimo-v2.5 | 87,7 |
| **ClawEval** | Agentic computer use | mimo-v2.5-pro | 64% |

---

## Parte 6 — Matriz por linguagem / stack

### TypeScript / JavaScript (Node.js)

**Frameworks cobertos:** Express, NestJS, Fastify, Hono, Koa, Next.js (backend), Remix, SvelteKit

**Principal:** `glm-5.1`
**Fallback:** `kimi-k2.6`
**Budget:** `minimax-m2.5`

### Python

**Frameworks cobertos:** Django, FastAPI, Flask, Litestar, Starlette, SQLAlchemy, Pydantic, Celery

**Principal:** `glm-5.1`
**Fallback:** `deepseek-v4-pro`
**Budget:** `kimi-k2.6`

**Nota:** Python é a linguagem mais bem representada em todos os training data — diferença entre modelos é menor aqui.

### Java / Kotlin (JVM)

**Frameworks cobertos:** Spring Boot, Spring Security, Quarkus, Micronaut, Ktor

**Principal:** `kimi-k2.6`
**Fallback:** `glm-5.1`
**Budget:** `deepseek-v4-pro`

**Nota:** Kimi K2.6 demonstrou rewrite autônomo de 13h do exchange-core (financial matching engine Java). Spring Security é covered bem por GLM-5.1.

### Go

**Frameworks cobertos:** stdlib net/http, Gin, Echo, Fiber, Chi, gqlgen

**Principal:** `deepseek-v4-pro`
**Fallback:** `glm-5.1`
**Budget:** `kimi-k2.6`

**Nota:** Go é forte em systems — DeepSeek V4 Pro lidera.

### Rust

**Frameworks cobertos:** Axum, Actix, Rocket, Tokio, Tonic (gRPC), SeaORM, sqlx

**Principal:** `mimo-v2.5-pro`
**Fallback:** `deepseek-v4-pro`
**Budget:** `kimi-k2.6`

**Nota:** MiMo V2.5 Pro tem demo documentada de Rust compiler 4,3h autônomas.

### C# / .NET

**Frameworks cobertos:** ASP.NET Core, EF Core, MediatR, MassTransit

**Principal:** `glm-5.1`
**Fallback:** `kimi-k2.6`
**Budget:** `deepseek-v4-pro`

### Ruby

**Frameworks cobertos:** Rails, Sinatra, Hanami, Sidekiq

**Principal:** `kimi-k2.6`
**Fallback:** `glm-5.1`
**Budget:** `minimax-m2.5`

### PHP

**Frameworks cobertos:** Laravel, Symfony, Slim

**Principal:** `glm-5.1`
**Fallback:** `kimi-k2.6`
**Budget:** `minimax-m2.5`

### Swift (iOS) / Kotlin (Android)

Ver Parte 4.5.1 (Mobile nativo).

### Dart (Flutter)

Ver Parte 4.5.2 (Mobile cross-platform).

---

## Parte 7 — Matriz para Fixbugs (correção de bugs)

Esta parte é usada apenas quando o prompt invocado for `Fixbugs.md` e o documento gerado for `IMPLEMENTATION_FIXBUG.md`.

### 7.1 Bug visual / UI (componentes, layout, estilização)

**Principal:** `qwen3.6-plus`
**Fallback técnico:** `kimi-k2.6`
**Fallback de budget:** `minimax-m2.5`

**Justificativa:** Bugs visuais exigem entendimento do estado renderizado vs esperado — Qwen3.6 lidera. Kimi K2.6 é multimodal nativo (interpreta prints anexados ao bug).

### 7.2 Bug de comportamento de API / endpoint

**Principal:** `glm-5.1`
**Fallback técnico:** `kimi-k2.6`
**Fallback de budget:** `deepseek-v4-pro`

**Justificativa:** Bugs de API exigem raciocínio sobre contratos, side effects e estado — GLM-5.1 lidera SWE-Bench Pro que captura exatamente esse tipo de bug.

### 7.3 Bug de regra de negócio

**Principal:** `glm-5.1`
**Fallback técnico:** `kimi-k2.6`
**Fallback de budget:** `deepseek-v4-pro`

**Justificativa:** Regras de negócio exigem compreensão semântica do domínio — GLM-5.1 lidera.

### 7.4 Bug de query / banco de dados

**Principal:** `deepseek-v4-pro`
**Fallback técnico:** `glm-5.1`
**Fallback de budget:** `kimi-k2.6`

**Justificativa:** Bugs de query (resultado incorreto, performance) são problema algorítmico — DeepSeek V4 Pro lidera.

### 7.5 Bug de race condition / intermitente

**Principal:** `kimi-k2.6`
**Fallback técnico:** `glm-5.1`
**Fallback de budget:** `deepseek-v4-pro`

**Justificativa:** Race conditions exigem raciocínio sobre estado concorrente — Kimi K2.6 tem demos documentadas de sistemas concorrentes complexos. GLM-5.1 forte em análise estática.

### 7.6 Bug de segurança (CWE)

**Principal:** `glm-5.1`
**Fallback técnico:** `kimi-k2.6`
**Fallback de budget:** `mimo-v2.5-pro`

**Justificativa:** GLM-5.1 lidera CyberGym (68,7) — benchmark especializado em identificação e correção de vulnerabilidades CWE.

**⚠️ Nota crítica:** o protocolo de Fixbugs.md para BUG DE SEGURANÇA exige prioridade máxima — comunique ao usuário antes de prosseguir.

### 7.7 Bug em produção urgente

**Principal:** `glm-5.1`
**Fallback técnico:** `kimi-k2.6`
**Fallback de budget:** `deepseek-v4-pro`

**Justificativa:** Bug urgente prioriza correção precisa + rápida — GLM-5.1 oferece o melhor balanço. DeepSeek V4 Pro é alternativa quando custo é fator.

### 7.8 Bug não-reproduzível (diagnóstico exploratório)

**Principal:** `glm-5.1`
**Fallback técnico:** `kimi-k2.6`
**Fallback de budget:** `mimo-v2.5-pro`

**Justificativa:** Bugs não-reproduzíveis exigem raciocínio investigativo — GLM-5.1 lidera por execução autônoma sustentada (8h em demos). Kimi K2.6 tem Agent Swarm para explorar hipóteses em paralelo.

### 7.9 Bug de design system / tokens

**Principal:** `qwen3.6-plus`
**Fallback técnico:** `kimi-k2.6`
**Fallback de budget:** `minimax-m2.5`

**Justificativa:** Bugs em design system exigem entendimento de cascading de tokens — Qwen3.6 lidera.

### 7.10 Bug de infra (deploy, ambiente, config)

**Principal:** `glm-5.1`
**Fallback técnico:** `mimo-v2.5-pro`
**Fallback de budget:** `kimi-k2.6`

**Justificativa:** Bugs de infra exigem domínio de docker/k8s/cloud — GLM-5.1 lidera.

---

## Parte 8 — Anti-patterns (quando NÃO usar cada modelo)

### glm-5.1 — evitar quando:
- SPEC é trivial (CRUD básico) — custo é desnecessário; use `minimax-m2.5`
- SPEC envolve UI fortemente visual / 3D / animações complexas — use `qwen3.6-plus`
- SPEC é puramente algorítmica (competitive programming) — use `deepseek-v4-pro`

### kimi-k2.6 — evitar quando:
- Projeto exige license MIT pura — Kimi tem "Modified MIT" com restrições adicionais; prefira `glm-5.1` ou `mimo-v2.5-pro`
- SPEC envolve dados sensíveis e vendor está em watchlist do projeto (Anthropic acusou Moonshot em fev/2026 de uso fraudulento de contas Claude para training) — use `glm-5.1`
- Latência/custo são críticos com workloads reasoning-heavy — Kimi tem verbosidade alta (170M tokens AA Index vs mediana 47M)

### deepseek-v4-pro — evitar quando:
- SPEC envolve nuances de produto/UX/regras de negócio sutis — DeepSeek é mais algorítmico, menos contextual
- SPEC exige aderência rigorosa a APIs/SDKs muito recentes — knowledge cutoff pode ser limitante
- Projeto exige SLA de produção — status "Preview" do V4 Pro
- A janela promocional já expirou (>31/05/2026) — recalcular custo-benefício

### qwen3.6-plus — evitar quando:
- Projeto exige self-host / open-weights — Qwen3.6 Plus é **closed-weights** apesar da família Qwen ser tradicionalmente open
- SPEC é backend pesado / algorítmica — use `glm-5.1` ou `deepseek-v4-pro`
- Velocidade é crítica — Qwen3.6 tem ~52 t/s, abaixo da mediana

### minimax-m2.5 — evitar quando:
- SPEC é complexa com longo horizonte autônomo — use `glm-5.1` ou `kimi-k2.6`
- SPEC exige tool calling intensivo com >50 ferramentas — Terminal-Bench 2.0 baixo (42,2%)
- ⚠️ Confirmar com usuário que está usando `minimax-m2.5` (MIT) e NÃO `minimax-m2.7` (Non-Commercial)

### mimo-v2.5-pro — evitar quando:
- SPEC envolve domínio web puro (REST APIs, CRUD frontend) — over-spec; modelo é forte em systems
- Projeto não tem MCP / tool calling — feature distintiva (harness awareness) não agrega
- Deploy em cloud managed (AWS Bedrock, Azure AI) — modelo não disponível nessas plataformas

### mimo-v2.5 — evitar quando:
- SPEC não envolve multimodalidade (imagens, vídeo, áudio) — modelo equivalente sem o overhead seria melhor

---

## Parte 9 — Regras de decisão e tie-breakers

Quando múltiplas seções recomendarem modelos diferentes, aplique nesta ordem:

### Tie-breaker 1 — Domínio dominante prevalece
Se a SPEC tem 70%+ de uma camada (ex: 70%+ backend), use o ranking dessa camada. Os 30% restantes são executados sem regredir.

### Tie-breaker 2 — Especificidade do benchmark
Se um domínio funcional (Parte 4) tem benchmark dedicado (ex: CyberGym para segurança), o líder desse benchmark prevalece sobre o líder em SWE-Bench genérico.

### Tie-breaker 3 — Restrições de licença
Se o projeto exige license MIT pura (uso comercial sem ambiguidade):
- ✅ glm-5.1, deepseek-v4-pro, minimax-m2.5, mimo-v2.5-pro, mimo-v2.5
- ⚠️ kimi-k2.6 (Modified MIT — verificar cláusulas adicionais)
- ❌ qwen3.6-plus (closed-weights), minimax-m2.7 (Non-Commercial)

### Tie-breaker 4 — Self-host obrigatório
Se o projeto exige deploy on-premise / air-gapped:
- ✅ glm-5.1, mimo-v2.5-pro, kimi-k2.6, deepseek-v4-pro, minimax-m2.5
- ❌ qwen3.6-plus (apenas via API Alibaba)

### Tie-breaker 5 — Janela de contexto
Se a SPEC envolve codebase grande (>200K tokens):
- ✅ deepseek-v4-pro (1M), qwen3.6-plus (1M), mimo-v2.5-pro (1M), mimo-v2.5 (1M)
- ⚠️ kimi-k2.6 (262K), glm-5.1 (200K), minimax-m2.5 (205K) — pode exigir chunking

### Tie-breaker 6 — Custo crítico
Se budget é restrição absoluta (ordem do mais barato ao mais caro por tarefa típica):
1. minimax-m2.5 ($0,30/$1,20)
2. qwen3.6-plus ($0,325/$1,95)
3. mimo-v2.5 ($0,40/$2,00)
4. deepseek-v4-pro promo ($0,435/$0,87 até 31/05/2026)
5. kimi-k2.6 ($0,60/$2,50)
6. glm-5.1 ($0,95/$3,15)
7. mimo-v2.5-pro ($1,00/$3,00)

### Tie-breaker 7 — Aderência a checklist de segurança do Evolucao.md
Se a SPEC ativa qualquer item do checklist de segurança (autenticação, autorização, upload, LGPD, admin):
- Prefira `glm-5.1` (líder CyberGym 68,7) em qualquer caso de empate.

---

## Parte 10 — Formato exato da saída do agente

Após gerar o `IMPLEMENTATION.md` (ou `IMPLEMENTATION_FIXBUG.md`), o agente deve produzir a saída no formato abaixo, em português do Brasil:

```
Para executar [IMPLEMENTATION.md / IMPLEMENTATION_FIXBUG.md] eu sugiro os modelos a seguir que tem o melhor desempenho para essa tarefa:

1. [nome-do-modelo-principal]
   Justificativa: [1-2 linhas citando o domínio identificado na SPEC e o benchmark/feature que sustenta a recomendação. Ex: "SPEC envolve OAuth 2.1 + RBAC + RLS no Postgres — GLM-5.1 lidera CyberGym (68,7) e SWE-Bench Pro (58,4%), com aderência forte a RFCs de identidade e RLS Supabase."]

2. [nome-do-modelo-fallback-técnico]
   Justificativa: [1-2 linhas]

3. [nome-do-modelo-fallback-budget]
   Justificativa: [1-2 linhas]
```

**Regras de redação da saída:**
- Sempre exatamente 3 modelos (não mais, não menos)
- Sempre nessa ordem: principal → fallback técnico → fallback de budget
- Justificativa deve citar o domínio específico identificado na SPEC, não termos genéricos
- Justificativa deve citar pelo menos um benchmark ou feature distintiva
- Português do Brasil, tom direto, sem floreio
- Nunca recomende modelo que esteja em anti-pattern (Parte 8) para o caso

**Exemplo real de saída:**

> Para executar IMPLEMENTATION.md eu sugiro os modelos a seguir que tem o melhor desempenho para essa tarefa:
>
> 1. **glm-5.1**
>    Justificativa: A SPEC envolve autenticação com senha (bcrypt), JWT com refresh rotation e RLS no Supabase. GLM-5.1 lidera CyberGym (68,7) — benchmark especializado em segurança — e SWE-Bench Pro (58,4%). Tem aderência forte a OWASP ASVS e gera policies RLS Postgres com precisão.
>
> 2. **kimi-k2.6**
>    Justificativa: Empata GLM em SWE-Bench Pro (58,6%) e cobre fluxos JWT/refresh com qualidade. Boa escolha se você precisar de janela de contexto maior ou Agent Swarm para investigar bordas do fluxo.
>
> 3. **deepseek-v4-pro**
>    Justificativa: Durante a promoção até 31/05/2026, entrega ~80% da capacidade dos líderes a 1/4 do custo. Implementa corretamente os algoritmos criptográficos e queries de autorização. Recomendado se budget for restrição.

---

## Parte 11 — Notas sobre evolução deste documento

Este documento foi gerado em 18 de maio de 2026. Modelos de IA evoluem rapidamente — revise trimestralmente.

**Próximos eventos esperados que devem disparar atualização:**
- 31/05/2026 — fim da promoção DeepSeek V4 Pro (recalcular custo-benefício)
- 14/05/2026 — deprecation GLM-5 no OpenCode
- 05/06/2026 — descontinuação GPT-5.2
- Lançamentos futuros: Qwen3.7, GLM-5.2, Kimi K3, DeepSeek V5

**Critérios para adicionar novo modelo a este documento:**
1. Disponibilidade pública via API ou self-host
2. License compatível com projetos comerciais (ou flag explícito como Non-Commercial)
3. Score em ao menos um benchmark relevante (SWE-Bench Pro, LiveCodeBench, Terminal-Bench)
4. Validação independente em pelo menos uma fonte fora do provedor

**Critérios para remover modelo:**
1. Descontinuação anunciada pelo provedor
2. Substituído por versão estritamente superior no mesmo preço
3. License mudada para incompatível com uso comercial (caso minimax-m2.7)
