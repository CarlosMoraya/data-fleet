import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardCheck, Play, Eye, Trash2, Truck, FileStack, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { checklistFromRow, type ChecklistRow } from '../lib/checklistMappers';
import { templateFromRow, type ChecklistTemplateRow } from '../lib/checklistTemplateMappers';
import type { Checklist, ChecklistTemplate } from '../types';
import ChecklistDetailModal from '../components/ChecklistDetailModal';
import { cn } from '../lib/utils';

const STATUS_LABEL: Record<string, string> = { in_progress: 'Em andamento', completed: 'Concluído' };
const STATUS_COLOR: Record<string, string> = {
  in_progress: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-800',
};

export default function Checklists() {
  const { user, currentClient } = useAuth();
  const navigate = useNavigate();

  const isDriver = user?.role === 'Driver';
  const isAuditor = user?.role === 'Yard Auditor';
  const isDriverOrAuditor = isDriver || isAuditor;
  const isAssistantPlus = ['Fleet Assistant', 'Fleet Analyst', 'Manager', 'Director', 'Admin Master'].includes(user?.role ?? '');
  const isAdminMaster = user?.role === 'Admin Master';

  // Driver-specific data
  const [vehicleInfo, setVehicleInfo] = useState<{ id: string; plate: string; category: string | null } | null>(null);
  const [publishedTemplate, setPublishedTemplate] = useState<ChecklistTemplate | null>(null);
  const [freeTemplates, setFreeTemplates] = useState<ChecklistTemplate[]>([]);
  const [openChecklist, setOpenChecklist] = useState<Checklist | null>(null);

  // Checklist list
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<string | null>(null);

  const [viewChecklist, setViewChecklist] = useState<Checklist | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Checklist | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);

    if (isDriverOrAuditor) {
      if (isDriver) {
        // Passo 1: encontrar o driver record via profile_id = user.id
        const { data: driverRec } = await supabase
          .from('drivers')
          .select('id')
          .eq('profile_id', user!.id)
          .eq('client_id', currentClient.id)
          .maybeSingle();

        // Passo 2: encontrar o veículo via driver.id
        if (driverRec) {
          const { data: vehicleData } = await supabase
            .from('vehicles')
            .select('id, license_plate, category')
            .eq('driver_id', driverRec.id)
            .maybeSingle();
          if (vehicleData) {
            setVehicleInfo({ id: vehicleData.id, plate: vehicleData.license_plate, category: vehicleData.category });
            if (vehicleData.category) {
              const { data: tplData } = await supabase
                .from('checklist_templates')
                .select('*')
                .eq('client_id', currentClient.id)
                .eq('vehicle_category', vehicleData.category)
                .eq('status', 'published')
                .eq('is_free_form', false)
                .maybeSingle();
              if (tplData) setPublishedTemplate(templateFromRow(tplData as ChecklistTemplateRow));
            }
          }
        }
      }

      const { data: freeTpls } = await supabase
        .from('checklist_templates')
        .select('*')
        .eq('client_id', currentClient.id)
        .eq('is_free_form', true)
        .eq('status', 'published');
      setFreeTemplates((freeTpls ?? []).map(r => templateFromRow(r as ChecklistTemplateRow)));

      const { data: openData } = await supabase
        .from('checklists')
        .select('*, vehicles(license_plate), profiles(name), checklist_templates(name)')
        .eq('filled_by', user!.id)
        .eq('status', 'in_progress')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (openData) setOpenChecklist(checklistFromRow(openData as ChecklistRow));

      const { data: histData } = await supabase
        .from('checklists')
        .select('*, vehicles(license_plate), profiles(name), checklist_templates(name)')
        .eq('filled_by', user!.id)
        .order('started_at', { ascending: false })
        .limit(30);
      setChecklists((histData ?? []).map(r => checklistFromRow(r as ChecklistRow)));
    } else if (isAssistantPlus) {
      const { data } = await supabase
        .from('checklists')
        .select('*, vehicles(license_plate), profiles(name), checklist_templates(name)')
        .eq('client_id', currentClient.id)
        .order('started_at', { ascending: false });
      setChecklists((data ?? []).map(r => checklistFromRow(r as ChecklistRow)));
    }

    setLoading(false);
  }, [user, currentClient.id, isDriver, isDriverOrAuditor, isAssistantPlus]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const startChecklist = async (template: ChecklistTemplate, vehicleId?: string) => {
    setStarting(template.id);
    try {
      const { data, error } = await supabase
        .from('checklists')
        .insert({
          client_id: currentClient.id,
          template_id: template.id,
          version_number: template.currentVersion,
          vehicle_id: vehicleId ?? null,
          filled_by: user!.id,
          status: 'in_progress',
          device_info: navigator.userAgent,
        })
        .select()
        .single();
      if (error) throw error;
      navigate(`/checklists/preencher/${data.id}`);
    } catch (err) {
      console.error(err);
    } finally {
      setStarting(null);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    await supabase.from('checklists').delete().eq('id', confirmDelete.id);
    setConfirmDelete(null);
    setDeleting(false);
    fetchData();
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 flex items-center gap-2">
            <ClipboardCheck className="h-6 w-6 text-orange-500" />
            Checklists
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            {isDriverOrAuditor ? 'Inicie ou continue um checklist' : 'Histórico de inspeções do tenant'}
          </p>
        </div>
      </div>

      {/* ── Driver / Auditor view ─────────────────────────────── */}
      {isDriverOrAuditor && (
        <>
          {openChecklist && (
            <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 flex items-center gap-4">
              <ClipboardCheck className="h-8 w-8 text-orange-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-orange-800">Checklist em andamento</p>
                <p className="text-xs text-orange-600 truncate">{openChecklist.templateName} — {formatDate(openChecklist.startedAt)}</p>
              </div>
              <button
                onClick={() => navigate(`/checklists/preencher/${openChecklist.id}`)}
                className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-xl hover:bg-orange-600"
              >
                <Play className="h-4 w-4" />
                Continuar
              </button>
            </div>
          )}

          {isDriver && (
            <div className="bg-white rounded-2xl border border-zinc-200 p-5">
              <h2 className="text-sm font-semibold text-zinc-700 mb-3 flex items-center gap-2">
                <Truck className="h-4 w-4 text-orange-500" />
                Meu veículo
              </h2>
              {vehicleInfo ? (
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <p className="font-semibold text-zinc-900">{vehicleInfo.plate}</p>
                    <p className="text-xs text-zinc-500">{vehicleInfo.category ?? 'Sem categoria'}</p>
                  </div>
                  {publishedTemplate ? (
                    <button
                      disabled={!!openChecklist || starting === publishedTemplate.id}
                      onClick={() => startChecklist(publishedTemplate, vehicleInfo.id)}
                      className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-xl hover:bg-orange-600 disabled:opacity-50"
                    >
                      {starting === publishedTemplate.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                      Iniciar Checklist
                    </button>
                  ) : (
                    <p className="text-xs text-zinc-400 italic">Nenhum template publicado para {vehicleInfo.category}</p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-zinc-400 italic">Nenhum veículo associado ao seu perfil.</p>
              )}
            </div>
          )}

          {freeTemplates.length > 0 && (
            <div className="bg-white rounded-2xl border border-zinc-200 p-5">
              <h2 className="text-sm font-semibold text-zinc-700 mb-3 flex items-center gap-2">
                <FileStack className="h-4 w-4 text-purple-500" />
                Checklists Livres
              </h2>
              <div className="space-y-2">
                {freeTemplates.map(t => (
                  <div key={t.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-zinc-100 hover:bg-zinc-50">
                    <div>
                      <p className="text-sm font-medium text-zinc-900">{t.name}</p>
                      {t.description && <p className="text-xs text-zinc-400">{t.description}</p>}
                    </div>
                    <button
                      disabled={!!openChecklist || starting === t.id}
                      onClick={() => startChecklist(t)}
                      className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 text-white text-xs font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50"
                    >
                      {starting === t.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                      Iniciar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-zinc-200 p-5">
            <h2 className="text-sm font-semibold text-zinc-700 mb-3">Histórico</h2>
            {checklists.length === 0 ? (
              <p className="text-sm text-zinc-400 italic text-center py-4">Nenhum checklist realizado ainda.</p>
            ) : (
              <div className="space-y-2">
                {checklists.map(c => (
                  <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl border border-zinc-100">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-900 truncate">{c.templateName}</p>
                      <p className="text-xs text-zinc-500">{formatDate(c.startedAt)}</p>
                    </div>
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', STATUS_COLOR[c.status])}>
                      {STATUS_LABEL[c.status]}
                    </span>
                    {c.status === 'completed' && (
                      <button onClick={() => setViewChecklist(c)} className="p-1.5 rounded-lg hover:bg-zinc-100">
                        <Eye className="h-4 w-4 text-zinc-400" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Fleet Assistant+ view ─────────────────────────────── */}
      {isAssistantPlus && (
        <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
          {checklists.length === 0 ? (
            <div className="text-center py-16 text-zinc-400">
              <ClipboardCheck className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhum checklist realizado neste tenant.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-zinc-100">
                <thead>
                  <tr className="bg-zinc-50">
                    {['Template', 'Veículo', 'Preenchido por', 'Data', 'Status', 'Ações'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {checklists.map(c => (
                    <tr key={c.id} className="hover:bg-zinc-50">
                      <td className="px-4 py-3 text-sm text-zinc-900">{c.templateName ?? '—'}</td>
                      <td className="px-4 py-3 text-sm text-zinc-600">
                        {c.vehicleLicensePlate ?? <span className="italic text-zinc-400">Livre</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-600">{c.filledByName ?? '—'}</td>
                      <td className="px-4 py-3 text-xs text-zinc-500">{formatDate(c.startedAt)}</td>
                      <td className="px-4 py-3">
                        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', STATUS_COLOR[c.status])}>
                          {STATUS_LABEL[c.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => setViewChecklist(c)} className="p-1.5 rounded hover:bg-zinc-100">
                            <Eye className="h-4 w-4 text-zinc-400" />
                          </button>
                          {isAdminMaster && (
                            <button
                              onClick={() => setConfirmDelete(c)}
                              className="p-1.5 rounded hover:bg-red-50 text-red-400"
                              title="Excluir (Admin Master)"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {viewChecklist && (
        <ChecklistDetailModal checklist={viewChecklist} onClose={() => setViewChecklist(null)} />
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4">
            <h3 className="text-lg font-semibold text-red-700">Excluir checklist</h3>
            <p className="text-sm text-zinc-600">
              Esta ação é <strong>irreversível</strong>. O checklist, todas as respostas e ações vinculadas serão removidos permanentemente.
            </p>
            <p className="text-sm font-medium text-zinc-900">
              Template: <span className="text-orange-600">{confirmDelete.templateName}</span>
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmDelete(null)} disabled={deleting} className="px-4 py-2 text-sm text-zinc-600">
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Excluindo...' : 'Excluir permanentemente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
