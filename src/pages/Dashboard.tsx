import React from 'react';
import { useAuth } from '../context/AuthContext';
import { MOCK_VEHICLES } from '../constants';
import { Truck, AlertTriangle, Wrench } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';

export default function Dashboard() {
  const { currentClient } = useAuth();
  
  const clientVehicles = MOCK_VEHICLES.filter(v => v.clientId === currentClient?.id);
  
  const totalVehicles = clientVehicles.length;
  const inMaintenance = clientVehicles.filter(v => v.status === 'Maintenance').length;
  const activeAlerts = Math.floor(Math.random() * 10); // Mock alerts

  // Chart Data
  const categoryData = [
    { name: 'Passeio', count: clientVehicles.filter(v => v.type === 'Passeio').length },
    { name: 'Utilitário', count: clientVehicles.filter(v => v.type === 'Utilitário').length },
    { name: 'Van', count: clientVehicles.filter(v => v.type === 'Van').length },
    { name: 'Moto', count: clientVehicles.filter(v => v.type === 'Moto').length },
    { name: 'Vuc', count: clientVehicles.filter(v => v.type === 'Vuc').length },
    { name: 'Toco', count: clientVehicles.filter(v => v.type === 'Toco').length },
    { name: 'Truck', count: clientVehicles.filter(v => v.type === 'Truck').length },
    { name: 'Cavalo', count: clientVehicles.filter(v => v.type === 'Cavalo').length },
  ];

  const statusData = [
    { name: 'Available', value: clientVehicles.filter(v => v.status === 'Available').length },
    { name: 'In Use', value: clientVehicles.filter(v => v.status === 'In Use').length },
    { name: 'Maintenance', value: inMaintenance },
  ];

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Dashboard</h1>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Truck className="h-6 w-6" />
            </div>
            <div className="ml-4">
              <h2 className="text-sm font-medium text-zinc-500">Total Vehicles</h2>
              <p className="text-3xl font-semibold text-zinc-900">{totalVehicles}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <Wrench className="h-6 w-6" />
            </div>
            <div className="ml-4">
              <h2 className="text-sm font-medium text-zinc-500">In Maintenance</h2>
              <p className="text-3xl font-semibold text-zinc-900">{inMaintenance}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-600">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div className="ml-4">
              <h2 className="text-sm font-medium text-zinc-500">Active Alerts</h2>
              <p className="text-3xl font-semibold text-zinc-900">{activeAlerts}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h3 className="text-base font-semibold text-zinc-900 mb-6">Fleet by Category</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#71717a', fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#71717a', fontSize: 12 }} />
                <Tooltip 
                  cursor={{ fill: '#f4f4f5' }}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e4e4e7', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h3 className="text-base font-semibold text-zinc-900 mb-6">Current Status</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e4e4e7', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
