/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Vehicles from './pages/Vehicles';
import Drivers from './pages/Drivers';
import Workshops from './pages/Workshops';
import Checklists from './pages/Checklists';
import ChecklistFill from './pages/ChecklistFill';
import ChecklistTemplates from './pages/ChecklistTemplates';
import ActionPlans from './pages/ActionPlans';
import Maintenance from './pages/Maintenance';
import AdminClients from './pages/AdminClients';
import AdminUsers from './pages/AdminUsers';
import Users from './pages/Users';
import Settings from './pages/Settings';
import Cadastros from './pages/Cadastros';
import Shippers from './pages/Shippers';
import OperationalUnits from './pages/OperationalUnits';
import WorkshopSchedules from './pages/WorkshopSchedules';
import BudgetApprovals from './pages/BudgetApprovals';

function HomeRedirect() {
  const { user } = useAuth();
  if (user?.role === 'Driver' || user?.role === 'Yard Auditor') {
    return <Navigate to="/checklists" replace />;
  }
  return <Dashboard />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
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
              </Route>
              {/* Redirects para compatibilidade com rotas antigas */}
              <Route path="vehicles" element={<Navigate to="/cadastros/veiculos" replace />} />
              <Route path="drivers" element={<Navigate to="/cadastros/motoristas" replace />} />
              <Route path="users" element={<Navigate to="/cadastros/usuarios" replace />} />
              <Route path="checklists" element={<Checklists />} />
              <Route path="checklists/preencher/:checklistId" element={<ChecklistFill />} />
              <Route path="checklist-templates" element={<ChecklistTemplates />} />
              <Route path="acoes" element={<ActionPlans />} />
              <Route path="agendamentos" element={<WorkshopSchedules />} />
              <Route path="manutencao" element={<Maintenance />} />
              <Route path="aprovacao-orcamentos" element={<BudgetApprovals />} />
              <Route path="settings" element={<Settings />} />
              <Route path="admin/clients" element={<AdminClients />} />
              <Route path="admin/users" element={<AdminUsers />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}
