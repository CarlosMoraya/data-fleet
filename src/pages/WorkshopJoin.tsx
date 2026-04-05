import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Wrench, Loader2, CheckCircle2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { isValidCNPJ, formatCNPJ } from '../lib/cnpjValidator';
import { filterCNPJ } from '../lib/inputHelpers';

const inputClass =
  'mt-1 block w-full rounded-xl border border-zinc-300 py-2.5 px-3 text-sm shadow-sm ' +
  'focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500';

interface TokenInfo {
  valid: boolean;
  reason?: string;
  invitationId?: string;
  clientId?: string;
  clientName?: string;
  clientLogoUrl?: string;
}

type FlowStep = 'validating' | 'invalid' | 'choose' | 'register' | 'login' | 'success';

export default function WorkshopJoin() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') ?? '';

  const [step, setStep] = useState<FlowStep>('validating');
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);

  // Registro de nova conta
  const [regName, setRegName] = useState('');
  const [regCnpj, setRegCnpj] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Login com conta existente
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Validar token ao montar
  useEffect(() => {
    if (!token) {
      setStep('invalid');
      setTokenInfo({ valid: false, reason: 'Token não informado' });
      return;
    }

    supabase.rpc('validate_workshop_token', { p_token: token })
      .then(({ data, error: rpcError }) => {
        if (rpcError || !data) {
          setTokenInfo({ valid: false, reason: 'Erro ao validar convite' });
          setStep('invalid');
          return;
        }
        setTokenInfo(data as TokenInfo);
        setStep(data.valid ? 'choose' : 'invalid');
      });
  }, [token]);

  const callAcceptInvitation = async (body: object, authToken?: string) => {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/workshop-accept-invitation`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) throw new Error(json?.error ?? json?.message ?? `HTTP ${res.status}`);
    return json;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isValidCNPJ(regCnpj)) {
      setError('CNPJ inválido. Verifique os dígitos e tente novamente.');
      return;
    }

    setLoading(true);
    try {
      await callAcceptInvitation({ token, cnpj: regCnpj, email: regEmail, password: regPassword, name: regName });

      // Login automático após registro
      await supabase.auth.signInWithPassword({ email: regEmail, password: regPassword });
      setStep('success');
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao criar conta. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Fazer login primeiro para obter token de autenticação
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });

      if (authError || !authData.session) throw new Error(authError?.message ?? 'Login falhou');

      // Aceitar o convite com usuário autenticado
      await callAcceptInvitation({ token }, authData.session.access_token);

      setStep('success');
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao aceitar convite. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoToSystem = () => {
    navigate('/manutencao', { replace: true });
  };

  // ── Tela: validando token ──────────────────────────────────
  if (step === 'validating') {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 text-orange-500 animate-spin" />
          <p className="text-sm text-zinc-500">Validando convite...</p>
        </div>
      </div>
    );
  }

  // ── Tela: token inválido ───────────────────────────────────
  if (step === 'invalid') {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-zinc-200 p-8 text-center">
          <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-red-100 mb-4">
            <AlertCircle className="h-6 w-6 text-red-600" />
          </div>
          <h1 className="text-lg font-semibold text-zinc-900 mb-2">Convite inválido</h1>
          <p className="text-sm text-zinc-500">{tokenInfo?.reason ?? 'Este link de convite não é válido.'}</p>
          <p className="text-xs text-zinc-400 mt-4">
            Solicite um novo convite à transportadora.
          </p>
          <p className="text-xs text-zinc-300 mt-8">Powered by Betafleet</p>
        </div>
      </div>
    );
  }

  // ── Tela: sucesso ──────────────────────────────────────────
  if (step === 'success') {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-zinc-200 p-8 text-center">
          <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-green-100 mb-4">
            <CheckCircle2 className="h-6 w-6 text-green-600" />
          </div>
          <h1 className="text-lg font-semibold text-zinc-900 mb-2">Parceria confirmada!</h1>
          <p className="text-sm text-zinc-500 mb-6">
            Sua oficina agora está vinculada a <strong>{tokenInfo?.clientName}</strong>.
            Você pode acessar as ordens de serviço diretamente.
          </p>
          <button
            onClick={handleGoToSystem}
            className="w-full rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-orange-600 transition-colors"
          >
            Acessar o sistema
          </button>
          <p className="text-xs text-zinc-300 mt-6">Powered by Betafleet</p>
        </div>
      </div>
    );
  }

  // ── Header com branding da transportadora ──────────────────
  const clientLogo = tokenInfo?.clientLogoUrl;
  const clientName = tokenInfo?.clientName ?? 'a transportadora';

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full">

        {/* Branding da transportadora */}
        <div className="text-center mb-8">
          {clientLogo ? (
            <img src={clientLogo} alt={clientName} className="h-12 mx-auto mb-3 object-contain" />
          ) : (
            <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-xl bg-orange-100 mb-3">
              <Wrench className="h-6 w-6 text-orange-600" />
            </div>
          )}
          <h1 className="text-xl font-bold text-zinc-900">{clientName}</h1>
          <p className="text-sm text-zinc-500 mt-1">
            convidou sua oficina para integrar o sistema de gestão de manutenção
          </p>
        </div>

        {/* Card principal */}
        <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">

          {/* Escolha do fluxo */}
          {step === 'choose' && (
            <div className="p-8 space-y-4">
              <h2 className="text-base font-semibold text-zinc-900 text-center mb-6">
                Como deseja prosseguir?
              </h2>
              <button
                onClick={() => setStep('register')}
                className="w-full rounded-xl border-2 border-orange-200 bg-orange-50 hover:bg-orange-100 px-4 py-4 text-left transition-colors"
              >
                <p className="text-sm font-semibold text-zinc-900">Criar nova conta</p>
                <p className="text-xs text-zinc-500 mt-0.5">Minha oficina ainda não tem acesso ao sistema</p>
              </button>
              <button
                onClick={() => setStep('login')}
                className="w-full rounded-xl border-2 border-zinc-200 bg-zinc-50 hover:bg-zinc-100 px-4 py-4 text-left transition-colors"
              >
                <p className="text-sm font-semibold text-zinc-900">Já tenho conta</p>
                <p className="text-xs text-zinc-500 mt-0.5">Quero vincular minha conta existente a {clientName}</p>
              </button>
            </div>
          )}

          {/* Registro de nova conta */}
          {step === 'register' && (
            <form onSubmit={handleRegister} className="p-8 space-y-4">
              <button
                type="button"
                onClick={() => { setStep('choose'); setError(null); }}
                className="text-xs text-zinc-400 hover:text-zinc-600 mb-2"
              >
                ← Voltar
              </button>
              <h2 className="text-base font-semibold text-zinc-900">Criar conta da oficina</h2>

              <div>
                <label className="block text-sm font-medium text-zinc-700">Nome da Oficina <span className="text-red-500">*</span></label>
                <input
                  type="text" required value={regName}
                  onChange={e => setRegName(e.target.value)}
                  className={inputClass} placeholder="Ex: Oficina Central Ltda"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700">CNPJ <span className="text-red-500">*</span></label>
                <input
                  type="text" required value={regCnpj}
                  onChange={e => setRegCnpj(filterCNPJ(e.target.value))}
                  className={inputClass} placeholder="Somente números (14 dígitos)"
                  maxLength={14}
                />
                {regCnpj.length === 14 && !isValidCNPJ(regCnpj) && (
                  <p className="mt-1 text-xs text-red-600">CNPJ inválido</p>
                )}
                {regCnpj.length === 14 && isValidCNPJ(regCnpj) && (
                  <p className="mt-1 text-xs text-zinc-400">{formatCNPJ(regCnpj)}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700">E-mail de acesso <span className="text-red-500">*</span></label>
                <input
                  type="email" required value={regEmail}
                  onChange={e => setRegEmail(e.target.value)}
                  className={inputClass} placeholder="contato@oficina.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700">Senha <span className="text-red-500">*</span></label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required minLength={6} value={regPassword}
                    onChange={e => setRegPassword(e.target.value)}
                    className={inputClass} placeholder="Mínimo 6 caracteres"
                  />
                  <button type="button" onClick={() => setShowPassword(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 mt-0.5">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                  {error}
                </p>
              )}

              <button
                type="submit" disabled={loading}
                className="w-full rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-orange-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? 'Criando conta...' : 'Criar conta e aceitar convite'}
              </button>
            </form>
          )}

          {/* Login com conta existente */}
          {step === 'login' && (
            <form onSubmit={handleLogin} className="p-8 space-y-4">
              <button
                type="button"
                onClick={() => { setStep('choose'); setError(null); }}
                className="text-xs text-zinc-400 hover:text-zinc-600 mb-2"
              >
                ← Voltar
              </button>
              <h2 className="text-base font-semibold text-zinc-900">Entrar com conta existente</h2>

              <div>
                <label className="block text-sm font-medium text-zinc-700">E-mail</label>
                <input
                  type="email" required value={loginEmail}
                  onChange={e => setLoginEmail(e.target.value)}
                  className={inputClass} placeholder="seu@email.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700">Senha</label>
                <div className="relative">
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    required value={loginPassword}
                    onChange={e => setLoginPassword(e.target.value)}
                    className={inputClass} placeholder="Sua senha"
                  />
                  <button type="button" onClick={() => setShowLoginPassword(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 mt-0.5">
                    {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                  {error}
                </p>
              )}

              <button
                type="submit" disabled={loading}
                className="w-full rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-orange-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? 'Conectando...' : 'Entrar e aceitar convite'}
              </button>
            </form>
          )}
        </div>

        <p className="text-xs text-zinc-300 text-center mt-6">Powered by Betafleet</p>
      </div>
    </div>
  );
}
