import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import PasswordField from '../components/PasswordField';
import { useAuth } from '../context/AuthContext';
import { validateNewPassword } from '../lib/passwordValidation';

export default function ChangePassword() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const { reauthenticate, updatePassword } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    const validationError = validateNewPassword(newPassword, confirmation);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (newPassword === currentPassword) {
      setError('A nova senha deve ser diferente da atual.');
      return;
    }

    setSubmitting(true);
    const { error: reauthenticateError } = await reauthenticate(currentPassword);
    if (reauthenticateError) {
      setSubmitting(false);
      setError(reauthenticateError);
      return;
    }

    const { error: updateError } = await updatePassword(newPassword);
    setSubmitting(false);

    if (updateError) {
      console.error('updatePassword error:', updateError);
      setError('Não foi possível alterar a senha. Tente novamente.');
      return;
    }

    setSuccess(true);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmation('');
  };

  return (
    <div className="space-y-6 overflow-y-auto pb-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Alterar senha</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Atualize a senha da sua conta usando sua senha atual.
        </p>
      </div>

      <div className="max-w-xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <form className="space-y-6" onSubmit={handleSubmit}>
          <PasswordField
            id="current-password"
            label="Senha atual"
            value={currentPassword}
            onChange={setCurrentPassword}
            autoComplete="current-password"
          />
          <PasswordField
            id="new-password"
            label="Nova senha"
            value={newPassword}
            onChange={setNewPassword}
            autoComplete="new-password"
          />
          <PasswordField
            id="confirm-password"
            label="Confirmar nova senha"
            value={confirmation}
            onChange={setConfirmation}
            autoComplete="new-password"
          />

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              {error}
            </p>
          )}

          {success && (
            <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
              Senha alterada com sucesso.
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex justify-center rounded-xl border border-transparent bg-orange-500 py-2.5 px-4 text-sm font-medium text-white shadow-sm hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            ) : (
              'Salvar nova senha'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
