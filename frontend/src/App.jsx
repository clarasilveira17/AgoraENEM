import React, { useState, useEffect, Suspense, lazy } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import LoginView from './components/LoginView';
import ConfirmModal from './components/ConfirmModal';
import ViewLoadingFallback from './components/ViewLoadingFallback';
import { clearAllLocalRedacoes } from './db/db';
import { AuthProvider, useAuth } from './context/AuthContext';
import { authService } from './services/authService';
import { X, Award, Loader2, Menu } from 'lucide-react';

// Code-splitting via React.lazy() para otimizacao de performance e Core Web Vitals (Fase 3)
const DashboardView = lazy(() => import('./components/DashboardView'));
const GestaoRedacoesView = lazy(() => import('./components/GestaoRedacoesView'));
const ConfigView = lazy(() => import('./components/ConfigView'));
const RankingView = lazy(() => import('./components/RankingView'));
const ValidacaoRapidaView = lazy(() => import('./components/ValidacaoRapidaView'));
const CorrecaoDetalheView = lazy(() => import('./components/CorrecaoDetalheView'));
const ProjetoAgoraLandingView = lazy(() => import('./components/ProjetoAgoraLandingView'));

function AppContent() {
  const { user, isAuthenticated, isAdmin, isEstudante, loading: authLoading } = useAuth();
  
  // Parse Hash URL to support #correcao/42 or regular views
  const parseHash = () => {
    const raw = window.location.hash.replace('#', '').trim();
    if (raw.startsWith('correcao/') || raw.startsWith('redacao/')) {
      const parts = raw.split('/');
      return { view: 'correcao', id: parts[1] || null };
    }
    const validViews = ['dashboard', 'ranking', 'novo', 'validacao', 'tabela', 'sem_nome', 'config'];
    return { view: validViews.includes(raw) ? raw : 'dashboard', id: null };
  };

  const initialRoute = parseHash();
  const [activeView, setActiveView] = useState(initialRoute.view);
  const [currentCorrecaoId, setCurrentCorrecaoId] = useState(initialRoute.id);
  const [previousView, setPreviousView] = useState('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [redacoes, setRedacoes] = useState([]);
  const [rankingRedacoes, setRankingRedacoes] = useState([]);
  const [isLoadingRedacoes, setIsLoadingRedacoes] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [selectedRedacao, setSelectedRedacao] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState('todas');

  // Estado para Modal de Confirmação Acessível (Fase 2 - Eliminação de window.confirm)
  const [deleteModalState, setDeleteModalState] = useState({
    isOpen: false,
    id: null,
    isDeleting: false
  });

  const handleSetActiveView = (view) => {
    if (activeView !== 'correcao') {
      setPreviousView(activeView);
    }
    setActiveView(view);
    setCurrentCorrecaoId(null);
    setSelectedRedacao(null);
    window.location.hash = `#${view}`;
  };

  const handleSelectRedacao = (r) => {
    if (!r) return;
    if (activeView !== 'correcao') {
      setPreviousView(activeView);
    }
    setSelectedRedacao(r);
    setCurrentCorrecaoId(String(r.id));
    setActiveView('correcao');
    window.location.hash = `#correcao/${r.id}`;
  };

  useEffect(() => {
    const handleHashChange = () => {
      const route = parseHash();
      setActiveView(route.view);
      setCurrentCorrecaoId(route.id);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Limpa silenciosamente o cache antigo do IndexedDB do navegador para evitar conflitos
  useEffect(() => {
    clearAllLocalRedacoes().catch(() => {});
  }, []);

  const loadRedacoes = async (silent = false) => {
    if (!silent) setIsLoadingRedacoes(true);
    try {
      // 1. Busca redações da nuvem e dados completos de ranking em paralelo diretamente do Supabase
      const [cloudDocsRes, rankingDocsRes] = await Promise.all([
        authService.fetchCloudRedacoes(),
        authService.fetchRankingRedacoes()
      ]);

      const cloudDocs = Array.isArray(cloudDocsRes) ? cloudDocsRes : [];
      const rankingDocs = Array.isArray(rankingDocsRes) ? rankingDocsRes : [];

      if (!isAdmin && user && user.role === 'ESTUDANTE') {
        // Para Estudante: Mostrar apenas as redações validadas do próprio estudante logado
        const cleanName = (user.nome || '').toLowerCase().trim();
        const studentCloudDocs = cloudDocs.filter(r =>
          (r.user_id && Number(r.user_id) === Number(user.id)) ||
          (cleanName && r.nome_aluno && r.nome_aluno.toLowerCase().trim() === cleanName)
        );

        setRedacoes(studentCloudDocs);
        setRankingRedacoes(rankingDocs.length > 0 ? rankingDocs : cloudDocs);
      } else {
        // Para Admin / Professor: Exibir 100% das redações da nuvem Supabase
        setRedacoes(cloudDocs);
        setRankingRedacoes(rankingDocs.length > 0 ? rankingDocs : cloudDocs);
      }
    } catch (error) {
      console.error('Falha ao carregar redações da nuvem:', error);
      setRedacoes([]);
      setRankingRedacoes([]);
    } finally {
      if (!silent) setIsLoadingRedacoes(false);
    }
  };

  useEffect(() => {
    loadRedacoes();
  }, [refreshTrigger, user]);

  const handleRedacaoSaved = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Solicitação de exclusão abre o ConfirmModal acessível
  const handleDeleteRedacao = (id) => {
    setDeleteModalState({
      isOpen: true,
      id,
      isDeleting: false
    });
  };

  const handleConfirmDelete = async () => {
    const id = deleteModalState.id;
    if (!id) return;

    setDeleteModalState(prev => ({ ...prev, isDeleting: true }));

    // 1. Atualização Otimista Imediata (0ms)
    const previousRedacoes = [...redacoes];
    setRedacoes(prev => prev.filter(r => String(r.id) !== String(id) && String(r.cloud_id) !== String(id)));
    setRankingRedacoes(prev => prev.filter(r => String(r.id) !== String(id) && String(r.cloud_id) !== String(id)));
    showToast('Redação excluída com sucesso!', 'success');
    setDeleteModalState({ isOpen: false, id: null, isDeleting: false });

    try {
      // 2. Exclui diretamente no Supabase
      await authService.deleteCloudRedacao(id);
      // 3. Atualiza estado de fundo silenciosamente
      await loadRedacoes(true);
    } catch (error) {
      console.error('Erro ao excluir redação:', error);
      setRedacoes(previousRedacoes);
      showToast(`Erro ao excluir: ${error.message}`, 'error');
    }
  };

  // Sincroniza a redação ativa quando a URL for #correcao/:id ou ao carregar
  useEffect(() => {
    if (activeView === 'correcao' && currentCorrecaoId) {
      const found = redacoes.find(r => String(r.id) === String(currentCorrecaoId)) ||
                    rankingRedacoes.find(r => String(r.id) === String(currentCorrecaoId));
      if (found) {
        setSelectedRedacao(found);
      } else {
        authService.fetchRedacaoById(currentCorrecaoId).then(data => {
          if (data) setSelectedRedacao(data);
        }).catch(() => {});
      }
    }
  }, [activeView, currentCorrecaoId, redacoes, rankingRedacoes]);

  const handleRedacaoUpdated = (updated) => {
    if (!updated || !updated.id) return;
    setRedacoes(prev => prev.map(r => String(r.id) === String(updated.id) ? { ...r, ...updated } : r));
    setRankingRedacoes(prev => prev.map(r => String(r.id) === String(updated.id) ? { ...r, ...updated } : r));
    if (selectedRedacao && String(selectedRedacao.id) === String(updated.id)) {
      setSelectedRedacao(prev => ({ ...prev, ...updated }));
    }
  };

  const pendingCount = redacoes.filter(r => !r.is_synced).length;
  const unidentifiedCount = redacoes.filter(r => r.status_validacao === 'PENDENTE_VALIDACAO' || !r.user_id || !r.nome_aluno).length;

  return (
    <div className="h-screen h-[100dvh] w-screen bg-[#f7f7f4] text-[#26251e] font-sans flex overflow-hidden">
      
      {/* Mobile Drawer Backdrop Overlay */}
      {isMobileMenuOpen && (
        <div
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-30 md:hidden animate-fadeIn"
          aria-hidden="true"
        />
      )}

      {/* Enterprise Navigation Sidebar */}
      {isAuthenticated && (
        <Sidebar
          activeView={activeView}
          setActiveView={(view) => {
            handleSetActiveView(view);
            setIsMobileMenuOpen(false);
            if (view === 'sem_nome') setFilterTab('sem_nome');
            else if (view === 'tabela') setFilterTab('todas');
          }}
          isMobileMenuOpen={isMobileMenuOpen}
          setIsMobileMenuOpen={setIsMobileMenuOpen}
          pendingCount={pendingCount}
          unidentifiedCount={unidentifiedCount}
          onToast={showToast}
        />
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen h-[100dvh] overflow-hidden">
        
        {/* Top Header on Landing Page for Visitors / Login */}
        {!isAuthenticated && (
          <Header onOpenLoginModal={() => setIsLoginModalOpen(true)} />
        )}

        {/* Mobile Hamburger Toggle Header */}
        {isAuthenticated && (
          <div className="md:hidden px-4 py-2.5 bg-[#f7f7f4] border-b border-[#e6e5e0] flex items-center justify-between shrink-0">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Abrir menu de navegação"
              className="p-1.5 rounded-md bg-[#ffffff] border border-[#e6e5e0] text-[#26251e] flex items-center gap-2 text-xs font-medium cursor-pointer"
            >
              <Menu className="w-4 h-4 text-[#f54e00]" aria-hidden="true" />
              <span>Menu</span>
            </button>
            <span className="text-xs font-semibold text-[#26251e] font-mono">Ágora ENEM</span>
          </div>
        )}

        {/* Global Toast Feedback Notification Banner */}
        {toast && (
          <div className="px-6 pt-4 animate-fadeIn">
            <div
              role="status"
              aria-live="polite"
              aria-atomic="true"
              className={`p-3.5 rounded-lg border text-xs font-medium flex items-center justify-between shadow-sm ${
                toast.type === 'error'
                  ? 'bg-[#dfa88f] border-[#dfa88f] text-[#26251e]'
                  : toast.type === 'warning'
                  ? 'bg-[#dfa88f]/60 border-[#dfa88f] text-[#26251e]'
                  : 'bg-[#9fc9a2] border-[#9fc9a2] text-[#26251e]'
              }`}
            >
              <span>{toast.message}</span>
              <button
                type="button"
                onClick={() => setToast(null)}
                aria-label="Fechar notificação"
                className="ml-4 font-mono text-xs hover:underline cursor-pointer opacity-80 hover:opacity-100"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Page Content Body with Suspense Code-Splitting */}
        <main className="flex-1 p-6 overflow-y-auto custom-scrollbar">
          
          {authLoading ? (
            <div className="h-full flex flex-col items-center justify-center text-[#26251e] space-y-3 animate-fadeIn">
              <div className="bg-[#f54e00] p-3.5 rounded-2xl text-white shadow-md">
                <Award className="w-7 h-7" />
              </div>
              <div className="font-semibold text-sm tracking-tight text-[#26251e]">Ágora ENEM</div>
              <div className="text-xs text-[#807d72] font-mono flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#f54e00]" />
                Carregando ambiente...
              </div>
            </div>
          ) : !isAuthenticated ? (
            <Suspense fallback={<ViewLoadingFallback message="Carregando portal..." />}>
              <ProjetoAgoraLandingView onOpenLoginModal={() => setIsLoginModalOpen(true)} />
            </Suspense>
          ) : (
            <Suspense fallback={<ViewLoadingFallback message="Carregando módulo..." />}>
              {activeView === 'dashboard' && (
                <DashboardView
                  redacoes={redacoes}
                  rankingRedacoes={rankingRedacoes}
                  isLoading={isLoadingRedacoes}
                  onSelectRedacao={handleSelectRedacao}
                  onNavigateToUpload={() => handleSetActiveView('tabela')}
                  onNavigateToRanking={() => handleSetActiveView('ranking')}
                  onNavigateToSemNome={() => handleSetActiveView('validacao')}
                />
              )}

              {activeView === 'ranking' && (
                <RankingView
                  redacoes={rankingRedacoes.length > 0 ? rankingRedacoes : redacoes}
                  onSelectRedacao={handleSelectRedacao}
                />
              )}

              {(activeView === 'novo' || activeView === 'tabela' || activeView === 'sem_nome') && (
                <GestaoRedacoesView
                  redacoes={redacoes}
                  isLoading={isLoadingRedacoes}
                  filterTab={activeView === 'sem_nome' ? 'sem_nome' : filterTab}
                  setFilterTab={setFilterTab}
                  onSelectRedacao={handleSelectRedacao}
                  onDeleteRedacao={handleDeleteRedacao}
                  onRedacaoSaved={handleRedacaoSaved}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                />
              )}

              {activeView === 'validacao' && (
                <ValidacaoRapidaView
                  redacoes={redacoes}
                  onSelectRedacao={handleSelectRedacao}
                  onRedacaoUpdated={handleRedacaoUpdated}
                  onRefresh={() => loadRedacoes(true)}
                />
              )}

              {activeView === 'correcao' && (
                <CorrecaoDetalheView
                  redacao={selectedRedacao}
                  redacoes={rankingRedacoes.length > 0 ? rankingRedacoes : redacoes}
                  onBack={() => handleSetActiveView(previousView || 'dashboard')}
                  onNavigateToRedacao={handleSelectRedacao}
                  onRedacaoUpdated={handleRedacaoUpdated}
                />
              )}

              {activeView === 'config' && (
                <ConfigView />
              )}
            </Suspense>
          )}

        </main>
      </div>

      {/* Accessible Confirmation Dialog */}
      <ConfirmModal
        isOpen={deleteModalState.isOpen}
        isLoading={deleteModalState.isDeleting}
        title="Excluir Redação Definitivamente"
        message="Esta ação é permanente e removerá a redação, notas e análise pedagógica do banco de dados na nuvem. Deseja continuar?"
        confirmText="Excluir Redação"
        cancelText="Cancelar"
        isDestructive={true}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteModalState({ isOpen: false, id: null, isDeleting: false })}
      />

      {/* Login Modal */}
      {isLoginModalOpen && (
        <div className="fixed inset-0 bg-[#26251e]/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="relative w-full max-w-md">
            <button
              type="button"
              onClick={() => setIsLoginModalOpen(false)}
              aria-label="Fechar janela de login"
              className="absolute top-4 right-4 text-[#807d72] hover:text-[#26251e] p-1.5 rounded-md bg-[#ffffff] border border-[#e6e5e0] z-10 transition-colors cursor-pointer"
              title="Fechar"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
            <LoginView onLoginSuccess={() => setIsLoginModalOpen(false)} />
          </div>
        </div>
      )}

    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
