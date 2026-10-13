import React, { useState } from 'react';
import { KeyRound, ArrowLeft, Loader2, CheckCircle2, AlertCircle, Lock } from 'lucide-react';
import { authService } from '../services/authService';

export default function RedefinirSenhaView({ initialToken = '', onBackToLogin, onSuccess }) {
  const [token, setToken] = useState(initialToken || '');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmaSenha, setConfirmaSenha] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);

    if (!token.trim() || !novaSenha) {
      setMessage({ type: 'error', text: 'Preencha o código/token e a nova senha.' });
      return;
    }

    if (novaSenha.length < 6) {
      setMessage({ type: 'error', text: 'A nova senha deve possuir pelo menos 6 dígitos.' });
      return;
    }

    if (novaSenha !== confirmaSenha) {
      setMessage({ type: 'error', text: 'As senhas digitadas não coincidem.' });
      return;
    }

    setIsLoading(true);
    try {
      const res = await authService.redefinirSenha(token.trim(), novaSenha);
      setMessage({ type: 'success', text: res.message || 'Senha redefinida com sucesso!' });
      setTimeout(() => {
        if (onSuccess) onSuccess();
        else if (onBackToLogin) onBackToLogin();
      }, 2500);
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Token inválido ou expirado.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-[#ffffff] border border-[#e6e5e0] rounded-2xl p-6 sm:p-8 max-w-md w-full mx-auto shadow-sm animate-fadeIn">
      <div className="space-y-2 text-center pb-4 border-b border-[#e6e5e0]">
        <div className="w-10 h-10 rounded-full bg-[#fafaf7] border border-[#e6e5e0] flex items-center justify-center mx-auto text-[#f54e00]">
          <Lock className="w-5 h-5" />
        </div>
        <h2 className="text-lg font-bold text-[#26251e]">Criar Nova Senha</h2>
        <p className="text-xs text-[#807d72]">
          Digite o código recebido e escolha sua nova senha de acesso.
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

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <div>
          <label className="block text-xs font-mono font-semibold text-[#807d72] uppercase tracking-wider mb-1.5">
            Código / Token de Redefinição
          </label>
          <input
            type="text"
            required
            placeholder="Cole o código recebido..."
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="w-full bg-[#fafaf7] border border-[#e6e5e0] rounded-lg px-3 py-2 text-xs text-[#26251e] font-mono focus:outline-none focus:border-[#26251e]"
          />
        </div>

        <div>
          <label className="block text-xs font-mono font-semibold text-[#807d72] uppercase tracking-wider mb-1.5">
            Nova Senha
          </label>
          <input
            type="password"
            required
            minLength={6}
            placeholder="Mínimo 6 caracteres..."
            value={novaSenha}
            onChange={(e) => setNovaSenha(e.target.value)}
            className="w-full bg-[#fafaf7] border border-[#e6e5e0] rounded-lg px-3 py-2 text-xs text-[#26251e] focus:outline-none focus:border-[#26251e]"
          />
        </div>

        <div>
          <label className="block text-xs font-mono font-semibold text-[#807d72] uppercase tracking-wider mb-1.5">
            Confirmar Nova Senha
          </label>
          <input
            type="password"
            required
            minLength={6}
            placeholder="Repita a nova senha..."
            value={confirmaSenha}
            onChange={(e) => setConfirmaSenha(e.target.value)}
            className="w-full bg-[#fafaf7] border border-[#e6e5e0] rounded-lg px-3 py-2 text-xs text-[#26251e] focus:outline-none focus:border-[#26251e]"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2.5 bg-[#f54e00] hover:bg-[#d04200] text-white rounded-lg text-xs font-mono font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-xs disabled:opacity-50"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
          <span>Salvar Nova Senha</span>
        </button>
      </form>

      <div className="mt-5 pt-4 border-t border-[#e6e5e0] text-center">
        <button
          type="button"
          onClick={onBackToLogin}
          className="text-xs font-mono text-[#807d72] hover:text-[#26251e] inline-flex items-center gap-1 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Voltar para o Login</span>
        </button>
      </div>
    </div>
  );
}
