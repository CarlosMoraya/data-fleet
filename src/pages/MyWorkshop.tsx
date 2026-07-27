import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Wrench } from 'lucide-react';
import React from 'react';
import { Navigate, useNavigate } from 'react-router-dom';

import WorkshopForm from '../components/WorkshopForm';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { workshopAccountToRow } from '../lib/workshopAccountMappers';

import type { Workshop } from '../types';

export default function MyWorkshop() {
  const { user, workshopAccount, loading, refreshWorkshopAccount } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const handleClose = () => {
    void navigate('/manutencao', { replace: true });
  };

  const handleSave = async (dados: Partial<Workshop>) => {
    if (!workshopAccount) return;
    const { error } = await supabase
      .from('workshop_accounts')
      .update(workshopAccountToRow(dados))
      .eq('id', workshopAccount.id);
    // Em erro, propaga para o WorkshopForm exibir na faixa vermelha do rodapé
    if (error) throw error;

    await refreshWorkshopAccount();
    void queryClient.invalidateQueries({ queryKey: ['maintenance'] });
    void queryClient.invalidateQueries({ queryKey: ['workshops'] });
    void navigate('/manutencao', { replace: true });
  };

  if (user && user.role !== 'Workshop') {
    return <Navigate to="/" replace />;
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!workshopAccount) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-100">
          <Wrench className="h-6 w-6 text-orange-600" />
        </div>
        <p className="max-w-md text-sm text-zinc-600">
          Não encontramos a conta da sua oficina. Contate a transportadora que enviou o convite.
        </p>
      </div>
    );
  }

  const workshopForForm: Workshop = {
    id: workshopAccount.id,
    clientId: '',
    name: workshopAccount.name,
    cnpj: workshopAccount.cnpj,
    phone: workshopAccount.phone,
    email: workshopAccount.email,
    contactPerson: workshopAccount.contactPerson,
    addressStreet: workshopAccount.addressStreet,
    addressNumber: workshopAccount.addressNumber,
    addressComplement: workshopAccount.addressComplement,
    addressNeighborhood: workshopAccount.addressNeighborhood,
    addressCity: workshopAccount.addressCity,
    addressState: workshopAccount.addressState,
    addressZip: workshopAccount.addressZip,
    specialties: workshopAccount.specialties,
    notes: workshopAccount.notes,
    active: workshopAccount.active,
    profileId: workshopAccount.profileId,
  };

  return (
    <div className="h-full">
      <WorkshopForm
        mode="self"
        workshop={workshopForForm}
        onClose={handleClose}
        onSave={handleSave}
      />
    </div>
  );
}
