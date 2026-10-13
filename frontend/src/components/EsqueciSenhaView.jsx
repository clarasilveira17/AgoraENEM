import React, { useState } from 'react';
import { Mail, ArrowLeft, Loader2, CheckCircle2, AlertCircle, KeyRound } from 'lucide-react';
import { authService } from '../services/authService';

export default function EsqueciSenhaView({ onBackToLogin, onGoToReset }) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [devToken, setDevToken] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsLoading(true);
    setMessage(null);
    setDevToken(null);
    try {
      const res = await authService.esqueciSenha(email.trim());
      setMessage({ type: 'success', text: res.message || 'Instruções enviadas para seu e-mail!' });
      if (res.tokenDev) {
        setDevToken(res.tokenDev);
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Falha ao solicitar recuperação.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-[#ffffff] border border-[#e6e5e0] rounded-2xl p-6 sm:p-8 max-w-md w-full mx-auto shadow-sm animate-fadeIn">
      <div className="space-y-2 text-center pb-4 border-b border-[#e6e5e0]">
        <div className="w-10 h-10 rounded-full bg-[#fafaf7] border border-[#e6e5e0] flex items-center justify-center mx-auto text-[#f54e00]">
          <KeyRound className="w-5 h-5" />
        </div>
        <h2 className="text-lg font-bold text-[#26251e]">Recuperar Senha</h2>
        <p className="text-xs text-[#807d72]">
          Informe seu e-mail institucional para receber o código de redefinição de acesso.
        </p>
      </div>

      {message && (
        <div className={`mt-4 p-3 rounded-lg border text-xs flex items-center gap-2 ${
          message.type === 'success' ? 'bg-emerald-50 text-emerald-900 border-emerald-200' : 'bg-red-50 text-red-900 border-red-200'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      {devToken && (
        <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs space-y-1 font-mono">
          <p className="font-bold text-amber-900">Token de Teste (Ambiente Dev):</p>
          <code className="block bg-white p-1.5 rounded border border-amber-300 break-all select-all font-bold">
            {devToken}
          </code>
          {onGoToReset && (
            <button
              type="button"
              onClick={() => onGoToReset(devToken)}
              className="text-xs font-bold text-amber-900 underline mt-1 cursor-pointer"
            >
              Clique aqui para prosseguir com este token
            </button>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <div>
          <label className="block text-xs font-mono font-semibold text-[#807d72] uppercase tracking-wider mb-1.5">
            E-mail Cadastrado
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 text-[#807d72] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="email"
              required
              placeholder="seu.email@aluno.ce.gov.br"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#fafaf7] border border-[#e6e5e0] rounded-lg pl-9 pr-3 py-2 text-xs text-[#26251e] focus:outline-none focus:border-[#26251e]"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2.5 bg-[#f54e00] hover:bg-[#d04200] text-white rounded-lg text-xs font-mono font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-xs disabled:opacity-50"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
          <span>Enviar Código de Redefinição</span>
        </button>
      </form>

      <div className="mt-5 pt-4 border-t border-[#e6e5e0] flex items-center justify-between text-xs font-mono">
        <button
          type="button"
          onClick={onBackToLogin}
          className="text-[#807d72] hover:text-[#26251e] flex items-center gap-1 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Voltar para o Login</span>
        </button>

        {onGoToReset && (
          <button
            type="button"
            onClick={() => onGoToReset('')}
            className="text-[#f54e00] hover:underline cursor-pointer font-semibold"
          >
            Já tenho um código
          </button>
        )}
      </div>
    </div>
  );
}
