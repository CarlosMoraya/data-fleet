# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
npm install

# Start dev server (port 3000, all interfaces)
npm run dev

# Type-check (no emit) — used as lint
npm run lint

# Build for production
npm run build

# Preview production build
npm run preview
```

There is no test suite configured.

## Environment

Copy `.env.example` to `.env.local` and set `GEMINI_API_KEY` to a valid Gemini API key before running.

The `GEMINI_API_KEY` is exposed to the Vite client bundle via `vite.config.ts` using `define`. The `@` alias maps to the project root.

## Architecture

**Data Fleet** is a multi-tenant SaaS fleet management app built with React 19, Vite, TypeScript, and Tailwind CSS v4.

### Key patterns

- **Multi-tenancy via `clientId`**: All data entities (`Vehicle`, etc.) carry a `clientId` field. Filtering by `currentClient.id` from `AuthContext` is the standard pattern for scoping data to the active tenant.
- **Role-based access**: Roles are defined in `src/types.ts` (`Driver`, `Yard Auditor`, `Fleet Assistant`, `Fleet Analyst`, `Manager`, `Director`, `Admin Master`). Permission checks are done inline using `user.role` comparisons (e.g., `canEdit` in `Vehicles.tsx`). Client-switching is only available to Manager/Director/Admin Master.
- **Mock data as source of truth**: There is no backend or database yet. All data lives in `src/constants.ts` (`MOCK_CLIENTS`, `MOCK_VEHICLES`). Pages use local `useState` initialized from this mock data to simulate CRUD.
- **Auth state**: `AuthContext` holds the logged-in `User` and `currentClient`. There is no real authentication — `Login.tsx` accepts any email and a selected role/client.

### Structure

| Path | Purpose |
|------|---------|
| `src/types.ts` | Shared TypeScript interfaces (`User`, `Client`, `Vehicle`, `Role`) |
| `src/constants.ts` | Mock data for clients and vehicles |
| `src/context/AuthContext.tsx` | Auth + client context; exposes `useAuth()` hook |
| `src/components/Layout.tsx` | Shell with sidebar + outlet for nested routes |
| `src/components/VehicleForm.tsx` | Multi-step form for creating/editing vehicles |
| `src/pages/Dashboard.tsx` | KPI cards + Recharts bar/pie charts scoped to current client |
| `src/pages/Vehicles.tsx` | Vehicle table with inline edit; mutation is local state only |
| `src/pages/Checklists.tsx` | Checklist page (stub) |
| `src/lib/utils.ts` | `cn()` helper (clsx + tailwind-merge) |

### Routing

Routes are defined in `src/App.tsx`. Protected pages nest under the `<Layout>` route (`/`). Unauthenticated access is not yet enforced by a guard — the login flow is purely UI-driven.
