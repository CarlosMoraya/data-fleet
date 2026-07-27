import { AlertTriangle } from 'lucide-react';
import React from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';
import { isWorkshopProfileComplete, missingWorkshopProfileFields } from '../lib/workshopProfile';

export default function WorkshopProfileBanner() {
  const { user, workshopAccount } = useAuth();
  const navigate = useNavigate();

  if (user?.role !== 'Workshop' || isWorkshopProfileComplete(workshopAccount)) {
    return null;
  }

  const missing = missingWorkshopProfileFields(workshopAccount);

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-amber-800">
            <AlertTriangle className="h-4 w-4" />
            Complete o cadastro da sua oficina
          </h3>
          <p className="mt-1 text-sm text-amber-800">
            Enquanto o cadastro estiver incompleto você pode acompanhar as ordens de serviço, mas não enviar orçamentos nem atualizar status.
          </p>
          <ul className="mt-2 list-inside list-disc text-sm text-amber-800">
            {missing.map((label) => (
              <li key={label}>{label}</li>
            ))}
          </ul>
        </div>
        <button
          type="button"
          onClick={() => { void navigate('/minha-oficina'); }}
          className="flex-shrink-0 rounded-xl bg-amber-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-600"
        >
          Complete seu cadastro
        </button>
      </div>
    </div>
  );
}
