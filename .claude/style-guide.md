# Guia de Estilo & Convenções

## TypeScript

- **Strict mode** habilitado
- Interfaces em `src/types.ts` para tipos compartilhados
- Tipos inline para props de componentes quando simples
- `as string` para env vars (Vite `import.meta.env`)
- Evitar `any` — usar tipos explícitos ou generics do Supabase

## React

- **Functional components** apenas (sem classes)
- **Hooks**: `useState`, `useEffect`, `useContext` via `useAuth()`
- State local com `useState` para dados de página (CRUD simulado)
- Formulários: controlled inputs com state individual por campo
- Modais: overlay `fixed inset-0` com backdrop, form interno

## Tailwind CSS v4

- **Utility-first** — estilos inline via classes Tailwind
- Helper `cn()` em `src/lib/utils.ts` (clsx + tailwind-merge) para classes condicionais
- Cores do tema: definidas no Tailwind config
- Responsividade: mobile-first com breakpoints Tailwind padrão

## Nomenclatura

- **Arquivos**: PascalCase para componentes (`VehicleForm.tsx`), camelCase para utils (`supabase.ts`)
- **Componentes**: PascalCase (`<Layout>`, `<Sidebar>`, `<Topbar>`)
- **Hooks**: camelCase prefixado com `use` (`useAuth`)
- **Constantes**: UPPER_SNAKE_CASE (`MOCK_VEHICLES`, `MOCK_CLIENTS`)
- **Interfaces**: PascalCase (`User`, `Client`, `Vehicle`)
- **Tipos union**: string literals (`'Driver' | 'Manager'`)

## Padrão de Formulários Modais

1. Modal abre com state boolean
2. `useEffect` reseta campos quando modal abre
3. Inputs controlados vinculados a `useState`
4. Submit handler: operação CRUD + fecha modal
5. **Atenção**: aguardar 300ms antes de preencher em testes (race condition do useEffect)

### Persistência de Estado de Formulário (2026-04-12)

**Padrão no nível da página (CRUD):**
- Página persiste `isFormOpen` + `editingItem` em `sessionStorage` para que ao navegar e voltar, o formulário reabre
- Sincroniza automaticamente via `useEffect` quando esses estados mudam
- Limpa `sessionStorage` ao fechar ou salvar (não persiste entre sessões)

**Padrão no componente do formulário:**
- Formulário persiste seu estado interno (`formData`) em `sessionStorage` independentemente
- Inicializa do `sessionStorage` na montagem (usuário pode navegar sem perder dados preenchidos)
- Limpa ao salvar/cancelar

**Exemplo (página):**
```tsx
const [isFormOpen, setIsFormOpen] = useState<boolean>(() =>
  sessionStorage.getItem('vehicleFormOpen') === 'true'
);
const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(() => {
  const saved = sessionStorage.getItem('vehicleFormEditing');
  return saved ? JSON.parse(saved) : null;
});
useEffect(() => {
  sessionStorage.setItem('vehicleFormOpen', String(isFormOpen));
  sessionStorage.setItem('vehicleFormEditing', JSON.stringify(editingVehicle));
}, [isFormOpen, editingVehicle]);
```

**Segurança:**
- `sessionStorage` é destruído ao fechar a aba ou fazer logout
- Nunca persistir dados sensíveis a localStorage
- Dados de negócio (formulários CRUD) são seguros em sessionStorage porque:
  - Não sobrevivem ao reload automático do browser
  - Não sobrevivem ao logout
  - Dispositivos compartilhados (comum em frotas) não veem dados de outras sessões

## Padrão Multi-Tenancy

- Toda entidade carrega `clientId` (frontend) / `client_id` (banco)
- Filtrar sempre por `currentClient.id` do `useAuth()`
- Admin Master pode trocar de client via Topbar switcher

## Padrão de Acesso por Role

```ts
const canEdit = ['Fleet Assistant', 'Fleet Analyst', 'Manager', 'Director', 'Admin Master'].includes(user.role);
```

- Verificações inline usando `user.role`
- Hierarquia numérica para comparações:
  Driver(1) < Yard Auditor(2) < Fleet Assistant(3) < Fleet Analyst(4) < Manager(5) < Director(6) < Admin Master(7)

## Git

- Mensagens de commit em português ou inglês (consistente por sessão)
- Commits descritivos focando no "porquê"
- Não commitar `.env.local`, `e2e/.auth/`, `node_modules/`
