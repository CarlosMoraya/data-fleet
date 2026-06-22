import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const neutralMessage =
  'Se houver uma conta associada a este e-mail, você receberá um link para redefinir sua senha em instantes. Verifique também a caixa de spam.';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const { requestPasswordReset } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await requestPasswordReset(email);
    setSubmitting(false);
    setSent(true);
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
          Recuperar senha
        </h2>

        <div className="bg-white/95 backdrop-blur-sm py-8 px-4 shadow-xl rounded-2xl sm:px-10 border border-white/20">
          {sent ? (
            <div className="space-y-6">
              <p className="text-sm text-zinc-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-3">
                {neutralMessage}
              </p>
              <Link
                to="/login"
                className="inline-flex items-center text-sm font-medium text-orange-600 hover:text-orange-700"
              >
                <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
                Voltar para o login
              </Link>
            </div>
          ) : (
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-zinc-700">
                  Email
                </label>
                <div className="mt-1">
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    className="block w-full appearance-none rounded-xl border border-zinc-200 px-3 py-2 placeholder-zinc-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                    placeholder="user@example.com"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="flex w-full justify-center rounded-xl border border-transparent bg-orange-500 py-2.5 px-4 text-sm font-medium text-white shadow-sm hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                ) : (
                  'Enviar link de recuperação'
                )}
              </button>

              <Link
                to="/login"
                className="inline-flex items-center text-sm font-medium text-orange-600 hover:text-orange-700"
              >
                <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
                Voltar para o login
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
