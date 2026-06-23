/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { queryClient, persister } from './lib/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import Layout from './components/Layout';
import RouteFallback from './components/RouteFallback';
import ChunkErrorBoundary from './components/ChunkErrorBoundary';
import Login from './pages/Login';
import { getDefaultRouteForRole } from './lib/rolePermissions';
import { shouldPersistQuery } from './lib/cachePolicy';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Vehicles = lazy(() => import('./pages/Vehicles'));
const Drivers = lazy(() => import('./pages/Drivers'));
const Workshops = lazy(() => import('./pages/Workshops'));
const Checklists = lazy(() => import('./pages/Checklists'));
const ChecklistFill = lazy(() => import('./pages/ChecklistFill'));
const ChecklistTemplates = lazy(() => import('./pages/ChecklistTemplates'));
const ActionPlans = lazy(() => import('./pages/ActionPlans'));
const Maintenance = lazy(() => import('./pages/Maintenance'));
const AdminClients = lazy(() => import('./pages/AdminClients'));
const AdminUsers = lazy(() => import('./pages/AdminUsers'));
const Users = lazy(() => import('./pages/Users'));
const Settings = lazy(() => import('./pages/Settings'));
const Cadastros = lazy(() => import('./pages/Cadastros'));
const Shippers = lazy(() => import('./pages/Shippers'));
const OperationalUnits = lazy(() => import('./pages/OperationalUnits'));
const WorkshopSchedules = lazy(() => import('./pages/WorkshopSchedules'));
const BudgetApprovals = lazy(() => import('./pages/BudgetApprovals'));
const Tires = lazy(() => import('./pages/Tires'));
const WorkshopJoin = lazy(() => import('./pages/WorkshopJoin'));
const TireInspectionFill = lazy(() => import('./pages/TireInspectionFill'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const ChangePassword = lazy(() => import('./pages/ChangePassword'));
const WarrantyRevisions = lazy(() => import('./pages/WarrantyRevisions'));

function HomeRedirect() {
  const { user } = useAuth();
  const defaultRoute = getDefaultRouteForRole(user?.role);
  if (defaultRoute !== '/') {
    return <Navigate to={defaultRoute} replace />;
  }
  return <Dashboard />;
}

function OfflineSyncBoot() {
  useOnlineStatus(); // Dispara flushQueue ao reconectar, mesmo fora do ChecklistFill
  return null;
}

export default function App() {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 1000 * 60 * 60 * 24,
        buster: 'v3',
        dehydrateOptions: {
          shouldDehydrateQuery: (q) => shouldPersistQuery(q.queryKey, q.state.dataUpdatedAt, Date.now()),
        },
      }}
    >
      <OfflineSyncBoot />
      <AuthProvider>
        <Router>
          <ChunkErrorBoundary>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/workshop/join" element={<WorkshopJoin />} />
                <Route path="/recuperar-senha" element={<ForgotPassword />} />
                <Route path="/redefinir-senha" element={<ResetPassword />} />
                <Route path="/" element={<Layout />}>
                <Route index element={<HomeRedirect />} />
                <Route path="cadastros" element={<Cadastros />}>
                  <Route index element={<Navigate to="veiculos" replace />} />
                  <Route path="veiculos" element={<Vehicles />} />
                  <Route path="motoristas" element={<Drivers />} />
                  <Route path="oficinas" element={<Workshops />} />
                  <Route path="embarcadores" element={<Shippers />} />
                  <Route path="unidades-operacionais" element={<OperationalUnits />} />
                  <Route path="usuarios" element={<Users />} />
                  <Route path="pneus" element={<Tires />} />
                </Route>
                {/* Redirects para compatibilidade com rotas antigas */}
                <Route path="vehicles" element={<Navigate to="/cadastros/veiculos" replace />} />
                <Route path="drivers" element={<Navigate to="/cadastros/motoristas" replace />} />
                <Route path="users" element={<Navigate to="/cadastros/usuarios" replace />} />
                <Route path="checklists" element={<Checklists />} />
                <Route path="checklists/preencher/:checklistId" element={<ChecklistFill />} />
                <Route path="inspecao-pneus/:inspectionId" element={<TireInspectionFill />} />
                <Route path="checklist-templates" element={<ChecklistTemplates />} />
                <Route path="acoes" element={<ActionPlans />} />
                <Route path="agendamentos" element={<WorkshopSchedules />} />
                <Route path="manutencao" element={<Maintenance />} />
                <Route path="aprovacao-orcamentos" element={<BudgetApprovals />} />
                <Route path="conta/senha" element={<ChangePassword />} />
                <Route path="revisoes-garantia" element={<WarrantyRevisions />} />
                <Route path="settings" element={<Settings />} />
                <Route path="admin/clients" element={<AdminClients />} />
                <Route path="admin/users" element={<AdminUsers />} />
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </ChunkErrorBoundary>
        </Router>
      </AuthProvider>
    </PersistQueryClientProvider>
  );
}
