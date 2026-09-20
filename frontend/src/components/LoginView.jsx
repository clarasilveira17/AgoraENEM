import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogIn, UserPlus, Sparkles, GraduationCap, AlertCircle, CheckCircle } from 'lucide-react';
import { TURMAS_ESCOLA } from '../constants/turmas';

export default function LoginView({ onLoginSuccess }) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' | 'register'

  // Form State
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [nome, setNome] = useState('');
  const [turma, setTurma] = useState(TURMAS_ESCOLA[0] || '1° A - INTEGRAL');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        await login(email, senha);
        setSuccess('Login efetuado com sucesso!');
        if (onLoginSuccess) onLoginSuccess();
      } else {
        if (!nome.trim()) {
          throw new Error('Por favor, informe seu nome completo.');
        }
        await register({ nome, email, senha, turma, role: 'ESTUDANTE' });
        setSuccess('Cadastro realizado! Seja bem-vindo(a).');
        if (onLoginSuccess) onLoginSuccess();
      }
    } catch (err) {
      setError(err.message || 'Ocorreu um erro ao processar sua requisição.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-[#ffffff] border border-[#e6e5e0] rounded-xl p-6 sm:p-8 font-sans">

      {/* Header Branding */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center p-2.5 rounded-full bg-[#f7f7f4] border border-[#e6e5e0] text-[#26251e] mb-3">
          <Sparkles className="w-5 h-5 text-[#f54e00]" aria-hidden="true" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-normal tracking-tight text-[#26251e]">
          Ágora ENEM
        </h2>
        <p className="text-xs sm:text-sm text-[#5a5852] mt-1 font-mono">
          Plataforma de Correção ENEM x Sisedu
        </p>
      </div>

      {/* Mode Toggle Tabs */}
      <div className="grid grid-cols-2 gap-1 p-1 bg-[#f7f7f4] rounded-md border border-[#e6e5e0] mb-6" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'login'}
          onClick={() => { setMode('login'); setError(null); }}
          className={`py-2 px-3 text-xs sm:text-sm font-medium rounded-md transition-all flex items-center justify-center gap-2 cursor-pointer ${
            mode === 'login'
              ? 'bg-[#ffffff] text-[#26251e] border border-[#e6e5e0] font-semibold'
              : 'text-[#5a5852] hover:text-[#26251e]'
          }`}
        >
          <LogIn className="w-4 h-4" aria-hidden="true" />
          <span>Entrar</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'register'}
          onClick={() => { setMode('register'); setError(null); }}
          className={`py-2 px-3 text-xs sm:text-sm font-medium rounded-md transition-all flex items-center justify-center gap-2 cursor-pointer ${
            mode === 'register'
              ? 'bg-[#ffffff] text-[#26251e] border border-[#e6e5e0] font-semibold'
              : 'text-[#5a5852] hover:text-[#26251e]'
          }`}
        >
          <UserPlus className="w-4 h-4" aria-hidden="true" />
          <span>Criar Conta</span>
        </button>
      </div>

      {/* Feedback Alerts */}
      {error && (
        <div
          role="alert"
          aria-live="assertive"
          className="mb-4 p-3 bg-[#dfa88f]/30 border border-[#dfa88f] rounded-md text-[#26251e] text-xs sm:text-sm flex items-start gap-2.5"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#cf2d56]" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div
          role="status"
          aria-live="polite"
          className="mb-4 p-3 bg-[#9fc9a2]/40 border border-[#9fc9a2] rounded-md text-[#26251e] text-xs sm:text-sm flex items-start gap-2.5"
        >
          <CheckCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#1f8a65]" aria-hidden="true" />
          <span>{success}</span>
        </div>
      )}

      {/* Auth Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === 'register' && (
          <>
            <div>
              <label htmlFor="auth-nome" className="block text-xs font-mono font-medium text-[#5a5852] uppercase tracking-wider mb-1.5">
                Nome Completo
              </label>
              <input
                id="auth-nome"
                name="nome"
                type="text"
                autoComplete="name"
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex.: João da Silva"
                className="w-full px-3.5 py-2.5 bg-[#ffffff] border border-[#e6e5e0] rounded-md text-sm text-[#26251e] placeholder-[#a09c92] focus:outline-none focus:ring-2 focus:ring-[#26251e] transition-colors"
              />
            </div>

            <div>
              <label htmlFor="auth-turma" className="block text-xs font-mono font-medium text-[#5a5852] uppercase tracking-wider mb-1.5">
                Turma Oficial
              </label>
              <select
                id="auth-turma"
                name="turma"
                value={turma}
                onChange={(e) => setTurma(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#ffffff] border border-[#e6e5e0] rounded-md text-sm text-[#26251e] focus:outline-none focus:ring-2 focus:ring-[#26251e] transition-colors font-mono cursor-pointer"
              >
                {TURMAS_ESCOLA.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </>
        )}

        <div>
          <label htmlFor="auth-email" className="block text-xs font-mono font-medium text-[#5a5852] uppercase tracking-wider mb-1.5">
            E-mail
          </label>
          <input
            id="auth-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu.email@exemplo.com"
            className="w-full px-3.5 py-2.5 bg-[#ffffff] border border-[#e6e5e0] rounded-md text-sm text-[#26251e] placeholder-[#a09c92] focus:outline-none focus:ring-2 focus:ring-[#26251e] transition-colors"
          />
        </div>

        <div>
          <label htmlFor="auth-senha" className="block text-xs font-mono font-medium text-[#5a5852] uppercase tracking-wider mb-1.5">
            Senha
          </label>
          <input
            id="auth-senha"
            name="password"
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            required
            minLength={6}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="••••••••"
            className="w-full px-3.5 py-2.5 bg-[#ffffff] border border-[#e6e5e0] rounded-md text-sm text-[#26251e] placeholder-[#a09c92] focus:outline-none focus:ring-2 focus:ring-[#26251e] transition-colors"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 px-4 bg-[#f54e00] hover:bg-[#d04200] text-white font-medium text-xs uppercase tracking-wider rounded-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-6 shadow-xs"
        >
          {loading ? (
            <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" aria-hidden="true"></span>
          ) : mode === 'login' ? (
            <>
              <LogIn className="w-4 h-4" aria-hidden="true" />
              <span>Acessar Plataforma</span>
            </>
          ) : (
            <>
              <GraduationCap className="w-4 h-4" aria-hidden="true" />
              <span>Cadastrar Aluno</span>
            </>
          )}
        </button>
      </form>

      {/* Footer Note */}
      <div className="mt-6 pt-4 border-t border-[#e6e5e0] text-center text-xs text-[#5a5852] font-mono">
        Ágora ENEM • Projeto Ágora Escolar
      </div>
    </div>
  );
}
