import { ArrowLeft, Loader2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import PasswordField from '../components/PasswordField';
import { useAuth } from '../context/AuthContext';
import { validateNewPassword } from '../lib/passwordValidation';
import { supabase } from '../lib/supabase';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const { updatePassword, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
      setCheckingSession(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const validationError = validateNewPassword(password, confirmation);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    const { error: updateError } = await updatePassword(password);
    setSubmitting(false);

    if (updateError) {
      console.error('updatePassword error:', updateError);
      setError('Não foi possível alterar a senha. Tente novamente.');
      return;
    }

    await logout();
    navigate('/login?reset=success');
  };

  return (
    <div className="relative flex min-h-screen flex-col justify-center overflow-hidden bg-zinc-900 py-12 sm:px-6 lg:px-8">
      <div className="relative z-10 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="mb-8 flex flex-col items-center">
          <span className="flex items-baseline text-[36px] leading-none font-bold tracking-tight">
            <span className="mr-[2px] text-[38px] text-orange-500">β</span>
            <span className="text-white">etaFleet</span>
          </span>
          <span className="mt-1 ml-5 text-[11px] font-medium tracking-[0.25em] text-white/50 uppercase">
            GESTÃO DE FROTAS
          </span>
        </div>

        <h2 className="mb-8 text-center text-2xl font-semibold tracking-tight text-white">
          Definir nova senha
        </h2>

        <div className="rounded-2xl border border-white/20 bg-white/95 px-4 py-8 shadow-xl backdrop-blur-sm sm:px-10">
          {checkingSession ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-orange-500" aria-hidden="true" />
            </div>
          ) : !ready ? (
            <div className="space-y-6">
              <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                Link inválido ou expirado. Solicite um novo link de recuperação.
              </p>
              <Link
                to="/recuperar-senha"
                className="inline-flex items-center text-sm font-medium text-orange-600 hover:text-orange-700"
              >
                <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
                Solicitar novo link
              </Link>
            </div>
          ) : (
            <form className="space-y-6" onSubmit={handleSubmit}>
              <PasswordField
                id="password"
                label="Nova senha"
                value={password}
                onChange={setPassword}
                autoComplete="new-password"
              />
              <PasswordField
                id="confirmation"
                label="Confirmar nova senha"
                value={confirmation}
                onChange={setConfirmation}
                autoComplete="new-password"
              />

              {error && (
                <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="flex w-full justify-center rounded-xl border border-transparent bg-orange-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-orange-600 focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? (
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                ) : (
                  'Salvar nova senha'
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
