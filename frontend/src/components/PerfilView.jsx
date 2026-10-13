import React, { useState, useRef } from 'react';
import { 
  User, KeyRound, Shield, Mail, GraduationCap, 
  Camera, Check, AlertCircle, Loader2, LogOut, 
  Trash2, Save, ArrowLeft, CheckCircle2, Upload, Image as ImageIcon 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/authService';
import { compressImageFile } from '../utils/imageCompressor';

export default function PerfilView({ onBack }) {
  const { user, logout, isAdmin, isProfessor, updateUser } = useAuth();
  const fileInputRef = useRef(null);

  // Estados de Edição de Dados Pessoais
  const [nome, setNome] = useState(user?.nome || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isCompressingPhoto, setIsCompressingPhoto] = useState(false);
  const [photoInfo, setPhotoInfo] = useState(null);
  const [profileMsg, setProfileMsg] = useState(null);

  // Estados de Alteração de Senha
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmaNovaSenha, setConfirmaNovaSenha] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState(null);

  // Estados de Desativação
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCompressingPhoto(true);
    setProfileMsg(null);
    try {
      const res = await compressImageFile(file, 400, 0.85);
      setAvatarUrl(res.base64);
      setPhotoInfo(res.sizeKB);
      setProfileMsg({ 
        type: 'success', 
        text: `Foto carregada com sucesso (${res.sizeKB}). Clique em "Salvar Informações" para confirmar.` 
      });
    } catch (err) {
      console.error('Erro ao processar imagem:', err);
      setProfileMsg({ type: 'error', text: 'Não foi possível carregar a imagem. Tente outro arquivo.' });
    } finally {
      setIsCompressingPhoto(false);
      // Reset input value so same file can be re-selected if desired
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemovePhoto = () => {
    setAvatarUrl('');
    setPhotoInfo(null);
    setProfileMsg({ 
      type: 'success', 
      text: 'Foto removida. Clique em "Salvar Informações" para confirmar.' 
    });
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!nome.trim()) return;

    setIsUpdatingProfile(true);
    setProfileMsg(null);
    try {
      const updatedUser = await authService.atualizarPerfil(nome, avatarUrl);
      if (updateUser && updatedUser) {
        updateUser(updatedUser);
      }
      setPhotoInfo(null);
      setProfileMsg({ type: 'success', text: 'Dados atualizados com sucesso!' });
      setTimeout(() => setProfileMsg(null), 4000);
    } catch (err) {
      setProfileMsg({ type: 'error', text: err.message || 'Falha ao atualizar dados.' });
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setPasswordMsg(null);

    if (!senhaAtual || !novaSenha) {
      setPasswordMsg({ type: 'error', text: 'Preencha a senha atual e a nova senha.' });
      return;
    }

    if (novaSenha.length < 6) {
      setPasswordMsg({ type: 'error', text: 'A nova senha deve ter no mínimo 6 caracteres.' });
      return;
    }

    if (novaSenha !== confirmaNovaSenha) {
      setPasswordMsg({ type: 'error', text: 'A nova senha e a confirmação não coincidem.' });
      return;
    }

    setIsUpdatingPassword(true);
    try {
      await authService.alterarSenha(senhaAtual, novaSenha);
      setPasswordMsg({ type: 'success', text: 'Senha alterada com sucesso!' });
      setSenhaAtual('');
      setNovaSenha('');
      setConfirmaNovaSenha('');
      setTimeout(() => setPasswordMsg(null), 4000);
    } catch (err) {
      setPasswordMsg({ type: 'error', text: err.message || 'Falha ao alterar senha.' });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleDeactivateAccount = async () => {
    setIsDeactivating(true);
    try {
      await authService.desativarConta();
    } catch (err) {
      alert(`Falha ao desativar conta: ${err.message}`);
      setIsDeactivating(false);
      setShowDeactivateConfirm(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 text-[#26251e] pb-12 animate-fadeIn">
      {/* Top Header */}
      <div className="bg-[#ffffff] border border-[#e6e5e0] rounded-xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label="Voltar para a página anterior"
              className="p-2 rounded-lg bg-[#fafaf7] border border-[#e6e5e0] hover:bg-[#e6e5e0] text-[#26251e] transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div>
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-[#26251e] flex items-center gap-2">
              <User className="w-5 h-5 text-[#f54e00]" />
              <span>Meu Perfil & Segurança</span>
            </h2>
            <p className="text-xs text-[#807d72] mt-0.5">
              Gerencie suas informações cadastrais, credenciais de acesso e segurança da conta.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={logout}
          className="px-3.5 py-2 rounded-lg bg-[#fafaf7] hover:bg-red-50 text-[#807d72] hover:text-[#cf2d56] border border-[#e6e5e0] text-xs font-mono font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer shrink-0"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sair da Conta</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* Coluna Esquerda: Cartão Resumo & Informações */}
        <div className="md:col-span-5 bg-[#ffffff] border border-[#e6e5e0] rounded-xl p-5 space-y-5 shadow-xs">
          <div className="flex flex-col items-center text-center space-y-3 pb-4 border-b border-[#e6e5e0]">
            <div className="relative group">
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="w-24 h-24 rounded-full bg-[#fafaf7] border-2 border-[#e6e5e0] flex items-center justify-center overflow-hidden text-[#26251e] shadow-xs cursor-pointer relative group-hover:border-[#f54e00] transition-all"
                title="Clique para escolher uma foto do seu dispositivo"
              >
                {isCompressingPhoto ? (
                  <div className="flex flex-col items-center justify-center gap-1 text-[10px] text-[#807d72]">
                    <Loader2 className="w-5 h-5 animate-spin text-[#f54e00]" />
                    <span>Ajustando...</span>
                  </div>
                ) : avatarUrl ? (
                  <img src={avatarUrl} alt={nome} className="w-full h-full object-cover" />
                ) : (
                  <User className="w-12 h-12 text-[#807d72]" />
                )}

                {/* Overlay hover */}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="w-6 h-6 text-white" />
                </div>
              </div>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Escolher foto de perfil"
                className="absolute bottom-0 right-0 p-2 rounded-full bg-[#f54e00] hover:bg-[#d04200] text-white shadow-md cursor-pointer transition-transform hover:scale-110"
                title="Trocar foto"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
            </div>

            <div>
              <h3 className="text-base font-bold text-[#26251e]">{user?.nome}</h3>
              <p className="text-xs text-[#807d72] font-mono mt-0.5">{user?.email}</p>
            </div>

            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono font-bold bg-[#fafaf7] border border-[#e6e5e0]">
              <span className="w-2 h-2 rounded-full bg-[#1f8a65]" />
              <span>{isAdmin ? 'ADMINISTRADOR ESCOLAR' : isProfessor ? 'PROFESSOR CORRETOR' : 'ESTUDANTE'}</span>
            </div>
          </div>

          <div className="space-y-3 text-xs font-mono">
            <div className="flex items-center justify-between py-1.5 border-b border-[#f1f0ea]">
              <span className="text-[#807d72]">Matrícula / ID:</span>
              <strong className="text-[#26251e]">#{String(user?.id).padStart(4, '0')}</strong>
            </div>
            {user?.turma && (
              <div className="flex items-center justify-between py-1.5 border-b border-[#f1f0ea]">
                <span className="text-[#807d72]">Turma Vinculada:</span>
                <strong className="text-[#26251e]">{user.turma}</strong>
              </div>
            )}
            <div className="flex items-center justify-between py-1.5">
              <span className="text-[#807d72]">Situação:</span>
              <span className="text-[#1f8a65] font-bold">Cadastro Ativo</span>
            </div>
          </div>

          {/* Desativação de Conta */}
          <div className="pt-3 border-t border-[#e6e5e0]">
            {!showDeactivateConfirm ? (
              <button
                type="button"
                onClick={() => setShowDeactivateConfirm(true)}
                className="w-full py-2 px-3 rounded-lg text-xs font-mono text-[#807d72] hover:text-[#cf2d56] hover:bg-red-50 border border-transparent hover:border-red-200 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Desativar Minha Conta</span>
              </button>
            ) : (
              <div className="bg-red-50/70 border border-red-200 rounded-lg p-3 space-y-2 text-xs">
                <p className="text-red-900 font-semibold">Tem certeza que deseja desativar sua conta?</p>
                <p className="text-[11px] text-red-700">Seu acesso à plataforma da escola será suspenso.</p>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    disabled={isDeactivating}
                    onClick={handleDeactivateAccount}
                    className="flex-1 py-1.5 bg-[#cf2d56] hover:bg-red-700 text-white rounded text-[11px] font-mono font-bold cursor-pointer transition-colors"
                  >
                    {isDeactivating ? 'Desativando...' : 'Sim, Desativar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDeactivateConfirm(false)}
                    className="flex-1 py-1.5 bg-white border border-[#e6e5e0] text-[#26251e] rounded text-[11px] font-mono cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Coluna Direita: Formulários de Alteração de Dados & Senha */}
        <div className="md:col-span-7 space-y-6">
          {/* Card: Dados Básicos */}
          <div className="bg-[#ffffff] border border-[#e6e5e0] rounded-xl p-5 space-y-4 shadow-xs">
            <h3 className="text-sm font-bold text-[#26251e] flex items-center gap-2 border-b border-[#e6e5e0] pb-2.5">
              <User className="w-4 h-4 text-[#f54e00]" />
              <span>Editar Informações Pessoais</span>
            </h3>

            {profileMsg && (
              <div className={`p-3 rounded-lg border text-xs flex items-center gap-2 ${
                profileMsg.type === 'success' ? 'bg-emerald-50 text-emerald-900 border-emerald-200' : 'bg-red-50 text-red-900 border-red-200'
              }`}>
                {profileMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />}
                <span>{profileMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-mono font-semibold text-[#807d72] uppercase tracking-wider mb-1.5">
                  Nome Completo
                </label>
                <input
                  type="text"
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full bg-[#fafaf7] border border-[#e6e5e0] rounded-lg px-3 py-2 text-xs text-[#26251e] focus:outline-none focus:border-[#26251e]"
                />
              </div>

              {/* Seção Foto de Perfil com Upload Direto */}
              <div className="bg-[#fafaf7] border border-[#e6e5e0] rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-mono font-semibold text-[#807d72] uppercase tracking-wider">
                    Foto de Perfil
                  </label>
                  {avatarUrl && (
                    <span className="text-[11px] font-mono text-[#1f8a65] flex items-center gap-1 font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Foto Carregada
                    </span>
                  )}
                </div>

                {/* Input de arquivo nativo oculto */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png, image/jpeg, image/jpg, image/webp"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isCompressingPhoto}
                    className="px-3.5 py-2 rounded-lg bg-white border border-[#e6e5e0] hover:bg-[#f1f0ea] hover:border-[#26251e] text-[#26251e] text-xs font-mono font-semibold flex items-center gap-2 cursor-pointer transition-all shadow-xs disabled:opacity-50"
                  >
                    {isCompressingPhoto ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#f54e00]" />
                        <span>Ajustando foto...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-3.5 h-3.5 text-[#f54e00]" />
                        <span>{avatarUrl ? 'Trocar Foto' : 'Escolher Foto do Dispositivo'}</span>
                      </>
                    )}
                  </button>

                  {avatarUrl && (
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="px-3 py-2 rounded-lg bg-white hover:bg-red-50 text-[#807d72] hover:text-[#cf2d56] border border-[#e6e5e0] hover:border-red-200 text-xs font-mono flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remover Foto</span>
                    </button>
                  )}
                </div>

                <p className="text-[11px] text-[#807d72] leading-relaxed">
                  Tire uma foto ou selecione uma imagem do seu celular ou computador (PNG, JPG ou WEBP). A foto é ajustada automaticamente para o seu perfil.
                </p>
              </div>

              <div>
                <label className="block text-xs font-mono font-semibold text-[#807d72] uppercase tracking-wider mb-1.5">
                  E-mail de Acesso (Não alterável)
                </label>
                <input
                  type="email"
                  disabled
                  value={user?.email || ''}
                  className="w-full bg-[#f1f0ea] border border-[#e6e5e0] rounded-lg px-3 py-2 text-xs text-[#807d72] cursor-not-allowed font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={isUpdatingProfile}
                className="py-2.5 px-4 bg-[#26251e] hover:bg-[#3d3b33] text-white rounded-lg text-xs font-mono font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-xs disabled:opacity-50"
              >
                {isUpdatingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>Salvar Informações</span>
              </button>
            </form>
          </div>

          {/* Card: Alterar Senha */}
          <div className="bg-[#ffffff] border border-[#e6e5e0] rounded-xl p-5 space-y-4 shadow-xs">
            <h3 className="text-sm font-bold text-[#26251e] flex items-center gap-2 border-b border-[#e6e5e0] pb-2.5">
              <KeyRound className="w-4 h-4 text-[#f54e00]" />
              <span>Alterar Senha de Acesso</span>
            </h3>

            {passwordMsg && (
              <div className={`p-3 rounded-lg border text-xs flex items-center gap-2 ${
                passwordMsg.type === 'success' ? 'bg-emerald-50 text-emerald-900 border-emerald-200' : 'bg-red-50 text-red-900 border-red-200'
              }`}>
                {passwordMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />}
                <span>{passwordMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-mono font-semibold text-[#807d72] uppercase tracking-wider mb-1.5">
                  Senha Atual
                </label>
                <input
                  type="password"
                  required
                  placeholder="Digite sua senha atual..."
                  value={senhaAtual}
                  onChange={(e) => setSenhaAtual(e.target.value)}
                  className="w-full bg-[#fafaf7] border border-[#e6e5e0] rounded-lg px-3 py-2 text-xs text-[#26251e] focus:outline-none focus:border-[#26251e]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono font-semibold text-[#807d72] uppercase tracking-wider mb-1.5">
                    Nova Senha
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="Mínimo 6 dígitos..."
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
                    value={confirmaNovaSenha}
                    onChange={(e) => setConfirmaNovaSenha(e.target.value)}
                    className="w-full bg-[#fafaf7] border border-[#e6e5e0] rounded-lg px-3 py-2 text-xs text-[#26251e] focus:outline-none focus:border-[#26251e]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isUpdatingPassword}
                className="py-2.5 px-4 bg-[#f54e00] hover:bg-[#d04200] text-white rounded-lg text-xs font-mono font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-xs disabled:opacity-50"
              >
                {isUpdatingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                <span>Atualizar Senha</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
