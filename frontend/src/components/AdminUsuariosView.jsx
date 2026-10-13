import React, { useState, useEffect } from 'react';
import { 
  Users, Search, Filter, Shield, GraduationCap, 
  UserCheck, UserX, KeyRound, Loader2, RefreshCw, 
  ChevronLeft, ChevronRight, CheckCircle2, AlertCircle, X
} from 'lucide-react';
import { authService } from '../services/authService';

export default function AdminUsuariosView() {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState(null);

  // Modal de Reset de Senha
  const [resetModalUser, setResetModalUser] = useState(null);
  const [novaSenhaInput, setNovaSenhaInput] = useState('Agora@2026');
  const [isResetting, setIsResetting] = useState(false);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const data = await authService.fetchUsuariosAdmin({
        role: roleFilter,
        is_ativo: statusFilter,
        search,
        page,
        limit: 15
      });
      setUsers(data.users || []);
      setTotal(data.pagination?.total || 0);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch (err) {
      setFeedback({ type: 'error', text: err.message || 'Falha ao carregar usuários.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [page, roleFilter, statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    loadUsers();
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await authService.atualizarUsuarioAdmin(userId, { role: newRole });
      setFeedback({ type: 'success', text: `Papel do usuário atualizado para ${newRole}!` });
      loadUsers();
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    }
  };

  const handleToggleStatus = async (user) => {
    const newStatus = !user.is_ativo;
    try {
      await authService.atualizarUsuarioAdmin(user.id, { is_ativo: newStatus });
      setFeedback({ type: 'success', text: `Usuário ${newStatus ? 'reativado' : 'desativado'} com sucesso!` });
      loadUsers();
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    }
  };

  const handleConfirmResetPassword = async () => {
    if (!resetModalUser) return;
    setIsResetting(true);
    try {
      const res = await authService.resetarSenhaUsuarioAdmin(resetModalUser.id, novaSenhaInput);
      setFeedback({ type: 'success', text: res.message });
      setResetModalUser(null);
      setTimeout(() => setFeedback(null), 4000);
    } catch (err) {
      alert(`Erro: ${err.message}`);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 text-[#26251e] pb-12 animate-fadeIn">
      {/* Header */}
      <div className="bg-[#ffffff] border border-[#e6e5e0] rounded-xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div>
          <h2 className="text-lg sm:text-xl font-bold tracking-tight text-[#26251e] flex items-center gap-2">
            <Users className="w-5 h-5 text-[#f54e00]" />
            <span>Gestão de Usuários & Acessos</span>
          </h2>
          <p className="text-xs text-[#807d72] mt-0.5 font-mono">
            Controle de papéis (Estudante, Professor, Admin), ativação de contas e redefinição de senhas.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={loadUsers}
            className="p-2 rounded-lg bg-[#fafaf7] hover:bg-[#e6e5e0] border border-[#e6e5e0] text-[#26251e] text-xs font-mono flex items-center gap-1.5 cursor-pointer"
            title="Recarregar Usuários"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div className={`p-3.5 rounded-lg border text-xs flex items-center justify-between font-mono animate-fadeIn ${
          feedback.type === 'success' ? 'bg-emerald-50 text-emerald-900 border-emerald-200' : 'bg-red-50 text-red-900 border-red-200'
        }`}>
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />}
            <span>{feedback.text}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="font-bold cursor-pointer">✕</button>
        </div>
      )}

      {/* Barra de Filtros & Busca */}
      <div className="bg-[#ffffff] border border-[#e6e5e0] rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
          <Search className="w-3.5 h-3.5 text-[#807d72] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nome, e-mail ou turma..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#fafaf7] border border-[#e6e5e0] rounded-lg pl-9 pr-3 py-1.5 text-xs text-[#26251e] focus:outline-none focus:border-[#26251e]"
          />
        </form>

        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
          <select
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
            className="bg-[#fafaf7] border border-[#e6e5e0] rounded-lg px-2.5 py-1.5 text-xs text-[#26251e] font-mono focus:outline-none cursor-pointer"
          >
            <option value="">Todos os Papéis</option>
            <option value="ESTUDANTE">Estudantes</option>
            <option value="PROFESSOR">Professores</option>
            <option value="ADMIN">Administradores</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="bg-[#fafaf7] border border-[#e6e5e0] rounded-lg px-2.5 py-1.5 text-xs text-[#26251e] font-mono focus:outline-none cursor-pointer"
          >
            <option value="">Todos os Status</option>
            <option value="true">Ativos</option>
            <option value="false">Inativos</option>
          </select>
        </div>
      </div>

      {/* Tabela de Usuários */}
      <div className="bg-[#ffffff] border border-[#e6e5e0] rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#fafaf7] border-b border-[#e6e5e0] text-[#807d72] font-mono uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Usuário</th>
                <th className="py-3 px-4">Papel (Role)</th>
                <th className="py-3 px-4">Turma</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Ações Administrativas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e6e5e0]/60">
              {isLoading ? (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-[#807d72]">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#f54e00]" />
                    <span>Carregando usuários...</span>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-[#807d72]">
                    <span>Nenhum usuário corresponde aos filtros aplicados.</span>
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-[#fafaf7] transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-[#26251e]">{u.nome}</div>
                      <div className="text-[11px] font-mono text-[#807d72]">{u.email}</div>
                    </td>
                    <td className="py-3 px-4">
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        className="bg-white border border-[#e6e5e0] rounded px-2 py-1 text-xs font-mono font-bold text-[#26251e] cursor-pointer"
                      >
                        <option value="ESTUDANTE">ESTUDANTE</option>
                        <option value="PROFESSOR">PROFESSOR</option>
                        <option value="ADMIN">ADMIN</option>
                      </select>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-[#5a5852]">
                      {u.turma || '—'}
                    </td>
                    <td className="py-3 px-4">
                      {u.is_ativo ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-[#1f8a65] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#1f8a65]" />
                          Ativo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-[#cf2d56] bg-red-50 px-2 py-0.5 rounded border border-red-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#cf2d56]" />
                          Inativo
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => { setResetModalUser(u); setNovaSenhaInput('Agora@2026'); }}
                          className="px-2.5 py-1 rounded bg-[#fafaf7] hover:bg-[#e6e5e0] border border-[#e6e5e0] text-[#26251e] text-[11px] font-mono flex items-center gap-1 cursor-pointer"
                          title="Resetar senha deste usuário"
                        >
                          <KeyRound className="w-3 h-3 text-[#f54e00]" />
                          <span>Resetar Senha</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleStatus(u)}
                          className={`p-1 rounded border text-[11px] font-mono cursor-pointer transition-colors ${
                            u.is_ativo 
                              ? 'bg-[#ffffff] text-[#807d72] hover:text-[#cf2d56] border-[#e6e5e0] hover:bg-red-50' 
                              : 'bg-emerald-50 text-[#1f8a65] border-emerald-200'
                          }`}
                          title={u.is_ativo ? 'Desativar acesso' : 'Reativar acesso'}
                        >
                          {u.is_ativo ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="bg-[#fafaf7] border-t border-[#e6e5e0] p-3 flex items-center justify-between text-xs font-mono text-[#807d72]">
            <span>Total: <strong>{total}</strong> usuários registrados</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="p-1.5 rounded bg-white border border-[#e6e5e0] text-[#26251e] disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span>Página {page} de {totalPages}</span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded bg-white border border-[#e6e5e0] text-[#26251e] disabled:opacity-40 cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Reset de Senha */}
      {resetModalUser && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#e6e5e0] rounded-xl p-5 sm:p-6 max-w-sm w-full space-y-4 shadow-xl animate-fadeIn">
            <div className="flex items-center justify-between border-b border-[#e6e5e0] pb-3">
              <h3 className="font-bold text-sm text-[#26251e] flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-[#f54e00]" />
                <span>Redefinir Senha do Usuário</span>
              </h3>
              <button onClick={() => setResetModalUser(null)} className="text-[#807d72] hover:text-[#26251e] cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-[#807d72] space-y-1">
              <p>Usuário: <strong className="text-[#26251e]">{resetModalUser.nome}</strong></p>
              <p className="font-mono">{resetModalUser.email}</p>
            </div>

            <div>
              <label className="block text-xs font-mono font-semibold text-[#807d72] uppercase tracking-wider mb-1">
                Nova Senha Provisória
              </label>
              <input
                type="text"
                value={novaSenhaInput}
                onChange={(e) => setNovaSenhaInput(e.target.value)}
                className="w-full bg-[#fafaf7] border border-[#e6e5e0] rounded-lg px-3 py-2 text-xs font-mono text-[#26251e] focus:outline-none focus:border-[#26251e]"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                disabled={isResetting || !novaSenhaInput}
                onClick={handleConfirmResetPassword}
                className="flex-1 py-2 bg-[#f54e00] hover:bg-[#d04200] text-white rounded-lg text-xs font-mono font-bold cursor-pointer disabled:opacity-50 transition-colors"
              >
                {isResetting ? 'Redefinindo...' : 'Confirmar Nova Senha'}
              </button>
              <button
                type="button"
                onClick={() => setResetModalUser(null)}
                className="px-3 py-2 bg-white border border-[#e6e5e0] text-[#26251e] rounded-lg text-xs font-mono cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
