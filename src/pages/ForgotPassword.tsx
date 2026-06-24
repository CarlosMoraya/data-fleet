import { ArrowLeft, Loader2 } from 'lucide-react';
import React, { useState } from 'react';
import { Link } from 'react-router-dom';

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
          Recuperar senha
        </h2>

        <div className="rounded-2xl border border-white/20 bg-white/95 px-4 py-8 shadow-xl backdrop-blur-sm sm:px-10">
          {sent ? (
            <div className="space-y-6">
              <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-zinc-700">
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
                    className="block w-full appearance-none rounded-xl border border-zinc-200 px-3 py-2 placeholder-zinc-400 shadow-sm focus:border-blue-500 focus:ring-blue-500 focus:outline-none sm:text-sm"
                    placeholder="user@example.com"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="flex w-full justify-center rounded-xl border border-transparent bg-orange-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-orange-600 focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
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
