import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, MinusCircle, Camera, ChevronLeft, Loader2, Lock, AlertTriangle, Building2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { checklistFromRow, type ChecklistRow } from '../lib/checklistMappers';
import { checklistItemFromRow, type ChecklistItemRow } from '../lib/checklistTemplateMappers';
import { uploadChecklistPhoto } from '../lib/checklistStorageHelpers';
import CameraCapture from '../components/CameraCapture';
import type { Checklist, ChecklistItem, ChecklistContext, ResponseStatus } from '../types';
import { WORKSHOP_CONTEXTS } from '../types';
import { cn } from '../lib/utils';

interface ItemState {
  item: ChecklistItem;
  status: ResponseStatus | null;
  observation: string;
  photoUrl: string;
  photoFile: File | null;
  photoLat?: number;
  photoLng?: number;
  uploading: boolean;
}

interface WorkshopOption {
  id: string;
  name: string;
}

export default function ChecklistFill() {
  const { checklistId } = useParams<{ checklistId: string }>();
  const { currentClient } = useAuth();
  const navigate = useNavigate();

  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [itemStates, setItemStates] = useState<ItemState[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [cameraItemIdx, setCameraItemIdx] = useState<number | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [templateContext, setTemplateContext] = useState<ChecklistContext | null>(null);
  // Workshop selection (for Entrada/Saída de Oficina)
  const [workshops, setWorkshops] = useState<WorkshopOption[]>([]);
  const [selectedWorkshopId, setSelectedWorkshopId] = useState<string>('');
  const [workshopSaved, setWorkshopSaved] = useState(false);

  const needsWorkshop = templateContext !== null && WORKSHOP_CONTEXTS.includes(templateContext as typeof WORKSHOP_CONTEXTS[number]);
  const workshopReady = !needsWorkshop || workshopSaved;

  const fetchData = useCallback(async () => {
    if (!checklistId) return;
    setLoading(true);

    const { data: chkData } = await supabase
      .from('checklists')
      .select('*, vehicles(license_plate), profiles(name), checklist_templates(name, context), workshops(name)')
      .eq('id', checklistId)
      .single();

    if (!chkData) { setError('Checklist não encontrado.'); setLoading(false); return; }

    const chk = checklistFromRow(chkData as ChecklistRow);
    setChecklist(chk);
    setTemplateName(chkData.checklist_templates?.name ?? 'Checklist');
    setTemplateContext((chkData.checklist_templates?.context as ChecklistContext) ?? null);

    // If workshop already saved in record
    if (chk.workshopId) {
      setSelectedWorkshopId(chk.workshopId);
      setWorkshopSaved(true);
    }

    // Fetch template config
    const { data: tplData } = await supabase
      .from('checklist_templates')
      .select('context')
      .eq('id', chk.templateId)
      .single();
    if (tplData) {
      const ctx = tplData.context as ChecklistContext;
      setTemplateContext(ctx);

      // Load workshops if needed
      if (WORKSHOP_CONTEXTS.includes(ctx as typeof WORKSHOP_CONTEXTS[number])) {
        const { data: wsData } = await supabase
          .from('workshops')
          .select('id, name')
          .eq('client_id', currentClient.id)
          .eq('active', true)
          .order('name');
        setWorkshops((wsData ?? []) as WorkshopOption[]);
      }
    }

    // Fetch items
    const { data: itemsData } = await supabase
      .from('checklist_items')
      .select('*')
      .eq('template_id', chk.templateId)
      .eq('version_number', chk.versionNumber)
      .order('order_number');

    const items = (itemsData ?? []).map(r => checklistItemFromRow(r as ChecklistItemRow));

    // Fetch existing responses
    const { data: respData } = await supabase
      .from('checklist_responses')
      .select('*')
      .eq('checklist_id', checklistId);

    const respMap = new Map((respData ?? []).map((r: Record<string, unknown>) => [r.item_id as string, r]));

    setItemStates(
      items.map(item => {
        const existing = respMap.get(item.id) as Record<string, unknown> | undefined;
        return {
          item,
          status: (existing?.status as ResponseStatus) ?? null,
          observation: (existing?.observation as string) ?? '',
          photoUrl: (existing?.photo_url as string) ?? '',
          photoFile: null,
          uploading: false,
        };
      }),
    );

    setLoading(false);
  }, [checklistId, currentClient.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleWorkshopConfirm = async () => {
    if (!selectedWorkshopId || !checklistId) return;
    await supabase
      .from('checklists')
      .update({ workshop_id: selectedWorkshopId })
      .eq('id', checklistId);
    setWorkshopSaved(true);
  };

  const updateItemState = (idx: number, patch: Partial<ItemState>) => {
    setItemStates(prev => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };

  const handleStatusChange = (idx: number, status: ResponseStatus) => {
    updateItemState(idx, { status });
    if (status !== 'issue') {
      saveResponse(idx, status, itemStates[idx].observation, itemStates[idx].photoUrl);
    }
  };

  const handlePhotoCapture = async (idx: number, file: File, lat?: number, lng?: number) => {
    setCameraItemIdx(null);
    updateItemState(idx, { photoFile: file, photoLat: lat, photoLng: lng, uploading: true });
    try {
      if (!checklist || !checklistId) return;
      const url = await uploadChecklistPhoto(currentClient.id, checklistId, itemStates[idx].item.id, file);
      updateItemState(idx, { photoUrl: url, uploading: false });
    } catch (err) {
      updateItemState(idx, { uploading: false });
      console.error('Upload error:', err);
    }
  };

  const saveResponse = async (idx: number, status: ResponseStatus, observation: string, photoUrl: string) => {
    if (!checklistId) return;
    const item = itemStates[idx].item;
    await supabase.from('checklist_responses').upsert({
      checklist_id: checklistId,
      item_id: item.id,
      status,
      observation: observation.trim() || null,
      photo_url: photoUrl || null,
      responded_at: new Date().toISOString(),
    }, { onConflict: 'checklist_id,item_id' });
  };

  const handleObservationBlur = (idx: number) => {
    const s = itemStates[idx];
    if (s.status) saveResponse(idx, s.status, s.observation, s.photoUrl);
  };

  const mandatoryAnswered = itemStates.filter(s => s.item.isMandatory).every(s => s.status !== null);
  const totalAnswered = itemStates.filter(s => s.status !== null).length;
  const progress = itemStates.length > 0 ? Math.round((totalAnswered / itemStates.length) * 100) : 0;

  const handleFinish = async () => {
    setError('');
    setSaving(true);
    try {
      const answeredItems = itemStates.filter(s => s.status !== null);
      for (const s of answeredItems) {
        await saveResponse(itemStates.indexOf(s), s.status!, s.observation, s.photoUrl);
      }

      const { error: chkErr } = await supabase
        .from('checklists')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', checklistId);
      if (chkErr) throw chkErr;

      navigate('/checklists');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao finalizar checklist');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (error && !checklist) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-zinc-50">
        <p className="text-red-600">{error}</p>
        <button onClick={() => navigate('/checklists')} className="text-orange-500 hover:underline text-sm">Voltar</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-white border-b border-zinc-200 px-4 py-3">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <button onClick={() => navigate('/checklists')} className="p-1.5 rounded-lg hover:bg-zinc-100">
              <ChevronLeft className="h-5 w-5 text-zinc-500" />
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-zinc-900 truncate">
                {templateContext && <span className="text-orange-500">{templateContext} · </span>}
                {templateName}
              </p>
              {checklist?.vehicleLicensePlate && (
                <p className="text-xs text-zinc-500">{checklist.vehicleLicensePlate}</p>
              )}
            </div>
            <span className="text-xs text-zinc-400 flex-shrink-0">{totalAnswered}/{itemStates.length}</span>
          </div>
          <div className="w-full h-1.5 bg-zinc-200 rounded-full">
            <div className="h-1.5 bg-orange-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      {/* Workshop selector (for Entrada/Saída de Oficina) */}
      {needsWorkshop && (
        <div className="px-4 py-4 max-w-2xl mx-auto w-full">
          <div className={cn(
            'rounded-2xl border p-4 space-y-3',
            workshopSaved ? 'bg-green-50 border-green-200' : 'bg-white border-orange-200',
          )}>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-orange-500 flex-shrink-0" />
              <p className="text-sm font-semibold text-zinc-800">
                {workshopSaved ? `Oficina: ${workshops.find(w => w.id === selectedWorkshopId)?.name ?? checklist?.workshopName ?? '—'}` : 'Selecione a oficina'}
              </p>
            </div>
            {!workshopSaved && (
              <>
                <select
                  value={selectedWorkshopId}
                  onChange={e => setSelectedWorkshopId(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                >
                  <option value="">— Selecione uma oficina —</option>
                  {workshops.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
                <button
                  disabled={!selectedWorkshopId}
                  onClick={handleWorkshopConfirm}
                  className="w-full py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 disabled:opacity-40"
                >
                  Confirmar oficina
                </button>
                <p className="text-xs text-zinc-500 text-center">Selecione a oficina para liberar os itens do checklist</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Items */}
      {workshopReady && (
        <div className="flex-1 px-4 py-4 max-w-2xl mx-auto w-full space-y-3">
          {itemStates.map((s, idx) => (
            <div
              key={s.item.id}
              className={cn(
                'bg-white rounded-2xl border p-4 space-y-3 transition-colors',
                s.status === 'ok' && 'border-green-300 bg-green-50/30',
                s.status === 'issue' && 'border-red-300 bg-red-50/30',
                s.status === 'not_applicable' && 'border-zinc-300 bg-zinc-50/30',
                !s.status && 'border-zinc-200',
              )}
            >
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <p className="text-sm font-medium text-zinc-900">
                    {idx + 1}. {s.item.title}
                    {s.item.isMandatory && (
                      <Lock className="inline ml-1 h-3 w-3 text-zinc-400" title="Obrigatório" />
                    )}
                    {s.item.canBlockVehicle && (
                      <span className="inline ml-1.5 text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-medium">⚠ Bloqueio</span>
                    )}
                  </p>
                  {s.item.description && (
                    <p className="text-xs text-zinc-500 mt-0.5">{s.item.description}</p>
                  )}
                  {s.item.canBlockVehicle && (
                    <p className="text-xs text-red-500 mt-0.5">Este item pode bloquear o veículo se reprovado</p>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                {(
                  [
                    { val: 'ok', label: 'OK', Icon: CheckCircle, active: 'bg-green-500 text-white border-green-500', inactive: 'border-zinc-200 text-zinc-500 hover:border-green-400 hover:text-green-600' },
                    { val: 'issue', label: 'Problema', Icon: XCircle, active: 'bg-red-500 text-white border-red-500', inactive: 'border-zinc-200 text-zinc-500 hover:border-red-400 hover:text-red-600' },
                    { val: 'not_applicable', label: 'N/A', Icon: MinusCircle, active: 'bg-zinc-400 text-white border-zinc-400', inactive: 'border-zinc-200 text-zinc-400 hover:border-zinc-400' },
                  ] as const
                ).map(({ val, label, Icon, active, inactive }) => (
                  <button
                    key={val}
                    onClick={() => handleStatusChange(idx, val)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium flex-1 justify-center min-h-[44px] transition-colors',
                      s.status === val ? active : inactive,
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{label}</span>
                  </button>
                ))}
              </div>

              {s.status === 'issue' && (
                <div className="space-y-2">
                  <textarea
                    value={s.observation}
                    onChange={e => updateItemState(idx, { observation: e.target.value })}
                    onBlur={() => handleObservationBlur(idx)}
                    placeholder="Descreva o problema observado..."
                    rows={2}
                    className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
                  />

                  {s.item.canBlockVehicle && (
                    <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
                      <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
                      <p className="text-xs text-red-700">Item crítico de segurança — será registrado para alerta de bloqueio</p>
                    </div>
                  )}

                  {s.photoUrl ? (
                    <div className="flex items-center gap-2">
                      <img src={s.photoUrl} alt="foto" className="h-16 w-16 rounded-lg object-cover" />
                      <button onClick={() => setCameraItemIdx(idx)} className="text-xs text-orange-500 hover:underline">Refazer foto</button>
                      {s.item.requirePhotoIfIssue && (
                        <span className="text-xs text-green-600 font-medium">✓ Foto registrada</span>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => setCameraItemIdx(idx)}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-colors',
                        s.item.requirePhotoIfIssue
                          ? 'border-red-400 text-red-600 bg-red-50 hover:bg-red-100'
                          : 'border-zinc-300 text-zinc-600 hover:bg-zinc-50',
                      )}
                    >
                      {s.uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                      {s.item.requirePhotoIfIssue ? 'Foto obrigatória' : 'Tirar foto'}
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Bottom bar */}
      <div className="sticky bottom-0 bg-white border-t border-zinc-200 px-4 py-3">
        <div className="max-w-2xl mx-auto space-y-2">
          {error && <p className="text-sm text-red-600 text-center">{error}</p>}
          {!workshopReady && (
            <p className="text-xs text-amber-600 text-center">Selecione e confirme a oficina para liberar o checklist</p>
          )}
          {workshopReady && !mandatoryAnswered && (
            <p className="text-xs text-amber-600 text-center">Responda todos os itens obrigatórios para finalizar</p>
          )}
          <button
            onClick={handleFinish}
            disabled={!mandatoryAnswered || saving || !workshopReady}
            className="w-full py-3 rounded-xl bg-orange-500 text-white font-semibold text-sm disabled:opacity-40 hover:bg-orange-600 transition-colors flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? 'Finalizando...' : 'Finalizar Checklist'}
          </button>
        </div>
      </div>

      {cameraItemIdx !== null && (
        <CameraCapture
          onClose={() => setCameraItemIdx(null)}
          onCapture={(file, lat, lng) => handlePhotoCapture(cameraItemIdx, file, lat, lng)}
        />
      )}
    </div>
  );
}
