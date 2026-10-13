import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Database, 
  Settings, 
  Award, 
  X, 
  GraduationCap, 
  LogOut, 
  Shield,
  Trophy,
  UserCheck,
  TrendingUp,
  Users,
  Layers,
  User
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

export default function Sidebar({ activeView, setActiveView, isMobileMenuOpen, setIsMobileMenuOpen, pendingCount, unidentifiedCount, onToast }) {
  const { user, logout, isAdmin, isProfessor, isTeacherOrAdmin, isEstudante } = useAuth();
  const isOnline = useNetworkStatus();

  if (!user) return null;

  const navSections = isTeacherOrAdmin ? [
    {
      title: 'Geral',
      items: [
        { id: 'dashboard', label: 'Dashboard & Métricas', icon: LayoutDashboard },
        { id: 'diagnostico', label: 'Diagnóstico & Feira de Ciências', icon: TrendingUp },
        { id: 'ranking', label: 'Ranking Oficial de Notas', icon: Trophy }
      ]
    },
    {
      title: 'Gestão de Redações',
      items: [
        { id: 'tabela', label: 'Envio & Banco de Redações', icon: Database },
        { id: 'validacao', label: 'Validar Alunos & Turmas', icon: UserCheck, badge: unidentifiedCount }
      ]
    },
    ...(isAdmin ? [
      {
        title: 'Administração',
        items: [
          { id: 'usuarios', label: 'Gestão de Usuários', icon: Users },
          { id: 'alocacao', label: 'Distribuição de Redações', icon: Layers },
          { id: 'config', label: 'Configurações do Sistema', icon: Settings }
        ]
      }
    ] : [])
  ] : [
    {
      title: 'Geral',
      items: [
        { id: 'dashboard', label: 'Minhas Notas & Desempenho', icon: LayoutDashboard },
        { id: 'ranking', label: 'Ranking & Classificação', icon: Trophy }
      ]
    },
    {
      title: 'Desempenho',
      items: [
        { id: 'tabela', label: 'Minhas Redações', icon: GraduationCap }
      ]
    }
  ];

  return (
    <aside
      className={`bg-[#ffffff] border-r border-[#e6e5e0] flex flex-col transition-all duration-300 z-40 fixed inset-y-0 left-0 md:static md:translate-x-0 md:w-64 ${
        isMobileMenuOpen ? 'translate-x-0 w-64 shadow-2xl' : '-translate-x-full md:translate-x-0'
      }`}
    >
      {/* Brand Header */}
      <div className="p-4 sm:p-5 border-b border-[#e6e5e0] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="bg-[#f54e00] p-1.5 rounded-md text-white shrink-0">
            <Award className="w-4 h-4" />
          </div>
          <div>
            <span className="font-normal text-sm sm:text-base text-[#26251e] block tracking-tight">Ágora ENEM</span>
            <span className="text-[10px] text-[#807d72] font-mono block">
              {isAdmin ? 'Painel do Administrador' : isProfessor ? 'Painel do Professor' : 'Portal do Aluno'}
            </span>
          </div>
        </div>

        {/* Mobile Close Button */}
        <button
          type="button"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-label="Fechar menu lateral"
          className="p-1 rounded-md bg-[#fafaf7] border border-[#e6e5e0] hover:bg-[#e6e5e0] text-[#5a5852] md:hidden cursor-pointer"
          title="Fechar Menu"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      {/* Navigation Sections */}
      <nav aria-label="Navegação principal" className="p-3 sm:p-4 space-y-5 flex-1 overflow-y-auto custom-scrollbar">
        {navSections.map((section, sIdx) => (
          <div key={sIdx} className="space-y-1">
            <div className="px-2 pb-1 text-[11px] font-mono font-medium text-[#5a5852] uppercase tracking-wider">
              {section.title}
            </div>

            <div className="space-y-0.5" role="list">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeView === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    role="listitem"
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => {
                      setActiveView(item.id);
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-normal transition-all group cursor-pointer ${
                      isActive
                        ? 'bg-[#fafaf7] text-[#26251e] border border-[#e6e5e0] font-semibold'
                        : 'text-[#5a5852] hover:text-[#26251e] hover:bg-[#fafaf7] border border-transparent'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 transition-colors ${isActive ? 'text-[#f54e00]' : 'text-[#807d72] group-hover:text-[#26251e]'}`} aria-hidden="true" />
                    <span className="truncate">{item.label}</span>

                    {item.badge > 0 && (
                      <span className="ml-auto px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold bg-[#dfa88f]/40 border border-[#dfa88f] text-[#26251e]">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* Link direto para o perfil no menu */}
        <div className="space-y-1 pt-2 border-t border-[#e6e5e0]/60">
          <div className="px-2 pb-1 text-[11px] font-mono font-medium text-[#5a5852] uppercase tracking-wider">
            Conta
          </div>
          <button
            type="button"
            onClick={() => {
              setActiveView('perfil');
              setIsMobileMenuOpen(false);
            }}
            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-normal transition-all group cursor-pointer ${
              activeView === 'perfil'
                ? 'bg-[#fafaf7] text-[#26251e] border border-[#e6e5e0] font-semibold'
                : 'text-[#5a5852] hover:text-[#26251e] hover:bg-[#fafaf7] border border-transparent'
            }`}
          >
            <User className={`w-4 h-4 shrink-0 ${activeView === 'perfil' ? 'text-[#f54e00]' : 'text-[#807d72] group-hover:text-[#26251e]'}`} />
            <span>Meu Perfil & Senha</span>
          </button>
        </div>

        {/* Cloud Status */}
        {isAdmin && (
          <div className="pt-2 border-t border-[#e6e5e0]/60 space-y-1.5">
            <div className="px-2 pb-1 text-[11px] font-mono font-medium text-[#5a5852] uppercase tracking-wider">
              Conexão
            </div>
            <div className="px-2.5 py-1.5 rounded-lg text-[11px] font-mono border border-[#9fc9a2] bg-[#9fc9a2]/15 text-[#1f8a65] flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#1f8a65] animate-pulse" aria-hidden="true" />
              <span>Nuvem Escolar Conectada</span>
            </div>
          </div>
        )}
      </nav>

      {/* Sleek User Profile Footer */}
      <div className="p-3 sm:p-4 border-t border-[#e6e5e0] bg-[#fafaf7] shrink-0 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div 
            onClick={() => {
              setActiveView('perfil');
              setIsMobileMenuOpen(false);
            }}
            className="flex items-center gap-2 min-w-0 cursor-pointer hover:opacity-80 transition-opacity"
            title="Clique para abrir Meu Perfil"
          >
            <div className="w-7 h-7 rounded-full bg-[#ffffff] border border-[#e6e5e0] flex items-center justify-center shrink-0 text-[#26251e] overflow-hidden">
              {user.avatar_url ? (
                <img src={user.avatar_url} alt={user.nome} className="w-full h-full object-cover" />
              ) : isAdmin ? (
                <Shield className="w-3.5 h-3.5 text-amber-600" aria-hidden="true" />
              ) : (
                <GraduationCap className="w-3.5 h-3.5 text-teal-600" aria-hidden="true" />
              )}
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-xs text-[#26251e] truncate">{user.nome}</div>
              <div className="text-[10px] font-mono text-[#5a5852] flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-[#1f8a65]' : 'bg-[#c08532]'}`} aria-hidden="true" />
                <span>{isOnline ? 'Online' : 'Offline'}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={logout}
            aria-label="Sair da conta"
            className="p-1.5 text-[#807d72] hover:text-[#cf2d56] hover:bg-red-50 rounded-md transition-colors cursor-pointer shrink-0"
            title="Sair da Conta"
          >
            <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>

        <div className="text-[10px] font-mono text-[#5a5852] text-center uppercase tracking-widest pt-1 border-t border-[#e6e5e0]/60">
          Ágora ENEM v2.1 • Prod
        </div>
      </div>
    </aside>
  );
}
