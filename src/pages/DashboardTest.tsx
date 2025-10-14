import React from 'react';
import AuthenticatedLayout from '../components/AuthenticatedLayout';

export default function DashboardTest() {
  return (
    <AuthenticatedLayout>
      <div className="min-h-screen bg-slate-900 text-white p-8">
        <h1 className="text-2xl font-bold mb-4">Dashboard Test</h1>
        <p className="text-slate-300">Teste simples do Dashboard</p>
      </div>
    </AuthenticatedLayout>
  );
}
