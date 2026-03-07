import React from 'react';
import { useAuth } from '../context/AuthContext';
import { ClipboardCheck } from 'lucide-react';

export default function Checklists() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Checklists</h1>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-12 text-center shadow-sm">
        <ClipboardCheck className="mx-auto h-12 w-12 text-zinc-400" />
        <h3 className="mt-2 text-sm font-semibold text-zinc-900">No checklists</h3>
        <p className="mt-1 text-sm text-zinc-500">
          {user?.role === 'Driver' 
            ? "You don't have any pending checklists for your assigned vehicles."
            : "Get started by creating a new checklist template."}
        </p>
        {user?.role !== 'Driver' && (
          <div className="mt-6">
            <button
              type="button"
              className="inline-flex items-center rounded-xl bg-zinc-900 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
            >
              <ClipboardCheck className="-ml-0.5 mr-1.5 h-5 w-5" aria-hidden="true" />
              New Checklist
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
