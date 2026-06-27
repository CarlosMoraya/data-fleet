import { Eye, EyeOff } from 'lucide-react';
import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const resetSuccess = searchParams.get('reset') === 'success';

  const showVideo = !videoFailed;
  const showImage = videoFailed && !imageFailed;
  const showOverlay = showVideo || showImage;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const { error: loginError } = await login(email, password);
    setSubmitting(false);
    if (loginError) {
      setError(loginError);
    } else {
      void navigate('/');
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col justify-center overflow-hidden bg-zinc-900 py-12 sm:px-6 lg:px-8">

      {/* Vídeo de fundo — oculto via onError se não existir */}
      <video
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${showVideo ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        autoPlay
        loop
        muted
        playsInline
        onError={() => setVideoFailed(true)}
      >
        <source src="/videos/login-bg.mp4" type="video/mp4" onError={() => setVideoFailed(true)} />
      </video>

      {/* Imagem de fundo — fallback quando vídeo falha */}
      {videoFailed && (
        <img
          src="/images/login-bg.jpg"
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setImageFailed(true)}
        />
      )}

      {/* Overlay escuro sobre a mídia */}
      {showOverlay && (
        <div className="absolute inset-0 bg-black/50" />
      )}

      {/* Conteúdo do formulário */}
      <div className="relative z-10 sm:mx-auto sm:w-full sm:max-w-md">
        {/* Logo βetaFleet */}
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
          Sign in to βetaFleet
        </h2>

        <div className="rounded-2xl border border-white/20 bg-white/95 px-4 py-8 shadow-xl backdrop-blur-sm sm:px-10">
          <form className="space-y-6" onSubmit={(e) => { void handleSubmit(e); }}>
            {resetSuccess && (
              <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                Senha redefinida com sucesso. Faça login com a nova senha.
              </p>
            )}

            <div>
              <label className="block text-sm font-medium text-zinc-700">Email</label>
              <div className="mt-1">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full appearance-none rounded-xl border border-zinc-200 px-3 py-2 placeholder-zinc-400 shadow-sm focus:border-blue-500 focus:ring-blue-500 focus:outline-none sm:text-sm"
                  placeholder="user@example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700">Senha</label>
              <div className="relative mt-1">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full appearance-none rounded-xl border border-zinc-200 px-3 py-2 pr-10 placeholder-zinc-400 shadow-sm focus:border-blue-500 focus:ring-blue-500 focus:outline-none sm:text-sm"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-400 transition-colors hover:text-zinc-600"
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <Link
                to="/recuperar-senha"
                className="text-sm font-medium text-orange-600 hover:text-orange-700"
              >
                Esqueci minha senha
              </Link>
            </div>

            {error && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </p>
            )}

            <div>
              <button
                type="submit"
                disabled={submitting}
                className="flex w-full justify-center rounded-xl border border-transparent bg-orange-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-orange-600 focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? 'Entrando...' : 'Entrar'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
