import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  PlusCircle, 
  Database, 
  AlertTriangle, 
  Settings, 
  Award, 
  X, 
  GraduationCap, 
  LogOut, 
  CloudUpload, 
  Wifi, 
  WifiOff, 
  Shield,
  Download,
  Trophy,
  UserCheck
} from 'lucide-react';
import { db } from '../db/db';
import { useAuth } from '../context/AuthContext';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

export default function Sidebar({ activeView, setActiveView, isMobileMenuOpen, setIsMobileMenuOpen, pendingCount, unidentifiedCount, onToast }) {
  const { user, logout, isAdmin, isEstudante, syncLegacyToCloud } = useAuth();
  const isOnline = useNetworkStatus();
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState(null);
  const [syncProgress, setSyncProgress] = useState(null);

  const notify = (msg, type = 'success') => {
    if (onToast) onToast(msg, type);
    else console.log(`[Toast ${type}]: ${msg}`);
  };

  if (!user) return null; // Completely hide sidebar when unauthenticated

  const handleCloudSync = async () => {
    setIsCloudSyncing(true);
    setSyncFeedback(null);
    setSyncProgress(null);
    try {
      const res = await syncLegacyToCloud((current, total) => {
        setSyncProgress(`Subindo ${current}/${total}...`);
      });
      setSyncFeedback(res.message);
      notify(res.message || 'Sincronização concluída com sucesso!', 'success');
      setTimeout(() => setSyncFeedback(null), 5000);
    } catch (err) {
      notify(err.message || 'Erro ao sincronizar com a nuvem.', 'error');
    } finally {
      setIsCloudSyncing(false);
      setSyncProgress(null);
    }
  };

  const handleExportLocalBackup = async () => {
    try {
      const redacoesLocais = await db.redacoes.toArray();
      if (!redacoesLocais || redacoesLocais.length === 0) {
        notify('Nenhuma redação encontrada no armazenamento local deste navegador.', 'warning');
        return;
      }
      const backupData = {
        exported_at: new Date().toISOString(),
        counts: { redacoes: redacoesLocais.length },
        redacoes: redacoesLocais
      };
      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-redacoes-clara-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      notify(`Backup concluído com sucesso! ${redacoesLocais.length} redação(ões) baixada(s).`, 'success');
    } catch (err) {
      notify('Erro ao baixar backup local: ' + err.message, 'error');
    }
  };

  const navSections = isAdmin ? [
    {
      title: 'Geral',
      items: [
        { id: 'dashboard', label: 'Dashboard & Métricas', icon: LayoutDashboard },
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
    {
      title: 'Sistema',
      items: [
        { id: 'config', label: 'Configurações & API', icon: Settings }
      ]
    }
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
        { id: 'tabela', label: 'Enviar & Minhas Redações', icon: GraduationCap }
      ]
    }
  ];

  return (
    <aside
      className={`bg-[#ffffff] border-r border-[#e6e5e0] flex flex-col transition-transform duration-300 z-40 fixed inset-y-0 left-0 w-[84vw] max-w-[18rem] overscroll-contain md:static md:translate-x-0 md:w-64 md:max-w-none ${
        isMobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'
      }`}
    >
      {/* Brand Header */}
      <div className="safe-top p-4 sm:p-5 border-b border-[#e6e5e0] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="bg-[#f54e00] p-1.5 rounded-md text-white shrink-0">
            <Award className="w-4 h-4" />
          </div>
          <div>
            <span className="font-normal text-sm sm:text-base text-[#26251e] block tracking-tight">Ágora ENEM</span>
            <span className="text-[10px] text-[#807d72] font-mono block">
              {isAdmin ? 'Painel do Professor' : 'Portal do Aluno'}
            </span>
          </div>
        </div>

        {/* Mobile Close Button */}
        <button
          type="button"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-label="Fechar menu lateral"
          className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md bg-[#fafaf7] border border-[#e6e5e0] hover:bg-[#e6e5e0] text-[#5a5852] md:hidden cursor-pointer"
          title="Fechar Menu"
        >
          <X className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>

      {/* Navigation Sections */}
      <nav aria-label="Navegação principal" className="p-3 sm:p-4 pb-6 space-y-5 flex-1 overflow-y-auto overscroll-contain custom-scrollbar safe-bottom">
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
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2.5 min-h-[44px] rounded-lg text-[13px] sm:text-xs font-normal transition-all group cursor-pointer ${
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

        {/* Cloud Status */}
        {isAdmin && (
          <div className="pt-2 border-t border-[#e6e5e0]/60 space-y-1.5">
            <div className="px-2 pb-1 text-[11px] font-mono font-medium text-[#5a5852] uppercase tracking-wider">
              Armazenamento
            </div>
            <div className="px-2.5 py-1.5 rounded-lg text-[11px] font-mono border border-[#9fc9a2] bg-[#9fc9a2]/15 text-[#1f8a65] flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#1f8a65] animate-pulse" aria-hidden="true" />
              <span>Nuvem Supabase Ativa</span>
            </div>
          </div>
        )}
      </nav>

      {/* Sleek User Profile & Footer */}
      <div className="p-3 sm:p-4 safe-bottom border-t border-[#e6e5e0] bg-[#fafaf7] shrink-0 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-full bg-[#ffffff] border border-[#e6e5e0] flex items-center justify-center shrink-0 text-[#26251e]">
              {isAdmin ? (
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
            className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-[#807d72] hover:text-[#cf2d56] hover:bg-red-50 rounded-md transition-colors cursor-pointer shrink-0"
            title="Sair da Conta"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="text-[10px] font-mono text-[#5a5852] text-center uppercase tracking-widest pt-1 border-t border-[#e6e5e0]/60">
          Ágora ENEM v2.0
        </div>
      </div>
    </aside>
  );
}
