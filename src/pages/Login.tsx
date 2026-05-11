import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff } from 'lucide-react';

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
      navigate('/');
    }
  };

  return (
    <div className="relative min-h-screen bg-zinc-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 overflow-hidden">

      {/* Vídeo de fundo — oculto via onError se não existir */}
      <video
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${showVideo ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
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
          className="absolute inset-0 w-full h-full object-cover"
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
        <div className="flex flex-col items-center mb-8">
          <span className="text-[36px] font-bold tracking-tight leading-none flex items-baseline">
            <span className="text-orange-500 mr-[2px] text-[38px]">β</span>
            <span className="text-white">etaFleet</span>
          </span>
          <span className="text-[11px] font-medium text-white/50 uppercase tracking-[0.25em] mt-1 ml-5">
            Evolution always
          </span>
        </div>

        <h2 className="text-center text-2xl font-semibold tracking-tight text-white mb-8">
          Sign in to βetaFleet
        </h2>

        <div className="bg-white/95 backdrop-blur-sm py-8 px-4 shadow-xl rounded-2xl sm:px-10 border border-white/20">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-medium text-zinc-700">Email</label>
              <div className="mt-1">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full appearance-none rounded-xl border border-zinc-200 px-3 py-2 placeholder-zinc-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
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
                  className="block w-full appearance-none rounded-xl border border-zinc-200 px-3 py-2 pr-10 placeholder-zinc-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-400 hover:text-zinc-600 transition-colors"
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                {error}
              </p>
            )}

            <div>
              <button
                type="submit"
                disabled={submitting}
                className="flex w-full justify-center rounded-xl border border-transparent bg-orange-500 py-2.5 px-4 text-sm font-medium text-white shadow-sm hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
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
