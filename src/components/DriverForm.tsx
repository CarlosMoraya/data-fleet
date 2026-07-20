import { X, FileText, ExternalLink, Loader2, UserPlus, Eye, EyeOff } from 'lucide-react';
import React, { useState, useEffect, useMemo } from 'react';

import { useAuth } from '../context/AuthContext';
import { extractCnhData, ExtractionStatus, ExtractionResult } from '../lib/documentOcr';
import { isDriverFieldRequired } from '../lib/driverFieldSettingsMappers';
import {
  filterDigitsOnly,
  filterText,
  filterAlphanumeric,
  filterCPF,
  filterCNHCategory,
  filterPhone,
} from '../lib/inputHelpers';
import { invokeEdgeFunction } from '../lib/invokeEdgeFn';
import { validateFile } from '../lib/storageHelpers';
import { buildUiStateKey, readUiState, writeUiState, removeUiState, sanitizeDraft } from '../lib/uiStateStorage';
import { Driver, DriverFieldSettings } from '../types';

import type { EmploymentRegime } from '../types/driver';

interface DriverFormFiles {
  cnh: File | null;
  gr: File | null;
  certificate1: File | null;
  certificate2: File | null;
  certificate3: File | null;
  serviceContract: File | null;
}

interface DriverFormProps {
  driver: Driver | null;
  fieldSettings: DriverFieldSettings | null;
  clientId: string;
  onClose: () => void;
  onSave: (driver: Partial<Driver>, files: DriverFormFiles) => Promise<void>;
}

const FIELD_FILTERS: Record<string, (v: string) => string> = {
  name: filterText,
  cpf: filterCPF,
  registrationNumber: filterDigitsOnly,
  category: filterCNHCategory,
  renach: (v) => filterAlphanumeric(v),
  courseName1: filterText,
  courseName2: filterText,
  courseName3: filterText,
  phone: filterPhone,
};

export default function DriverForm({ driver, fieldSettings, clientId, onClose, onSave }: DriverFormProps) {
  const { user, currentClient } = useAuth();
  const isCreating = !driver;
  const draftKey = user?.id
    ? buildUiStateKey({ scope: 'draft', userId: user.id, clientId: currentClient?.id ?? 'no-client', module: 'drivers', stateKind: 'draft', name: 'form' })
    : '';

  const defaultFormData = useMemo(() => ({ ...driver }), [driver]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formData, setFormData] = useState<Partial<Driver>>(() => {
    if (!draftKey) return defaultFormData;
    const saved = readUiState<Partial<Driver>>(window.sessionStorage, draftKey, defaultFormData, {
      legacyKeys: ['driverFormData'],
    });
    return saved;
  });
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCnhFile, setSelectedCnhFile] = useState<File | null>(null);
  const [cnhExtractionStatus, setCnhExtractionStatus] = useState<ExtractionStatus>('idle');
  const [cnhExtractionResult, setCnhExtractionResult] = useState<ExtractionResult<Driver> | null>(null);
  const [selectedGRFile, setSelectedGRFile] = useState<File | null>(null);
  const [selectedCert1File, setSelectedCert1File] = useState<File | null>(null);
  const [selectedCert2File, setSelectedCert2File] = useState<File | null>(null);
  const [selectedCert3File, setSelectedCert3File] = useState<File | null>(null);
  const [selectedServiceContractFile, setSelectedServiceContractFile] = useState<File | null>(null);

  // Helper: retorna true se o campo é obrigatório
  const req = (name: string) => fieldSettings ? isDriverFieldRequired(name, fieldSettings) : true;

  useEffect(() => {
    if (driver) {
      setFormData(prev => ({ ...prev, ...driver }));
    }
    setError(null);
  }, [driver]);

  useEffect(() => {
    if (!draftKey) return;
    const sanitized = sanitizeDraft('drivers', formData as Record<string, unknown>);
    writeUiState(window.sessionStorage, draftKey, sanitized as Partial<Driver>, defaultFormData, { removeLegacyKeys: ['driverFormData'] });
  }, [formData, draftKey, defaultFormData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const filter = FIELD_FILTERS[name];
    const filtered = filter ? filter(value) : value;
    setFormData(prev => ({ ...prev, [name]: filtered }));
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
        setError(err instanceof Error ? err.message : 'Arquivo inválido.');
        e.target.value = '';
      }
    };

  const handleCnhFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) {
      setSelectedCnhFile(null);
      return;
    }
    try {
      validateFile(file);
      setSelectedCnhFile(file);
      setError(null);
      setCnhExtractionStatus('extracting');
      setCnhExtractionResult(null);
      const result = await extractCnhData(file);
      setCnhExtractionResult(result);
      if (result.fieldCount === 0) {
        setCnhExtractionStatus('failed');
      } else if (result.fieldCount < result.totalFields) {
        setCnhExtractionStatus('partial');
      } else {
        setCnhExtractionStatus('success');
      }
      if (result.fieldCount > 0) {
        setFormData(prev => {
          const merged = { ...prev };
          for (const [key, value] of Object.entries(result.data)) {
            if (value != null && value !== '') {
              // Em criação: preenche tudo. Em edição: só preenche campos vazios.
              if (!driver || !prev[key as keyof Driver]) {
                (merged as Record<string, unknown>)[key] = value;
              }
            }
          }
          return merged;
        });
      }
    } catch (err: unknown) {
      setSelectedCnhFile(null);
      setError(err instanceof Error ? err.message : 'Arquivo inválido.');
      e.target.value = '';
    }
  };
  const handleGRFileChange = makeFileHandler(setSelectedGRFile);
  const handleCert1FileChange = makeFileHandler(setSelectedCert1File);
  const handleCert2FileChange = makeFileHandler(setSelectedCert2File);
  const handleCert3FileChange = makeFileHandler(setSelectedCert3File);
  const handleServiceContractFileChange = makeFileHandler(setSelectedServiceContractFile);

  const handleEmploymentRegimeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as EmploymentRegime | '';
    setFormData(prev => ({ ...prev, employmentRegime: value === '' ? null : value }));
    if (value !== 'PJ') {
      setSelectedServiceContractFile(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    // Validação programática de uploads obrigatórios
    if (req('cnhUpload') && !selectedCnhFile && !formData.cnhUpload) {
      setError('O documento da CNH é obrigatório.');
      setSaving(false);
      return;
    }
    if (req('grUpload') && !selectedGRFile && !formData.grUpload) {
      setError('O documento GR do motorista é obrigatório.');
      setSaving(false);
      return;
    }
    if (req('certificate1Upload') && !selectedCert1File && !formData.certificate1Upload) {
      setError('O Certificado 1 é obrigatório.');
      setSaving(false);
      return;
    }
    if (req('certificate2Upload') && !selectedCert2File && !formData.certificate2Upload) {
      setError('O Certificado 2 é obrigatório.');
      setSaving(false);
      return;
    }
    if (req('certificate3Upload') && !selectedCert3File && !formData.certificate3Upload) {
      setError('O Certificado 3 é obrigatório.');
      setSaving(false);
      return;
    }

    try {
      let profileId: string | undefined;

      // No modo criação: primeiro cria o usuário no sistema
      if (isCreating) {
        const data = await invokeEdgeFunction('create-user', {
          email: email.trim().toLowerCase(),
          password,
          name: formData.name ?? '',
          role: 'Driver',
          client_id: clientId,
        }) as { profileId?: string };
        profileId = data.profileId;
      }

      await onSave(
        { ...formData, profileId },
        {
          cnh: selectedCnhFile,
          gr: selectedGRFile,
          certificate1: selectedCert1File,
          certificate2: selectedCert2File,
          certificate3: selectedCert3File,
          serviceContract: selectedServiceContractFile,
        }
      );
    } catch (err: unknown) {
      const pgError = err as { code?: string; message?: string };
      if (pgError?.code === '23505') {
        setError('Este CPF já está cadastrado para este cliente.');
      } else {
        setError((err as Error).message ?? 'Erro ao salvar motorista. Tente novamente.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (draftKey) {
      removeUiState(window.sessionStorage, draftKey);
    }
    removeUiState(window.sessionStorage, 'driverFormData');
    removeUiState(window.sessionStorage, 'driverFormEmail');
    removeUiState(window.sessionStorage, 'driverFormPassword');
    onClose();
  };

  const inputClass = "mt-1 block w-full rounded-xl border border-zinc-300 py-2 px-3 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:text-sm";
  const fileInputClass = "mt-1 block w-full text-sm text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100";

  // Label com asterisco vermelho para campos obrigatórios
  const Label = ({ name, children }: { name: string; children: React.ReactNode }) => (
    <label className="block text-sm font-medium text-zinc-700">
      {children}{req(name) && <span className="ml-0.5 text-red-500">*</span>}
    </label>
  );

  const FilePreview = ({ url, selectedFile, label }: { url?: string; selectedFile: File | null; label: string }) => (
    <>
      {url && !selectedFile && (
        <div className="mt-2 mb-2 flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
          <FileText className="h-4 w-4 flex-shrink-0 text-zinc-400" />
          <span className="flex-1 truncate">{label}</span>
          <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-blue-600 hover:text-blue-700">
            Visualizar <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}
      {selectedFile && (
        <p className="mt-1 text-xs font-medium text-emerald-600">
          ✓ {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
          {selectedFile.type.startsWith('image/') ? ' — será comprimida antes do upload' : ''}
        </p>
      )}
    </>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm sm:p-6">
      <div className="my-8 flex max-h-full w-full max-w-3xl flex-col rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <h2 className="text-xl font-semibold text-zinc-900">
            {driver ? 'Editar Motorista' : 'Cadastrar Motorista'}
          </h2>
          <button onClick={handleClose} className="text-zinc-400 transition-colors hover:text-zinc-500">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form id="driver-form" onSubmit={(e) => { void handleSubmit(e); }} className="space-y-8">
            {/* Acesso ao Sistema — apenas na criação */}
            {isCreating && (
              <div>
                <h3 className="mb-4 flex items-center gap-2 border-b border-zinc-200 pb-2 text-lg leading-6 font-medium text-zinc-900">
                  <UserPlus className="h-5 w-5 text-orange-500" />
                  Acesso ao Sistema
                </h3>
                <p className="mb-4 text-sm text-zinc-500">O motorista receberá um login para acessar os checklists.</p>
                <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-zinc-700">
                      E-mail<span className="ml-0.5 text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="motorista@empresa.com"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700">
                      Senha temporária<span className="ml-0.5 text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        data-testid="password-input"
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        className={`${inputClass} pr-10`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(prev => !prev)}
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-400 transition-colors hover:text-zinc-600"
                        aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="mt-1 text-xs text-zinc-400">O motorista deverá alterar a senha no primeiro acesso.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Dados Pessoais */}
            <div>
              <h3 className="mb-4 border-b border-zinc-200 pb-2 text-lg leading-6 font-medium text-zinc-900">Dados Pessoais</h3>
              <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-zinc-700">
                    Nome<span className="ml-0.5 text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    value={formData.name || ''}
                    onChange={handleChange}
                    className={inputClass}
                  />
                  <p className="mt-1 text-xs text-zinc-400">Deve ser idêntico ao nome que consta na CNH.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700">
                    CPF<span className="ml-0.5 text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="cpf"
                    required
                    inputMode="numeric"
                    value={formData.cpf || ''}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="Somente números"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700">
                    Telefone de Contato
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    inputMode="numeric"
                    value={formData.phone || ''}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="Somente números"
                  />
                </div>
                <div>
                  <label htmlFor="employment-regime" className="block text-sm font-medium text-zinc-700">
                    Regime de Contratação<span className="ml-0.5 text-red-500">*</span>
                  </label>
                  <select
                    id="employment-regime"
                    name="employmentRegime"
                    required
                    value={formData.employmentRegime ?? ''}
                    onChange={handleEmploymentRegimeChange}
                    className={inputClass}
                  >
                    <option value="">Selecione…</option>
                    <option value="CLT">CLT</option>
                    <option value="PJ">PJ</option>
                  </select>
                </div>
              </div>
              {formData.employmentRegime === 'PJ' && (
                <div className="mt-6 sm:col-span-2">
                  <label className="block text-sm font-medium text-zinc-700">
                    Contrato de Prestação de Serviços
                  </label>
                  <FilePreview url={formData.serviceContractUpload} selectedFile={selectedServiceContractFile} label="Contrato atual" />
                  <input
                    type="file"
                    accept="application/pdf,image/jpeg,image/png,image/webp"
                    onChange={handleServiceContractFileChange}
                    className={fileInputClass}
                  />
                  <p className="mt-1 text-xs text-zinc-400">
                    Formatos aceitos: PDF, JPG, PNG, WEBP. Máximo 10MB.
                    {formData.serviceContractUpload ? ' Selecionar um novo arquivo irá substituir o atual.' : ''}
                  </p>
                </div>
              )}
            </div>

            {/* CNH */}
            <div>
              <h3 className="mb-4 border-b border-zinc-200 pb-2 text-lg leading-6 font-medium text-zinc-900">CNH</h3>
              <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                <div>
                  <Label name="issueDate">Data de Emissão</Label>
                  <input
                    type="date"
                    name="issueDate"
                    required={req('issueDate')}
                    value={formData.issueDate || ''}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>
                <div>
                  <Label name="expirationDate">Validade</Label>
                  <input
                    type="date"
                    name="expirationDate"
                    required={req('expirationDate')}
                    value={formData.expirationDate || ''}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>
                <div>
                  <Label name="registrationNumber">Nº do Registro</Label>
                  <input
                    type="text"
                    name="registrationNumber"
                    required={req('registrationNumber')}
                    inputMode="numeric"
                    value={formData.registrationNumber || ''}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>
                <div>
                  <Label name="category">Categoria</Label>
                  <input
                    type="text"
                    name="category"
                    required={req('category')}
                    value={formData.category || ''}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="Ex: A, B, AB, AE, ABCDE"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label name="renach">Renach</Label>
                  <input
                    type="text"
                    name="renach"
                    required={req('renach')}
                    value={formData.renach || ''}
                    onChange={handleChange}
                    className={inputClass}
                  />
                  <p className="mt-1 text-xs text-zinc-400">Número na lateral do documento.</p>
                </div>

                {/* CNH Upload */}
                <div className="sm:col-span-2">
                  <Label name="cnhUpload">CNH — Carteira Nacional de Habilitação</Label>
                  <FilePreview url={formData.cnhUpload} selectedFile={selectedCnhFile} label="Documento atual" />
                  <input
                    type="file"
                    name="cnhUpload"
                    accept="application/pdf,image/jpeg,image/png,image/webp"
                    onChange={(e) => { void handleCnhFileChange(e); }}
                    className={fileInputClass}
                  />
                  <p className="mt-1 text-xs text-zinc-400">
                    Formatos aceitos: PDF, JPG, PNG, WEBP. Máximo 10MB.
                    {formData.cnhUpload ? ' Selecionar um novo arquivo irá substituir o atual.' : ''}
                  </p>
                  {cnhExtractionStatus === 'extracting' && (
                    <div className="mt-2 flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
                      <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin" />
                      Extraindo dados do documento…
                    </div>
                  )}
                  {cnhExtractionStatus === 'success' && cnhExtractionResult && (
                    <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                      {cnhExtractionResult.fieldCount} campos preenchidos automaticamente via{' '}
                      {cnhExtractionResult.method === 'regex' ? 'leitura direta' : 'IA'}. Confira os valores e ajuste se necessário.
                    </div>
                  )}
                  {cnhExtractionStatus === 'partial' && cnhExtractionResult && (
                    <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                      {cnhExtractionResult.fieldCount}/{cnhExtractionResult.totalFields} campos extraídos via{' '}
                      {cnhExtractionResult.method === 'regex' ? 'leitura direta' : 'IA'}.
                      {cnhExtractionResult.warnings.length > 0 && (
                        <span className="mt-0.5 block text-xs">
                          Não encontrados: {cnhExtractionResult.warnings.join(', ')}
                        </span>
                      )}
                    </div>
                  )}
                  {cnhExtractionStatus === 'failed' && (
                    <div className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      Não foi possível extrair dados do documento. Preencha os campos manualmente.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* GR do Motorista */}
            <div>
              <h3 className="mb-4 border-b border-zinc-200 pb-2 text-lg leading-6 font-medium text-zinc-900">GR do Motorista</h3>
              <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
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
                  <Label name="grExpirationDate">Validade do GR</Label>
                  <input
                    type="date"
                    name="grExpirationDate"
                    required={req('grExpirationDate')}
                    value={formData.grExpirationDate || ''}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>
              </div>
            </div>

            {/* Certificados */}
            <div>
              <h3 className="mb-4 border-b border-zinc-200 pb-2 text-lg leading-6 font-medium text-zinc-900">Certificados</h3>
              <div className="space-y-6">
                {/* Certificado 1 */}
                <div className="grid grid-cols-1 gap-x-4 gap-y-4 rounded-xl border border-zinc-100 bg-zinc-50/50 p-4 sm:grid-cols-2">
                  <h4 className="text-sm font-semibold text-zinc-600 sm:col-span-2">Certificado 1</h4>
                  <div>
                    <Label name="courseName1">Nome do Curso</Label>
                    <input
                      type="text"
                      name="courseName1"
                      required={req('courseName1')}
                      value={formData.courseName1 || ''}
                      onChange={handleChange}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <Label name="certificate1Upload">Upload do Certificado</Label>
                    <FilePreview url={formData.certificate1Upload} selectedFile={selectedCert1File} label="Certificado atual" />
                    <input
                      type="file"
                      accept="application/pdf,image/jpeg,image/png,image/webp"
                      onChange={handleCert1FileChange}
                      className={fileInputClass}
                    />
                    <p className="mt-1 text-xs text-zinc-400">PDF, JPG, PNG, WEBP. Máx 10MB.</p>
                  </div>
                </div>

                {/* Certificado 2 */}
                <div className="grid grid-cols-1 gap-x-4 gap-y-4 rounded-xl border border-zinc-100 bg-zinc-50/50 p-4 sm:grid-cols-2">
                  <h4 className="text-sm font-semibold text-zinc-600 sm:col-span-2">Certificado 2</h4>
                  <div>
                    <Label name="courseName2">Nome do Curso</Label>
                    <input
                      type="text"
                      name="courseName2"
                      required={req('courseName2')}
                      value={formData.courseName2 || ''}
                      onChange={handleChange}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <Label name="certificate2Upload">Upload do Certificado</Label>
                    <FilePreview url={formData.certificate2Upload} selectedFile={selectedCert2File} label="Certificado atual" />
                    <input
                      type="file"
                      accept="application/pdf,image/jpeg,image/png,image/webp"
                      onChange={handleCert2FileChange}
                      className={fileInputClass}
                    />
                    <p className="mt-1 text-xs text-zinc-400">PDF, JPG, PNG, WEBP. Máx 10MB.</p>
                  </div>
                </div>

                {/* Certificado 3 */}
                <div className="grid grid-cols-1 gap-x-4 gap-y-4 rounded-xl border border-zinc-100 bg-zinc-50/50 p-4 sm:grid-cols-2">
                  <h4 className="text-sm font-semibold text-zinc-600 sm:col-span-2">Certificado 3</h4>
                  <div>
                    <Label name="courseName3">Nome do Curso</Label>
                    <input
                      type="text"
                      name="courseName3"
                      required={req('courseName3')}
                      value={formData.courseName3 || ''}
                      onChange={handleChange}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <Label name="certificate3Upload">Upload do Certificado</Label>
                    <FilePreview url={formData.certificate3Upload} selectedFile={selectedCert3File} label="Certificado atual" />
                    <input
                      type="file"
                      accept="application/pdf,image/jpeg,image/png,image/webp"
                      onChange={handleCert3FileChange}
                      className={fileInputClass}
                    />
                    <p className="mt-1 text-xs text-zinc-400">PDF, JPG, PNG, WEBP. Máx 10MB.</p>
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>

        <div className="flex items-center justify-end gap-3 rounded-b-2xl border-t border-zinc-200 bg-zinc-50 px-6 py-4">
          <button type="button" onClick={handleClose} disabled={saving} className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 focus:outline-none disabled:opacity-50">
            Cancelar
          </button>
          <button type="submit" form="driver-form" disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl border border-transparent bg-orange-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-orange-600 focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:outline-none disabled:opacity-50">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? 'Salvando...' : 'Salvar Motorista'}
          </button>
        </div>
      </div>
    </div>
  );
}
