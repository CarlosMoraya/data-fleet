# Validação das Migrations — Etapas 1, 2, 3 (Módulo Financeiro)

Execute este script no **SQL Editor do Supabase Dashboard** (DEV: `vvbnbzzhpiksacqudmfu`) para validar que as três migrations foram aplicadas com sucesso.

## Copie e cole no SQL Editor

```sql
-- ============================================================
-- Validação Etapa 1: Cargo "Financeiro"
-- ============================================================
SELECT 'Etapa 1: role_ranks' as test,
       rank as valor_esperado_1
FROM public.role_ranks
WHERE role = 'Financeiro';

-- Validar constraint
SELECT pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conname = 'profiles_role_check'
AND connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- ============================================================
-- Validação Etapa 2: Tabela payment_installments
-- ============================================================
SELECT 'Etapa 2: tabela payment_installments' as test,
       COUNT(*) > 0 as existe
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name = 'payment_installments';

-- Checar índices
SELECT 'Etapa 2: índices' as test,
       indexname
FROM pg_indexes
WHERE tablename = 'payment_installments'
AND schemaname = 'public'
ORDER BY indexname;

-- Checar políticas RLS
SELECT 'Etapa 2: políticas RLS' as test,
       policyname
FROM pg_policies
WHERE tablename = 'payment_installments'
AND schemaname = 'public'
ORDER BY policyname;

-- Checar trigger
SELECT 'Etapa 2: trigger' as test,
       tgname
FROM pg_trigger
WHERE tgrelid = 'public.payment_installments'::regclass
AND tgname LIKE '%validate%';

-- ============================================================
-- Validação Etapa 3: Bucket financial-documents
-- ============================================================
SELECT 'Etapa 3: bucket financial-documents' as test,
       id,
       name,
       public as eh_publico
FROM storage.buckets
WHERE id = 'financial-documents';

-- Checar políticas do bucket
SELECT 'Etapa 3: políticas do bucket' as test,
       policyname
FROM pg_policies
WHERE tablename = 'objects'
AND schemaname = 'storage'
AND policyname LIKE '%Financial%'
ORDER BY policyname;
```

## Resultado esperado

| Test | Resultado esperado |
|------|-------------------|
| `Etapa 1: role_ranks` | Uma linha com `rank = 1` |
| `Etapa 1: constraint` | Uma linha com `'Financeiro'` na lista de papéis |
| `Etapa 2: tabela` | `existe = true` |
| `Etapa 2: índices` | 3 linhas: `idx_pi_client`, `idx_pi_order`, `idx_pi_status` |
| `Etapa 2: políticas RLS` | 4 linhas: `payment_installments_delete`, `insert`, `select`, `update` |
| `Etapa 2: trigger` | 1 linha: `trg_validate_payment_installment_transition` |
| `Etapa 3: bucket` | 1 linha com `id='financial-documents'`, `public=false` |
| `Etapa 3: políticas do bucket` | 2 linhas: `Financial Documents Insert`, `Select` |

---

## Após validar em DEV

1. ✅ Todas as queries acima passaram
2. ✅ Testar um fluxo simples (ex.: criar uma parcela como Fleet Assistant)
3. ✅ Fazer commit local: `git add src/ supabase/migrations/ && git commit -m "..."`
4. ⏳ Push fica para outra sessão
