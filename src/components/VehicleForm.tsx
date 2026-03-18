import React, { useState, useEffect } from 'react';
import { Vehicle, VehicleFieldSettings } from '../types';
import { X, FileText, ExternalLink, Loader2 } from 'lucide-react';
import { validateFile } from '../lib/storageHelpers';
import { isFieldRequired } from '../lib/fieldSettingsMappers';
import {
  filterDigitsOnly,
  filterNumericComma,
  filterText,
  filterPlate,
  filterAlpha,
  filterAlphanumeric,
} from '../lib/inputHelpers';
import { extractCrlvData, ExtractionStatus, ExtractionResult } from '../lib/documentOcr';

interface VehicleFormFiles {
  crlv: File | null;
  sanitaryInspection: File | null;
  gr: File | null;
  insurancePolicy: File | null;
  maintenanceContract: File | null;
}

interface AvailableDriver {
  id: string;
  name: string;
  cpf: string;
}

interface AvailableShipper {
  id: string;
  name: string;
}

interface AvailableOperationalUnit {
  id: string;
  name: string;
  shipperId: string;
}

interface VehicleFormProps {
  vehicle: Vehicle | null;
  fieldSettings: VehicleFieldSettings | null;
  availableDrivers: AvailableDriver[];
  availableShippers: AvailableShipper[];
  availableOperationalUnits: AvailableOperationalUnit[];
  onClose: () => void;
  onSave: (vehicle: Partial<Vehicle>, files: VehicleFormFiles) => Promise<void>;
}

const formatCPF = (cpf: string) =>
  cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');

// Mapa de filtros por nome de campo
const FIELD_FILTERS: Record<string, (v: string) => string> = {
  licensePlate: filterPlate,
  brand: filterText,
  model: filterText,
  year: filterDigitsOnly,
  color: filterText,
  renavam: filterDigitsOnly,
  chassi: (v) => filterAlphanumeric(v, 17),
  detranUF: (v) => filterAlpha(v, 2),
  owner: filterText,
  fipePrice: filterNumericComma,
  tracker: filterText,
  antt: filterDigitsOnly,
  crlvYear: filterDigitsOnly,
  autonomy: filterNumericComma,
  fuelType: filterText,
  tankCapacity: filterNumericComma,
  avgConsumption: filterNumericComma,
  coolingBrand: filterText,
  placaSemiReboque: filterPlate,
  tag: (v) => filterAlphanumeric(v, 20),
  pbt: filterNumericComma,
  cmt: filterNumericComma,
  eixos: filterDigitsOnly,
  firstRevisionMaxKm: filterDigitsOnly,
};

export default function VehicleForm({ vehicle, fieldSettings, availableDrivers, availableShippers, availableOperationalUnits, onClose, onSave }: VehicleFormProps) {
  const [formData, setFormData] = useState<Partial<Vehicle>>(() => {
    try {
      const savedData = sessionStorage.getItem('vehicleFormData');
      if (savedData) {
        return JSON.parse(savedData);
      }
    } catch (e) {
      console.error('Failed to parse vehicleFormData from sessionStorage', e);
    }

    return {
      type: 'Passeio',
      energySource: 'Combustão',
      coolingEquipment: false,
      acquisition: 'Owned',
      spareKey: false,
      vehicleManual: false,
      warranty: false,
      hasInsurance: false,
      hasMaintenanceContract: false,
      ...vehicle,
    };
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCrlvFile, setSelectedCrlvFile] = useState<File | null>(null);
  const [crlvExtractionStatus, setCrlvExtractionStatus] = useState<ExtractionStatus>('idle');
  const [crlvExtractionResult, setCrlvExtractionResult] = useState<ExtractionResult<Vehicle> | null>(null);
  const [selectedSanitaryFile, setSelectedSanitaryFile] = useState<File | null>(null);
  const [selectedGRFile, setSelectedGRFile] = useState<File | null>(null);
  const [selectedInsurancePolicyFile, setSelectedInsurancePolicyFile] = useState<File | null>(null);
  const [selectedMaintenanceContractFile, setSelectedMaintenanceContractFile] = useState<File | null>(null);

  // Helper: retorna true se o campo é obrigatório (default: true quando settings é null)
  const req = (name: string) => fieldSettings ? isFieldRequired(name, fieldSettings) : true;

  useEffect(() => {
    if (vehicle) {
      setFormData(prev => ({
        ...prev,
        ...vehicle
      }));
    }
    setError(null);
  }, [vehicle]);

  useEffect(() => {
    sessionStorage.setItem('vehicleFormData', JSON.stringify(formData));
  }, [formData]);

  const CATEGORY_TYPES_MAP = {
    'Leve': ['Moto', 'Passeio', 'Utilitário'],
    'Médio': ['Van', 'Vuc', 'Toco'],
    'Pesado': ['Truck', 'Cavalo'],
    'Elétrico': ['Passeio', 'Utilitário'] // Adicionado por coerência com os tipos existentes
  } as const;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type: inputType } = e.target;

    if (inputType === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else if (name === 'driverId') {
      // Valida se o motorista está na lista de disponíveis do cliente atual
      // (a query em Vehicles.tsx já filtra por client_id)
      if (value) {
        const isCurrentDriver = vehicle?.driverId === value;
        const isAvailable = availableDrivers.some(d => d.id === value);
        // Permite manter o motorista atual ou selecionar um da lista de disponíveis do cliente
        if (!isCurrentDriver && !isAvailable) {
          setError('Este motorista não está disponível para este cliente.');
          return;
        }
      }
      setError(null);
      setFormData(prev => ({ ...prev, driverId: value || undefined }));
    } else if (name === 'shipperId') {
      setFormData(prev => ({ ...prev, shipperId: value || undefined, operationalUnitId: undefined }));
    } else if (name === 'operationalUnitId') {
      setFormData(prev => ({ ...prev, operationalUnitId: value || undefined }));
    } else if (name === 'category') {
      const newCategory = value as keyof typeof CATEGORY_TYPES_MAP | '';
      setFormData(prev => {
        const newData = { ...prev, [name]: value };
        // Se mudou para uma categoria que tem tipos definidos e o tipo atual não é compatível,
        // seleciona o primeiro tipo da nova categoria.
        if (newCategory && CATEGORY_TYPES_MAP[newCategory]) {
          const allowedTypes = CATEGORY_TYPES_MAP[newCategory];
          if (!prev.type || !(allowedTypes as readonly string[]).includes(prev.type)) {
            newData.type = allowedTypes[0] as any;
          }
        }
        return newData;
      });
    } else {
      const filter = FIELD_FILTERS[name];
      const filtered = filter ? filter(value) : value;
      setFormData(prev => ({ ...prev, [name]: filtered }));
    }
  };

  const makeFileHandler = (setter: React.Dispatch<React.SetStateAction<File | null>>) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0] ?? null;
      if (!file) {
        setter(null);
        return;
      }
      try {
        validateFile(file);
        setter(file);
        setError(null);
      } catch (err: unknown) {
        setter(null);
        setError((err as Error).message);
        e.target.value = '';
      }
    };

  const handleCrlvFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) {
      setSelectedCrlvFile(null);
      return;
    }
    try {
      validateFile(file);
      setSelectedCrlvFile(file);
      setError(null);
      setCrlvExtractionStatus('extracting');
      setCrlvExtractionResult(null);
      const result = await extractCrlvData(file);
      setCrlvExtractionResult(result);
      if (result.fieldCount === 0) {
        setCrlvExtractionStatus('failed');
      } else if (result.fieldCount < result.totalFields) {
        setCrlvExtractionStatus('partial');
      } else {
        setCrlvExtractionStatus('success');
      }
      if (result.fieldCount > 0) {
        setFormData(prev => {
          const merged = { ...prev };
          for (const [key, value] of Object.entries(result.data)) {
            if (value != null && value !== '') {
              // Em criação: preenche tudo. Em edição: só preenche campos vazios.
              if (!vehicle || !prev[key as keyof Vehicle]) {
                (merged as Record<string, unknown>)[key] = value;
              }
            }
          }
          return merged;
        });
      }
    } catch (err: unknown) {
      setSelectedCrlvFile(null);
      setError((err as Error).message);
      e.target.value = '';
    }
  };
  const handleSanitaryFileChange = makeFileHandler(setSelectedSanitaryFile);
  const handleGRFileChange = makeFileHandler(setSelectedGRFile);
  const handleInsurancePolicyFileChange = makeFileHandler(setSelectedInsurancePolicyFile);
  const handleMaintenanceContractFileChange = makeFileHandler(setSelectedMaintenanceContractFile);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    // Validação programática de uploads obrigatórios
    if (req('crlvUpload') && !selectedCrlvFile && !formData.crlvUpload) {
      setError('O documento CRLV é obrigatório.');
      setSaving(false);
      return;
    }
    if (req('sanitaryInspectionUpload') && !selectedSanitaryFile && !formData.sanitaryInspectionUpload) {
      setError('O documento de Inspeção Sanitária é obrigatório.');
      setSaving(false);
      return;
    }
    if (req('grUpload') && !selectedGRFile && !formData.grUpload) {
      setError('O documento GR é obrigatório.');
      setSaving(false);
      return;
    }
    if (formData.hasInsurance && req('insurancePolicyUpload') && !selectedInsurancePolicyFile && !formData.insurancePolicyUpload) {
      setError('A apólice de seguro é obrigatória quando o veículo possui seguro.');
      setSaving(false);
      return;
    }
    if (formData.hasMaintenanceContract && req('maintenanceContractUpload') && !selectedMaintenanceContractFile && !formData.maintenanceContractUpload) {
      setError('O contrato de manutenção é obrigatório quando o veículo possui contrato.');
      setSaving(false);
      return;
    }

    try {
      await onSave(formData, {
        crlv: selectedCrlvFile,
        sanitaryInspection: selectedSanitaryFile,
        gr: selectedGRFile,
        insurancePolicy: selectedInsurancePolicyFile,
        maintenanceContract: selectedMaintenanceContractFile,
      });
    } catch (err: unknown) {
      const pgError = err as { code?: string; message?: string };
      if (pgError?.code === '23505') {
        // Erro 23505 = unique violation — pode ser placa ou motorista deste cliente
        const msg = pgError.message ?? '';
        if (msg.includes('idx_vehicles_client_driver_unique') || msg.includes('driver_id')) {
          setError('Este motorista já está vinculado a outro veículo neste cliente. Selecione um motorista diferente.');
        } else if (msg.includes('license_plate')) {
          setError('Esta placa já está cadastrada para este cliente.');
        } else {
          setError('Este valor já está cadastrado para este cliente. Verifique placa e motorista.');
        }
      } else {
        setError((err as Error).message ?? 'Erro ao salvar veículo. Tente novamente.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    sessionStorage.removeItem('vehicleFormOpen');
    sessionStorage.removeItem('vehicleFormEditing');
    sessionStorage.removeItem('vehicleFormData');
    onClose();
  };

  const inputClass = "mt-1 block w-full rounded-xl border border-zinc-300 py-2 px-3 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:text-sm";
  const fileInputClass = "mt-1 block w-full text-sm text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100";

  // Label com asterisco vermelho para campos obrigatórios
  const Label = ({ name, children }: { name: string; children: React.ReactNode }) => (
    <label className="block text-sm font-medium text-zinc-700">
      {children}{req(name) && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );

  const FilePreview = ({ url, selectedFile, label }: { url?: string; selectedFile: File | null; label: string }) => (
    <>
      {url && !selectedFile && (
        <div className="mt-2 mb-2 flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
          <FileText className="h-4 w-4 text-zinc-400 flex-shrink-0" />
          <span className="flex-1 truncate">{label}</span>
          <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium">
            Visualizar <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}
      {selectedFile && (
        <p className="mt-1 text-xs text-emerald-600 font-medium">
          ✓ {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
          {selectedFile.type.startsWith('image/') ? ' — será comprimida antes do upload' : ''}
        </p>
      )}
    </>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 sm:p-6 overflow-y-auto" role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-full flex flex-col my-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
          <h2 className="text-xl font-semibold text-zinc-900">
            {vehicle ? 'Editar Veículo' : 'Cadastrar Veículo'}
          </h2>
          <button onClick={handleClose} className="text-zinc-400 hover:text-zinc-500 transition-colors">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form id="vehicle-form" onSubmit={handleSubmit} className="space-y-8">
            {/* Basic Info */}
            <div>
              <h3 className="text-lg font-medium leading-6 text-zinc-900 border-b border-zinc-200 pb-2 mb-4">Informações Básicas</h3>
              <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-zinc-700">Placa<span className="text-red-500 ml-0.5">*</span></label>
                  <input type="text" name="licensePlate" required inputMode="text" value={formData.licensePlate || ''} onChange={handleChange} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700">Marca<span className="text-red-500 ml-0.5">*</span></label>
                  <input type="text" name="brand" required value={formData.brand || ''} onChange={handleChange} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700">Modelo<span className="text-red-500 ml-0.5">*</span></label>
                  <input type="text" name="model" required value={formData.model || ''} onChange={handleChange} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700">Ano<span className="text-red-500 ml-0.5">*</span></label>
                  <input type="text" name="year" required inputMode="numeric" maxLength={4} value={formData.year || ''} onChange={handleChange} className={inputClass} />
                </div>
                <div>
                  <Label name="color">Cor</Label>
                  <input type="text" name="color" required={req('color')} value={formData.color || ''} onChange={handleChange} className={inputClass} />
                </div>
                <div>
                  <Label name="renavam">Renavam</Label>
                  <input type="text" name="renavam" required={req('renavam')} inputMode="numeric" value={formData.renavam || ''} onChange={handleChange} className={inputClass} />
                </div>
                <div>
                  <Label name="chassi">Chassi</Label>
                  <input type="text" name="chassi" required={req('chassi')} value={formData.chassi || ''} onChange={handleChange} className={inputClass} />
                </div>
                <div>
                  <Label name="detranUF">Detran (UF)</Label>
                  <input type="text" name="detranUF" required={req('detranUF')} maxLength={2} value={formData.detranUF || ''} onChange={handleChange} className={inputClass} />
                </div>
              </div>
            </div>

            {/* Ownership & Tracking */}
            <div>
              <h3 className="text-lg font-medium leading-6 text-zinc-900 border-b border-zinc-200 pb-2 mb-4">Propriedade & Rastreamento</h3>
              <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-zinc-700">Aquisição<span className="text-red-500 ml-0.5">*</span></label>
                  <select name="acquisition" value={formData.acquisition || 'Owned'} onChange={handleChange} className={inputClass}>
                    <option value="Owned">Próprio</option>
                    <option value="Rented">Locado</option>
                    <option value="Agregado">Agregado</option>
                  </select>
                </div>
                <div>
                  <Label name="vehicleUsage">Finalidade</Label>
                  <select name="vehicleUsage" required={req('vehicleUsage')} value={formData.vehicleUsage || ''} onChange={handleChange} className={inputClass}>
                    <option value="">Selecione...</option>
                    <option value="Operação">Operação</option>
                    <option value="Uso Administrativo">Uso Administrativo</option>
                    <option value="Uso por Lideranças">Uso por Lideranças</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>
                <div>
                  <Label name="acquisitionDate">Data de Aquisição</Label>
                  <input type="date" name="acquisitionDate" required={req('acquisitionDate')} value={formData.acquisitionDate || ''} onChange={handleChange} className={inputClass} />
                </div>
                <div>
                  <Label name="owner">Proprietário</Label>
                  <input type="text" name="owner" required={req('owner')} value={formData.owner || ''} onChange={handleChange} className={inputClass} />
                </div>
                <div>
                  <Label name="fipePrice">Preço FIPE (R$)</Label>
                  <input type="text" name="fipePrice" required={req('fipePrice')} inputMode="decimal" value={formData.fipePrice || ''} onChange={handleChange} className={inputClass} />
                </div>
                <div>
                  <Label name="tracker">Rastreador</Label>
                  <input type="text" name="tracker" required={req('tracker')} value={formData.tracker || ''} onChange={handleChange} className={inputClass} />
                </div>
                <div>
                  <Label name="antt">ANTT</Label>
                  <input type="text" name="antt" required={req('antt')} inputMode="numeric" value={formData.antt || ''} onChange={handleChange} className={inputClass} />
                </div>
                <div>
                  <Label name="autonomy">Autonomia (km)</Label>
                  <input type="text" name="autonomy" required={req('autonomy')} inputMode="decimal" value={formData.autonomy || ''} onChange={handleChange} className={inputClass} />
                </div>
                <div>
                  <Label name="tag">Tag (Sem Parar)</Label>
                  <input type="text" name="tag" required={req('tag')} value={formData.tag || ''} onChange={handleChange} className={inputClass} placeholder="Código do dispositivo" />
                </div>

                <div>
                  <Label name="crlvYear">Exercício CRLV</Label>
                  <input type="text" name="crlvYear" required={req('crlvYear')} inputMode="numeric" maxLength={4} placeholder="Ex: 2025" value={formData.crlvYear || ''} onChange={handleChange} className={inputClass} />
                </div>

                {/* CRLV Upload */}
                <div className="sm:col-span-2">
                  <Label name="crlvUpload">CRLV — Documento do Veículo</Label>
                  <FilePreview url={formData.crlvUpload} selectedFile={selectedCrlvFile} label="Documento atual" />
                  <input
                    type="file"
                    name="crlvUpload"
                    accept="application/pdf,image/jpeg,image/png,image/webp"
                    onChange={handleCrlvFileChange}
                    className={fileInputClass}
                  />
                  <p className="mt-1 text-xs text-zinc-400">
                    Formatos aceitos: PDF, JPG, PNG, WEBP. Máximo 10MB.
                    {formData.crlvUpload ? ' Selecionar um novo arquivo irá substituir o atual.' : ''}
                  </p>
                  {crlvExtractionStatus === 'extracting' && (
                    <div className="mt-2 flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
                      <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
                      Extraindo dados do documento…
                    </div>
                  )}
                  {crlvExtractionStatus === 'success' && crlvExtractionResult && (
                    <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                      {crlvExtractionResult.fieldCount} campos preenchidos automaticamente via{' '}
                      {crlvExtractionResult.method === 'regex' ? 'leitura direta' : 'IA'}. Confira os valores e ajuste se necessário.
                    </div>
                  )}
                  {crlvExtractionStatus === 'partial' && crlvExtractionResult && (
                    <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                      {crlvExtractionResult.fieldCount}/{crlvExtractionResult.totalFields} campos extraídos via{' '}
                      {crlvExtractionResult.method === 'regex' ? 'leitura direta' : 'IA'}.
                      {crlvExtractionResult.warnings.length > 0 && (
                        <span className="block mt-0.5 text-xs">
                          Não encontrados: {crlvExtractionResult.warnings.join(', ')}
                        </span>
                      )}
                    </div>
                  )}
                  {crlvExtractionStatus === 'failed' && (
                    <div className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      Não foi possível extrair dados do documento. Preencha os campos manualmente.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Documentos & Acessórios */}
            <div>
              <h3 className="text-lg font-medium leading-6 text-zinc-900 border-b border-zinc-200 pb-2 mb-4">Documentos & Acessórios</h3>
              <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
                <div>
                  <Label name="category">Categoria</Label>
                  <select name="category" required={req('category')} value={formData.category || ''} onChange={handleChange} className={inputClass}>
                    <option value="">Selecione...</option>
                    <option value="Leve">Leve</option>
                    <option value="Médio">Médio</option>
                    <option value="Pesado">Pesado</option>
                  </select>
                </div>

                <div className="flex flex-col gap-4 justify-center">
                  <div className="flex items-center gap-2">
                    <input id="spareKey" name="spareKey" type="checkbox" checked={formData.spareKey || false} onChange={handleChange} className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-600" />
                    <label htmlFor="spareKey" className="text-sm text-zinc-900">Chave reserva</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input id="vehicleManual" name="vehicleManual" type="checkbox" checked={formData.vehicleManual || false} onChange={handleChange} className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-600" />
                    <label htmlFor="vehicleManual" className="text-sm text-zinc-900">Manual do veículo</label>
                  </div>
                </div>

                {/* Inspeção Sanitária Upload */}
                <div className="sm:col-span-2">
                  <Label name="sanitaryInspectionUpload">Inspeção Sanitária</Label>
                  <FilePreview url={formData.sanitaryInspectionUpload} selectedFile={selectedSanitaryFile} label="Documento atual" />
                  <input
                    type="file"
                    accept="application/pdf,image/jpeg,image/png,image/webp"
                    onChange={handleSanitaryFileChange}
                    className={fileInputClass}
                  />
                  <p className="mt-1 text-xs text-zinc-400">
                    Formatos aceitos: PDF, JPG, PNG, WEBP. Máximo 10MB.
                    {formData.sanitaryInspectionUpload ? ' Selecionar um novo arquivo irá substituir o atual.' : ''}
                  </p>
                </div>

                {/* GR Upload + Data Vencimento */}
                <div className="sm:col-span-2">
                  <Label name="grUpload">GR — Gerenciamento de Risco</Label>
                  <FilePreview url={formData.grUpload} selectedFile={selectedGRFile} label="Documento atual" />
                  <input
                    type="file"
                    accept="application/pdf,image/jpeg,image/png,image/webp"
                    onChange={handleGRFileChange}
                    className={fileInputClass}
                  />
                  <p className="mt-1 text-xs text-zinc-400">
                    Formatos aceitos: PDF, JPG, PNG, WEBP. Máximo 10MB.
                    {formData.grUpload ? ' Selecionar um novo arquivo irá substituir o atual.' : ''}
                  </p>
                </div>
                <div>
                  <Label name="grExpirationDate">Vencimento do GR</Label>
                  <input type="date" name="grExpirationDate" required={req('grExpirationDate')} value={formData.grExpirationDate || ''} onChange={handleChange} className={inputClass} />
                </div>
              </div>
            </div>

            {/* Technical Specs & Conditional Logic */}
            <div>
              <h3 className="text-lg font-medium leading-6 text-zinc-900 border-b border-zinc-200 pb-2 mb-4">Especificações Técnicas</h3>
              <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-zinc-700">Tipo<span className="text-red-500 ml-0.5">*</span></label>
                  <select name="type" value={formData.type || 'Passeio'} onChange={handleChange} className={inputClass}>
                    {formData.category && CATEGORY_TYPES_MAP[formData.category as keyof typeof CATEGORY_TYPES_MAP] ? (
                      CATEGORY_TYPES_MAP[formData.category as keyof typeof CATEGORY_TYPES_MAP].map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))
                    ) : (
                      <>
                        <option value="Passeio">Passeio</option>
                        <option value="Utilitário">Utilitário</option>
                        <option value="Van">Van</option>
                        <option value="Moto">Moto</option>
                        <option value="Vuc">Vuc</option>
                        <option value="Toco">Toco</option>
                        <option value="Truck">Truck</option>
                        <option value="Cavalo">Cavalo</option>
                      </>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700">Fonte de Energia<span className="text-red-500 ml-0.5">*</span></label>
                  <select name="energySource" value={formData.energySource || 'Combustão'} onChange={handleChange} className={inputClass}>
                    <option value="Combustão">Combustão</option>
                    <option value="Elétrico">Elétrico</option>
                    <option value="Híbrido">Híbrido</option>
                  </select>
                </div>

                {/* PBT / CMT / Eixos */}
                <div>
                  <Label name="pbt">PBT — Peso Bruto Total (t)</Label>
                  <input type="text" name="pbt" required={req('pbt')} inputMode="decimal" value={formData.pbt ?? ''} onChange={handleChange} className={inputClass} placeholder="Ex: 3,5" />
                </div>
                <div>
                  <Label name="cmt">CMT — Cap. Máxima de Tração (t)</Label>
                  <input type="text" name="cmt" required={req('cmt')} inputMode="decimal" value={formData.cmt ?? ''} onChange={handleChange} className={inputClass} placeholder="Ex: 45,0" />
                </div>
                <div>
                  <Label name="eixos">Eixos</Label>
                  <input type="text" name="eixos" required={req('eixos')} inputMode="numeric" maxLength={2} value={formData.eixos ?? ''} onChange={handleChange} className={inputClass} placeholder="Ex: 2" />
                </div>

                {/* Conditional: Cavalo */}
                {formData.type === 'Cavalo' && (
                  <>
                    <div className="flex items-center h-full pt-6">
                      <input id="semiReboque" name="semiReboque" type="checkbox" checked={formData.semiReboque || false} onChange={handleChange} className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-600" />
                      <label htmlFor="semiReboque" className="ml-2 block text-sm text-zinc-900">Possui Semi-reboque?</label>
                    </div>
                    {formData.semiReboque && (
                      <div>
                        <Label name="placaSemiReboque">Placa Semi-Reboque</Label>
                        <input type="text" name="placaSemiReboque" required={req('placaSemiReboque')} value={formData.placaSemiReboque || ''} onChange={handleChange} className={inputClass} />
                      </div>
                    )}
                  </>
                )}

                {/* Conditional: Combustão */}
                {formData.energySource === 'Combustão' && (
                  <>
                    <div>
                      <Label name="fuelType">Tipo de Combustível</Label>
                      <input type="text" name="fuelType" required={req('fuelType')} value={formData.fuelType || ''} onChange={handleChange} className={inputClass} />
                    </div>
                    <div>
                      <Label name="tankCapacity">Capacidade do Tanque (L)</Label>
                      <input type="text" name="tankCapacity" required={req('tankCapacity')} inputMode="decimal" value={formData.tankCapacity || ''} onChange={handleChange} className={inputClass} />
                    </div>
                    <div>
                      <Label name="avgConsumption">Consumo Médio (Km/L)</Label>
                      <input type="text" name="avgConsumption" required={req('avgConsumption')} inputMode="decimal" value={formData.avgConsumption || ''} onChange={handleChange} className={inputClass} />
                    </div>
                  </>
                )}

                <div className="flex items-center h-full pt-6">
                  <input id="coolingEquipment" name="coolingEquipment" type="checkbox" checked={formData.coolingEquipment || false} onChange={handleChange} className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-600" />
                  <label htmlFor="coolingEquipment" className="ml-2 block text-sm text-zinc-900">Equipamento de Refrigeração?</label>
                </div>
                {formData.coolingEquipment && (
                  <>
                    <div>
                      <Label name="coolingBrand">Marca/Modelo do Refrigerador</Label>
                      <input type="text" name="coolingBrand" placeholder="Ex: Termoking, Thermo Star" required={req('coolingBrand')} value={formData.coolingBrand || ''} onChange={handleChange} className={inputClass} />
                    </div>
                    <div>
                      <Label name="coolingFirstRevisionDeadline">Data Limite da 1ª Revisão do Refrigerador</Label>
                      <input type="date" name="coolingFirstRevisionDeadline" required={req('coolingFirstRevisionDeadline')} value={formData.coolingFirstRevisionDeadline || ''} onChange={handleChange} className={inputClass} />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Garantia & Revisões */}
            <div>
              <h3 className="text-lg font-medium leading-6 text-zinc-900 border-b border-zinc-200 pb-2 mb-4">Garantia & Revisões</h3>
              <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
                <div className="flex items-center h-full pt-6">
                  <input id="warranty" name="warranty" type="checkbox" checked={formData.warranty || false} onChange={handleChange} className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-600" />
                  <label htmlFor="warranty" className="ml-2 block text-sm text-zinc-900">Veículo em garantia?</label>
                </div>
                {formData.warranty && (
                  <div>
                    <Label name="warrantyEndDate">Data Final da Garantia</Label>
                    <input type="date" name="warrantyEndDate" required={req('warrantyEndDate')} value={formData.warrantyEndDate || ''} onChange={handleChange} className={inputClass} />
                  </div>
                )}
                <div>
                  <Label name="firstRevisionMaxKm">Km Máximo da 1ª Revisão</Label>
                  <input type="text" name="firstRevisionMaxKm" required={req('firstRevisionMaxKm')} inputMode="numeric" value={formData.firstRevisionMaxKm ?? ''} onChange={handleChange} className={inputClass} placeholder="Ex: 10000" />
                </div>
                <div>
                  <Label name="firstRevisionDeadline">Data Limite da 1ª Revisão</Label>
                  <input type="date" name="firstRevisionDeadline" required={req('firstRevisionDeadline')} value={formData.firstRevisionDeadline || ''} onChange={handleChange} className={inputClass} />
                </div>
              </div>
            </div>

            {/* Seguro & Contrato de Manutenção */}
            <div>
              <h3 className="text-lg font-medium leading-6 text-zinc-900 border-b border-zinc-200 pb-2 mb-4">Seguro & Contrato de Manutenção</h3>
              <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
                <div className="flex items-center h-full pt-2">
                  <input id="hasInsurance" name="hasInsurance" type="checkbox" checked={formData.hasInsurance || false} onChange={handleChange} className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-600" />
                  <label htmlFor="hasInsurance" className="ml-2 block text-sm text-zinc-900">Veículo possui seguro?</label>
                </div>
                {formData.hasInsurance && (
                  <div className="sm:col-span-2">
                    <Label name="insurancePolicyUpload">Apólice de Seguro</Label>
                    <FilePreview url={formData.insurancePolicyUpload} selectedFile={selectedInsurancePolicyFile} label="Apólice atual" />
                    <input
                      type="file"
                      name="insurancePolicyUpload"
                      accept="application/pdf,image/jpeg,image/png,image/webp"
                      onChange={handleInsurancePolicyFileChange}
                      className={fileInputClass}
                    />
                    <p className="mt-1 text-xs text-zinc-400">
                      Formatos aceitos: PDF, JPG, PNG, WEBP. Máximo 10MB.
                      {formData.insurancePolicyUpload ? ' Selecionar um novo arquivo irá substituir o atual.' : ''}
                    </p>
                  </div>
                )}
                <div className="flex items-center h-full pt-2">
                  <input id="hasMaintenanceContract" name="hasMaintenanceContract" type="checkbox" checked={formData.hasMaintenanceContract || false} onChange={handleChange} className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-600" />
                  <label htmlFor="hasMaintenanceContract" className="ml-2 block text-sm text-zinc-900">Veículo possui contrato de manutenção?</label>
                </div>
                {formData.hasMaintenanceContract && (
                  <div className="sm:col-span-2">
                    <Label name="maintenanceContractUpload">Contrato de Manutenção</Label>
                    <FilePreview url={formData.maintenanceContractUpload} selectedFile={selectedMaintenanceContractFile} label="Contrato atual" />
                    <input
                      type="file"
                      name="maintenanceContractUpload"
                      accept="application/pdf,image/jpeg,image/png,image/webp"
                      onChange={handleMaintenanceContractFileChange}
                      className={fileInputClass}
                    />
                    <p className="mt-1 text-xs text-zinc-400">
                      Formatos aceitos: PDF, JPG, PNG, WEBP. Máximo 10MB.
                      {formData.maintenanceContractUpload ? ' Selecionar um novo arquivo irá substituir o atual.' : ''}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Motorista Responsável */}
            <div>
              <h3 className="text-lg font-medium leading-6 text-zinc-900 border-b border-zinc-200 pb-2 mb-4">Motorista Responsável</h3>
              <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-zinc-700">Motorista</label>
                  <select
                    name="driverId"
                    value={formData.driverId || ''}
                    onChange={handleChange}
                    className={inputClass}
                  >
                    <option value="">Nenhum motorista</option>
                    {/* Motorista atual (pode não estar na lista de disponíveis se já estava associado) */}
                    {vehicle?.driverId && vehicle?.driverName && formData.driverId === vehicle.driverId && (
                      <option key={vehicle.driverId} value={vehicle.driverId}>
                        {vehicle.driverName} (Atual)
                      </option>
                    )}
                    {availableDrivers
                      .filter(d => d.id !== vehicle?.driverId) // evita duplicata se já aparece acima
                      .map(d => (
                        <option key={d.id} value={d.id}>
                          {d.name} — CPF: {formatCPF(d.cpf)}
                        </option>
                      ))}
                  </select>
                  <p className="mt-1 text-xs text-zinc-400">
                    Apenas motoristas sem veículo atribuído são listados. Selecione "Nenhum motorista" para desassociar.
                  </p>
                </div>
              </div>
            </div>

            {/* Logística */}
            <div>
              <h3 className="text-lg font-medium leading-6 text-zinc-900 border-b border-zinc-200 pb-2 mb-4">Logística</h3>
              <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-zinc-700">Embarcador</label>
                  <select
                    name="shipperId"
                    value={formData.shipperId || ''}
                    onChange={handleChange}
                    className={inputClass}
                  >
                    <option value="">Nenhum embarcador</option>
                    {availableShippers.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700">Unidade Operacional</label>
                  <select
                    name="operationalUnitId"
                    value={formData.operationalUnitId || ''}
                    onChange={handleChange}
                    disabled={!formData.shipperId}
                    className={`${inputClass} disabled:bg-zinc-50 disabled:text-zinc-400`}
                  >
                    <option value="">Nenhuma unidade</option>
                    {availableOperationalUnits
                      .filter(u => u.shipperId === formData.shipperId)
                      .map(u => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                  </select>
                  {!formData.shipperId && (
                    <p className="mt-1 text-xs text-zinc-400">Selecione um embarcador primeiro.</p>
                  )}
                </div>
              </div>
            </div>
          </form>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-200 bg-zinc-50 rounded-b-2xl">
          <button type="button" onClick={handleClose} disabled={saving} className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 transition-colors disabled:opacity-50">
            Cancelar
          </button>
          <button type="submit" form="vehicle-form" disabled={saving} className="inline-flex justify-center items-center gap-2 rounded-xl border border-transparent bg-orange-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-colors disabled:opacity-50">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? 'Salvando...' : 'Salvar Veículo'}
          </button>
        </div>
      </div>
    </div>
  );
}
