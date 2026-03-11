/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Vehicles from './pages/Vehicles';
import Checklists from './pages/Checklists';
import AdminClients from './pages/AdminClients';
import AdminUsers from './pages/AdminUsers';
import Users from './pages/Users';
import Settings from './pages/Settings';

function HomeRedirect() {
  const { user } = useAuth();
  if (user?.role === 'Driver' || user?.role === 'Yard Auditor') {
    return <Navigate to="/checklists" replace />;
  }
  return <Dashboard />;
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Layout />}>
            <Route index element={<HomeRedirect />} />
            <Route path="vehicles" element={<Vehicles />} />
            <Route path="checklists" element={<Checklists />} />
            <Route path="users" element={<Users />} />
            <Route path="settings" element={<Settings />} />
            <Route path="admin/clients" element={<AdminClients />} />
            <Route path="admin/users" element={<AdminUsers />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
