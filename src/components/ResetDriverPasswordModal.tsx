import { Eye, EyeOff } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { generateDriverPassword } from '../lib/driverPasswordReset';
import { validateNewPassword } from '../lib/passwordValidation';
import { fetchDriverPasswordResetHistory, resetDriverPassword, DriverPasswordResetEntry } from '../services/driverService';

import type { Driver } from '../types';

interface ResetDriverPasswordModalProps {
  open: boolean;
  driver: Driver | null;
  onClose: () => void;
}

function formatCPF(cpf: string): string {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return cpf;
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

function formatHistoryDate(iso: string): string {
  const date = new Date(iso);
  const datePart = date.toLocaleDateString('pt-BR');
  const timePart = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${datePart} às ${timePart}`;
}

export default function ResetDriverPasswordModal({
  open,
  driver,
  onClose,
}: ResetDriverPasswordModalProps): React.ReactElement | null {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ email: string | null } | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [history, setHistory] = useState<DriverPasswordResetEntry[]>([]);

  useEffect(() => {
    if (open) {
      setPassword('');
      setShowPassword(false);
      setError(null);
      setSuccess(null);
      setCopyFeedback(null);
    }
  }, [open, driver?.id]);

  useEffect(() => {
    if (open && driver?.profileId) {
      fetchDriverPasswordResetHistory(driver.profileId).then(setHistory);
    } else {
      setHistory([]);
    }
  }, [open, driver?.profileId]);

  if (!open || !driver) return null;

  const validationError = validateNewPassword(password, password);
  const canSubmit = password.length > 0 && !validationError && !isLoading;

  const handleGeneratePassword = () => {
    setPassword(generateDriverPassword());
    setShowPassword(true);
  };

  const handleCopy = async (text: string, feedback: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback(feedback);
      setTimeout(() => setCopyFeedback(null), 2000);
    } catch {
      setCopyFeedback('Não foi possível copiar. Selecione e copie manualmente.');
    }
  };

  const handleSubmit = async () => {
    if (!driver.profileId) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await resetDriverPassword(driver.profileId, password);
      setSuccess({ email: result.email });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
        <div className="border-b border-zinc-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-zinc-900">Redefinir senha do motorista</h2>
        </div>

        {success ? (
          <div className="space-y-4 px-6 py-5">
            <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              Senha redefinida com sucesso! Não se esqueça de enviar a nova senha ao motorista.
            </div>
            <div className="space-y-2 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 font-mono text-sm text-zinc-800">
              {success.email ? (
                <div>Login: {success.email}</div>
              ) : (
                <div>Login: não disponível — consulte o cadastro do motorista</div>
              )}
              <div>Senha: {password}</div>
            </div>
            <button
              type="button"
              onClick={() =>
                handleCopy(
                  `Login: ${success.email ?? 'não disponível'}\nSenha: ${password}`,
                  'Copiado!',
                )
              }
              className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
            >
              Copiar login e senha
            </button>
            {copyFeedback && <p className="text-xs text-zinc-500">{copyFeedback}</p>}
          </div>
        ) : (
          <div className="space-y-4 px-6 py-5">
            <div>
              <div className="font-medium text-zinc-900">{driver.name}</div>
              <div className="text-sm text-zinc-500">{formatCPF(driver.cpf)}</div>
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="reset-driver-password-input" className="block text-sm font-medium text-zinc-700">
                Nova senha
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    id="reset-driver-password-input"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="block w-full rounded-xl border border-zinc-300 px-3 py-2 pr-10 text-sm shadow-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-400 hover:text-zinc-700"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleGeneratePassword}
                  className="rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
                >
                  Gerar Senha Segura
                </button>
                <button
                  type="button"
                  onClick={() => handleCopy(password, 'Copiado!')}
                  disabled={!password}
                  className="rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Copiar
                </button>
                {copyFeedback && <span className="self-center text-xs text-zinc-500">{copyFeedback}</span>}
              </div>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              A senha não será enviada automaticamente ao motorista. Você precisará repassá-la pessoalmente.
            </div>

            <div className="space-y-1">
              <h3 className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">Histórico</h3>
              {history.length === 0 ? (
                <p className="text-sm text-zinc-500">Nenhuma redefinição anterior registrada.</p>
              ) : (
                <ul className="space-y-1 text-sm text-zinc-600">
                  {history.map((entry) => (
                    <li key={entry.id}>
                      {formatHistoryDate(entry.created_at)} — por {entry.reset_by_name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 border-t border-zinc-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            {success ? 'Fechar' : 'Cancelar'}
          </button>
          {!success && (
            <button
              type="button"
              disabled={!canSubmit}
              onClick={handleSubmit}
              className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? 'Redefinindo...' : 'Redefinir Senha'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
