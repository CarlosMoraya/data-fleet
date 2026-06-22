import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import PasswordField from '../components/PasswordField';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { validateNewPassword } from '../lib/passwordValidation';

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
    <div className="relative min-h-screen bg-zinc-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 overflow-hidden">
      <div className="relative z-10 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex flex-col items-center mb-8">
          <span className="text-[36px] font-bold tracking-tight leading-none flex items-baseline">
            <span className="text-orange-500 mr-[2px] text-[38px]">β</span>
            <span className="text-white">etaFleet</span>
          </span>
          <span className="text-[11px] font-medium text-white/50 uppercase tracking-[0.25em] mt-1 ml-5">
            GESTÃO DE FROTAS
          </span>
        </div>

        <h2 className="text-center text-2xl font-semibold tracking-tight text-white mb-8">
          Definir nova senha
        </h2>

        <div className="bg-white/95 backdrop-blur-sm py-8 px-4 shadow-xl rounded-2xl sm:px-10 border border-white/20">
          {checkingSession ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-orange-500" aria-hidden="true" />
            </div>
          ) : !ready ? (
            <div className="space-y-6">
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
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
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="flex w-full justify-center rounded-xl border border-transparent bg-orange-500 py-2.5 px-4 text-sm font-medium text-white shadow-sm hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
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
