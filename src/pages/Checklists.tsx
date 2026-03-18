import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardCheck, ClipboardList, Play, Eye, Trash2, Truck, Loader2, Search, User, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { checklistFromRow, type ChecklistRow } from '../lib/checklistMappers';
import { templateFromRow, type ChecklistTemplateRow } from '../lib/checklistTemplateMappers';
import type { Checklist, ChecklistTemplate } from '../types';
import ChecklistDetailModal from '../components/ChecklistDetailModal';
import CreateActionPlanModal from '../components/CreateActionPlanModal';
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
  const isAssistantPlus = ['Fleet Assistant', 'Fleet Analyst', 'Supervisor', 'Manager', 'Coordinator', 'Director', 'Admin Master'].includes(user?.role ?? '');
  const isAnalystPlus = ['Fleet Analyst', 'Supervisor', 'Manager', 'Coordinator', 'Director', 'Admin Master'].includes(user?.role ?? '');
  const isAdminMaster = user?.role === 'Admin Master';

  // Driver state
  const [vehicleInfo, setVehicleInfo] = useState<{ id: string; plate: string; category: string | null } | null>(null);
  const [publishedTemplates, setPublishedTemplates] = useState<ChecklistTemplate[]>([]);
  const [openChecklist, setOpenChecklist] = useState<Checklist | null>(null);

  // Auditor state
  type VehicleOption = { id: string; plate: string; category: string | null; driverName: string | null };
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [auditorTemplates, setAuditorTemplates] = useState<ChecklistTemplate[]>([]);

  // History/list
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [historySearch, setHistorySearch] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<'all' | 'in_progress' | 'completed'>('all');
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<string | null>(null);

  const [viewChecklist, setViewChecklist] = useState<Checklist | null>(null);
  const [createPlanChecklist, setCreatePlanChecklist] = useState<Checklist | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Checklist | null>(null);
  const [deleting, setDeleting] = useState(false);

  // IDs of completed checklists that have at least one 'issue' response
  const [issueChecklistIds, setIssueChecklistIds] = useState<Set<string>>(new Set());
  const [onlyWithIssues, setOnlyWithIssues] = useState(false);

  // Load Auditor templates when vehicle selection changes
  useEffect(() => {
    if (!isAuditor || !selectedVehicleId) {
      setAuditorTemplates([]);
      return;
    }
    const selected = vehicles.find(v => v.id === selectedVehicleId);
    if (!selected?.category) { setAuditorTemplates([]); return; }
    (async () => {
      const { data } = await supabase
        .from('checklist_templates')
        .select('*')
        .eq('client_id', currentClient.id)
        .eq('vehicle_category', selected.category)
        .eq('context', 'Auditoria')
        .eq('status', 'published');
      setAuditorTemplates((data ?? []).map(r => templateFromRow(r as ChecklistTemplateRow)));
    })();
  }, [selectedVehicleId, isAuditor, vehicles, currentClient.id]);

  const fetchData = useCallback(async () => {
    setLoading(true);

    if (!currentClient?.id) {
      setLoading(false);
      return;
    }

    if (isDriver) {
      // Find driver record by profile_id and current client
      const { data: driverRec } = await supabase
        .from('drivers')
        .select('id, client_id')
        .eq('profile_id', user!.id)
        .eq('client_id', currentClient!.id)
        .maybeSingle();

      if (driverRec) {
        // Get vehicle associated with this driver
        const { data: vehicleData } = await supabase
          .from('vehicles')
          .select('id, license_plate, category')
          .eq('driver_id', driverRec.id)
          .eq('client_id', driverRec.client_id)
          .maybeSingle();

        if (vehicleData) {
          setVehicleInfo({ id: vehicleData.id, plate: vehicleData.license_plate, category: vehicleData.category });
          if (vehicleData.category) {
            // Load ALL published templates for this category (excluding Audit context)
            const { data: tplData } = await supabase
              .from('checklist_templates')
              .select('*')
              .eq('client_id', currentClient!.id)
              .eq('vehicle_category', vehicleData.category)
              .eq('status', 'published')
              .neq('context', 'Auditoria')
              .order('context');
            setPublishedTemplates((tplData ?? []).map(r => templateFromRow(r as ChecklistTemplateRow)));
          }
        }
      }

      // Open checklist
      const { data: openData } = await supabase
        .from('checklists')
        .select('*, vehicles(license_plate), profiles(name), checklist_templates(name, context)')
        .eq('filled_by', user!.id)
        .eq('status', 'in_progress')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setOpenChecklist(openData ? checklistFromRow(openData as ChecklistRow) : null);

      // History
      const { data: histData } = await supabase
        .from('checklists')
        .select('*, vehicles(license_plate), profiles(name), checklist_templates(name, context)')
        .eq('filled_by', user!.id)
        .order('started_at', { ascending: false })
        .limit(50);
      setChecklists((histData ?? []).map(r => checklistFromRow(r as ChecklistRow)));

    } else if (isAuditor) {
      // Load all vehicles with their assigned driver name
      const { data: vehicleData } = await supabase
        .from('vehicles')
        .select('id, license_plate, category, driver_id, drivers(profiles(name))')
        .eq('client_id', currentClient.id)
        .order('license_plate');
      setVehicles(
        (vehicleData ?? []).map((v: Record<string, unknown>) => ({
          id: v.id as string,
          plate: v.license_plate as string,
          category: v.category as string | null,
          driverName: ((v.drivers as Record<string, unknown> | null)?.profiles as Record<string, unknown> | null)?.name as string | null ?? null,
        })),
      );

      // Open checklist
      const { data: openData } = await supabase
        .from('checklists')
        .select('*, vehicles(license_plate), profiles(name), checklist_templates(name, context)')
        .eq('filled_by', user!.id)
        .eq('status', 'in_progress')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setOpenChecklist(openData ? checklistFromRow(openData as ChecklistRow) : null);

      // Auditor history
      const { data: histData } = await supabase
        .from('checklists')
        .select('*, vehicles(license_plate), profiles(name), checklist_templates(name, context)')
        .eq('filled_by', user!.id)
        .order('started_at', { ascending: false })
        .limit(50);
      setChecklists((histData ?? []).map(r => checklistFromRow(r as ChecklistRow)));

    } else if (isAssistantPlus) {
      const { data } = await supabase
        .from('checklists')
        .select('*, vehicles(license_plate), profiles(name), checklist_templates(name, context)')
        .eq('client_id', currentClient.id)
        .order('started_at', { ascending: false });
      const rows = (data ?? []).map(r => checklistFromRow(r as ChecklistRow));
      setChecklists(rows);

      // Fetch which checklists have at least one issue response
      if (rows.length > 0) {
        const ids = rows.map(r => r.id);
        const { data: issueData } = await supabase
          .from('checklist_responses')
          .select('checklist_id')
          .in('checklist_id', ids)
          .eq('status', 'issue');
        setIssueChecklistIds(new Set((issueData ?? []).map((r: { checklist_id: string }) => r.checklist_id)));
      }
    }

    setLoading(false);
  }, [user, currentClient.id, isDriver, isAuditor, isAssistantPlus]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const startChecklist = async (template: ChecklistTemplate, vehicleId?: string) => {
    if (!vehicleId) {
      console.error('Tentativa de iniciar checklist sem veículo associado.');
      return;
    }
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
    await fetchData();
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

  const filteredHistory = checklists.filter(c => {
    if (historyStatusFilter !== 'all' && c.status !== historyStatusFilter) return false;
    if (historySearch.trim()) {
      const q = historySearch.toLowerCase();
      if (!(c.templateName ?? '').toLowerCase().includes(q) && !(c.templateContext ?? '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const selectedVehicle = vehicles.find(v => v.id === selectedVehicleId);

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

      {/* ── Driver view ─────────────────────────────── */}
      {isDriver && (
        <>
          {openChecklist && (
            <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 flex items-center gap-4">
              <ClipboardCheck className="h-8 w-8 text-orange-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-orange-800">Checklist em andamento</p>
                <p className="text-xs text-orange-600 truncate">
                  {openChecklist.templateContext && <span className="font-medium">{openChecklist.templateContext} · </span>}
                  {openChecklist.templateName} — {formatDate(openChecklist.startedAt)}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => setConfirmDelete(openChecklist)}
                  className="flex items-center gap-1.5 px-3 py-2 border border-red-200 text-red-600 text-sm font-medium rounded-xl hover:bg-red-50"
                  title="Cancelar checklist em andamento"
                >
                  <Trash2 className="h-4 w-4" />
                  Cancelar
                </button>
                <button
                  onClick={() => navigate(`/checklists/preencher/${openChecklist.id}`)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-xl hover:bg-orange-600"
                >
                  <Play className="h-4 w-4" />
                  Continuar
                </button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-zinc-200 p-5">
            <h2 className="text-sm font-semibold text-zinc-700 mb-3 flex items-center gap-2">
              <Truck className="h-4 w-4 text-orange-500" />
              Meu veículo
            </h2>
            {vehicleInfo ? (
              <>
                <div className="mb-4">
                  <p className="font-semibold text-zinc-900">{vehicleInfo.plate}</p>
                  <p className="text-xs text-zinc-500">{vehicleInfo.category ?? 'Sem categoria'}</p>
                </div>
                {publishedTemplates.length > 0 ? (
                  <div className="space-y-2">
                    {publishedTemplates.map(t => (
                      <div key={t.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-zinc-100 hover:bg-zinc-50">
                        <div>
                          <p className="text-sm font-medium text-zinc-900">{t.name}</p>
                          <p className="text-xs text-zinc-500">{t.context}</p>
                        </div>
                        <button
                          disabled={!!openChecklist || starting === t.id}
                          onClick={() => startChecklist(t, vehicleInfo.id)}
                          className="flex items-center gap-1.5 px-3 py-2 bg-orange-500 text-white text-xs font-medium rounded-lg hover:bg-orange-600 disabled:opacity-50"
                        >
                          {starting === t.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                          Iniciar
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-400 italic">Nenhum template publicado para {vehicleInfo.category}</p>
                )}
              </>
            ) : (
              <p className="text-sm text-zinc-400 italic">Nenhum veículo associado ao seu perfil.</p>
            )}
          </div>

          {/* History */}
          <HistoryCard
            checklists={filteredHistory}
            historySearch={historySearch}
            setHistorySearch={setHistorySearch}
            historyStatusFilter={historyStatusFilter}
            setHistoryStatusFilter={setHistoryStatusFilter}
            onView={setViewChecklist}
            formatDate={formatDate}
          />
        </>
      )}

      {/* ── Auditor view ─────────────────────────────── */}
      {isAuditor && (
        <>
          {openChecklist && (
            <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 flex items-center gap-4">
              <ClipboardCheck className="h-8 w-8 text-orange-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-orange-800">Checklist em andamento</p>
                <p className="text-xs text-orange-600 truncate">
                  {openChecklist.templateContext && <span className="font-medium">{openChecklist.templateContext} · </span>}
                  {openChecklist.templateName} — {formatDate(openChecklist.startedAt)}
                </p>
              </div>
              <button
                onClick={() => navigate(`/checklists/preencher/${openChecklist.id}`)}
                className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-xl hover:bg-orange-600"
              >
                <Play className="h-4 w-4" />
                Continuar
              </button>
              <button
                onClick={() => setConfirmDelete(openChecklist)}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 border border-red-200 text-red-600 text-sm font-medium rounded-xl hover:bg-red-50"
                title="Cancelar checklist em andamento"
              >
                <Trash2 className="h-4 w-4" />
                Cancelar
              </button>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-zinc-200 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-zinc-700 flex items-center gap-2">
              <Truck className="h-4 w-4 text-orange-500" />
              Iniciar Auditoria
            </h2>

            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Selecionar veículo</label>
              <select
                value={selectedVehicleId}
                onChange={e => setSelectedVehicleId(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              >
                <option value="">— Selecione um veículo —</option>
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>{v.plate}{v.category ? ` (${v.category})` : ''}</option>
                ))}
              </select>
            </div>

            {selectedVehicle && (
              <div className="flex items-center gap-2 rounded-lg bg-zinc-50 border border-zinc-100 px-3 py-2">
                <User className="h-4 w-4 text-zinc-400 flex-shrink-0" />
                <span className="text-sm text-zinc-700">
                  Motorista: <strong>{selectedVehicle.driverName ?? 'Sem motorista'}</strong>
                </span>
              </div>
            )}

            {selectedVehicleId && auditorTemplates.length === 0 && (
              <p className="text-sm text-zinc-400 italic text-center py-2">
                Nenhum template de Auditoria publicado para {selectedVehicle?.category ?? 'esta categoria'}.
              </p>
            )}

            {auditorTemplates.length > 0 && (
              <div className="space-y-2">
                {auditorTemplates.map(t => (
                  <div key={t.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-zinc-100 hover:bg-zinc-50">
                    <div>
                      <p className="text-sm font-medium text-zinc-900">{t.name}</p>
                      <p className="text-xs text-zinc-500">{t.context}</p>
                    </div>
                    <button
                      disabled={!!openChecklist || starting === t.id}
                      onClick={() => startChecklist(t, selectedVehicleId)}
                      className="flex items-center gap-1.5 px-3 py-2 bg-orange-500 text-white text-xs font-medium rounded-lg hover:bg-orange-600 disabled:opacity-50"
                    >
                      {starting === t.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                      Iniciar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* History */}
          <HistoryCard
            checklists={filteredHistory}
            historySearch={historySearch}
            setHistorySearch={setHistorySearch}
            historyStatusFilter={historyStatusFilter}
            setHistoryStatusFilter={setHistoryStatusFilter}
            onView={setViewChecklist}
            formatDate={formatDate}
          />
        </>
      )}

      {/* ── Fleet Assistant+ view ─────────────────────────────── */}
      {isAssistantPlus && (
        <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
          {/* Filter bar */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-100">
            <button
              onClick={() => setOnlyWithIssues(false)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                !onlyWithIssues ? 'bg-zinc-700 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200',
              )}
            >
              Todos
            </button>
            <button
              onClick={() => setOnlyWithIssues(true)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                onlyWithIssues ? 'bg-red-500 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200',
              )}
            >
              <AlertCircle className="h-3 w-3" />
              Com inconformidades
              {issueChecklistIds.size > 0 && (
                <span className="opacity-70">({issueChecklistIds.size})</span>
              )}
            </button>
          </div>

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
                    {['Template', 'Contexto', 'Veículo', 'Preenchido por', 'Data', 'Status', 'Ações'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {checklists
                    .filter(c => !onlyWithIssues || issueChecklistIds.has(c.id))
                    .map(c => (
                    <tr key={c.id} className="hover:bg-zinc-50">
                      <td className="px-4 py-3 text-sm text-zinc-900">
                        <div className="flex items-center gap-1.5">
                          {issueChecklistIds.has(c.id) && (
                            <AlertCircle className="h-3.5 w-3.5 text-red-400 flex-shrink-0" title="Contém inconformidades" />
                          )}
                          {c.templateName ?? '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-500">{c.templateContext ?? '—'}</td>
                      <td className="px-4 py-3 text-sm text-zinc-600">{c.vehicleLicensePlate ?? '—'}</td>
                      <td className="px-4 py-3 text-sm text-zinc-600">{c.filledByName ?? '—'}</td>
                      <td className="px-4 py-3 text-xs text-zinc-500">{formatDate(c.startedAt)}</td>
                      <td className="px-4 py-3">
                        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', STATUS_COLOR[c.status])}>
                          {STATUS_LABEL[c.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => setViewChecklist(c)} className="p-1.5 rounded hover:bg-zinc-100" title="Visualizar">
                            <Eye className="h-4 w-4 text-zinc-400" />
                          </button>
                          {isAnalystPlus && c.status === 'completed' && issueChecklistIds.has(c.id) && (
                            <button
                              onClick={() => setCreatePlanChecklist(c)}
                              className="p-1.5 rounded hover:bg-orange-50 text-orange-400"
                              title="Criar Plano de Ação"
                            >
                              <ClipboardList className="h-4 w-4" />
                            </button>
                          )}
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

      {createPlanChecklist && (
        <CreateActionPlanModal
          checklist={createPlanChecklist}
          onClose={() => setCreatePlanChecklist(null)}
          onCreated={() => { setCreatePlanChecklist(null); }}
        />
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

// ─── HistoryCard component ──────────────────────────────────────────────────

interface HistoryCardProps {
  checklists: Checklist[];
  historySearch: string;
  setHistorySearch: (v: string) => void;
  historyStatusFilter: 'all' | 'in_progress' | 'completed';
  setHistoryStatusFilter: (v: 'all' | 'in_progress' | 'completed') => void;
  onView: (c: Checklist) => void;
  formatDate: (iso: string) => string;
}

function HistoryCard({ checklists, historySearch, setHistorySearch, historyStatusFilter, setHistoryStatusFilter, onView, formatDate }: HistoryCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-zinc-200 p-5">
      <h2 className="text-sm font-semibold text-zinc-700 mb-3">Histórico</h2>

      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
          <input
            type="text"
            value={historySearch}
            onChange={e => setHistorySearch(e.target.value)}
            placeholder="Buscar por template ou contexto..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>
        <div className="flex gap-1">
          {(['all', 'in_progress', 'completed'] as const).map(s => (
            <button
              key={s}
              onClick={() => setHistoryStatusFilter(s)}
              className={cn(
                'px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors',
                historyStatusFilter === s ? 'bg-zinc-700 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200',
              )}
            >
              {s === 'all' ? 'Todos' : s === 'in_progress' ? 'Em andamento' : 'Concluído'}
            </button>
          ))}
        </div>
      </div>

      {checklists.length === 0 ? (
        <p className="text-sm text-zinc-400 italic text-center py-4">Nenhum checklist encontrado.</p>
      ) : (
        <div className="space-y-2">
          {checklists.map(c => (
            <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl border border-zinc-100">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-900 truncate">{c.templateName}</p>
                <p className="text-xs text-zinc-500">{c.templateContext && `${c.templateContext} · `}{formatDate(c.startedAt)}</p>
              </div>
              <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0', STATUS_COLOR[c.status])}>
                {STATUS_LABEL[c.status]}
              </span>
              {c.status === 'completed' && (
                <button onClick={() => onView(c)} className="p-1.5 rounded-lg hover:bg-zinc-100 flex-shrink-0">
                  <Eye className="h-4 w-4 text-zinc-400" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
