import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  UserCheck, Search, Check, ChevronRight, ChevronLeft, 
  GraduationCap, AlertTriangle, FileText, CheckCircle2,
  Filter, ExternalLink, RefreshCw, Save, ZoomIn, ZoomOut,
  RotateCw, Maximize2, Minimize2, Image as ImageIcon, Loader2,
  Sparkles, User, Users, CheckCircle, Clock, ArrowRight, X
} from 'lucide-react';
import { authService } from '../services/authService';
import { db } from '../db/db';

const TURMAS_ESCOLA = [
  '2° A - MANHÃ',
  '2° B - MANHÃ',
  '2° C - MANHÃ',
  '3° A - MANHÃ',
  '3° B - MANHÃ',
  '3° C - MANHÃ',
  '3° D - MANHÃ',
  '3° E - TARDE',
  '3° F - TARDE',
  '3° G - TARDE',
  'Sem Turma'
];

export default function ValidacaoRapidaView({ 
  redacoes = [], 
  onSelectRedacao, 
  onRedacaoUpdated,
  onRefresh
}) {
  const [estudantes, setEstudantes] = useState([]);
  const [isLoadingEstudantes, setIsLoadingEstudantes] = useState(false);
  const [viewMode, setViewMode] = useState('esteira'); // 'esteira' | 'tabela'
  
  // Filtros: por padrão abre em 'pendentes' de conferência manual
  const [filterType, setFilterType] = useState('pendentes'); // 'pendentes' | 'conferidas' | 'todas'
  const [selectedTurmaFilter, setSelectedTurmaFilter] = useState('todas');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Estado Esteira
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [manualNome, setManualNome] = useState('');
  const [manualTurma, setManualTurma] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState(null);

  // Cache de imagens em alta definição (ID -> Base64)
  const [imagesCache, setImagesCache] = useState({});
  const [isLoadingImage, setIsLoadingImage] = useState(false);
  
  // Controles de Visualização da Imagem
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const imageContainerRef = useRef(null);

  // Carregar lista de estudantes cadastrados (700+) para busca rápida local
  useEffect(() => {
    let isMounted = true;
    async function loadStudents() {
      setIsLoadingEstudantes(true);
      try {
        const fetchFn = authService.fetchEstudantes ? authService.fetchEstudantes.bind(authService) : authService.getEstudantes.bind(authService);
        const list = await fetchFn();
        if (isMounted) setEstudantes(Array.isArray(list) ? list : []);
      } catch (err) {
        console.warn('Erro ao carregar estudantes para validação rápida:', err);
      } finally {
        if (isMounted) setIsLoadingEstudantes(false);
      }
    }
    loadStudents();
    return () => { isMounted = false; };
  }, []);

  // Métricas de validação manual real do professor
  const totalCount = redacoes.length;
  const conferidasCount = useMemo(() => {
    return redacoes.filter(r => Boolean(r.data_validacao || r.validado_por)).length;
  }, [redacoes]);
  const pendentesCount = totalCount - conferidasCount;
  const percentualConcluido = totalCount > 0 ? Math.round((conferidasCount / totalCount) * 100) : 0;

  // Lista filtrada de redações
  const filteredRedacoes = useMemo(() => {
    return redacoes.filter(r => {
      const isConferida = Boolean(r.data_validacao || r.validado_por);
      
      if (filterType === 'pendentes' && isConferida) return false;
      if (filterType === 'conferidas' && !isConferida) return false;
      
      const turma = (r.turma_aluno || r.extracted_data?.turma || '').toLowerCase();
      if (selectedTurmaFilter !== 'todas' && turma !== selectedTurmaFilter.toLowerCase()) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const nome = (r.nome_aluno || r.extracted_data?.aluno || '').toLowerCase();
        const idStr = String(r.id);
        return nome.includes(q) || turma.includes(q) || idStr.includes(q);
      }

      return true;
    });
  }, [redacoes, filterType, selectedTurmaFilter, searchQuery]);

  // Redação atual na esteira
  const currentRedacao = filteredRedacoes[currentIndex] || null;

  // Sincronizar campos e carregar imagem da redação atual
  useEffect(() => {
    if (currentRedacao) {
      setSelectedStudentId(currentRedacao.user_id ? String(currentRedacao.user_id) : '');
      setManualNome(currentRedacao.nome_aluno || currentRedacao.extracted_data?.aluno || '');
      setManualTurma(currentRedacao.turma_aluno || currentRedacao.extracted_data?.turma || 'Sem Turma');
      setStudentSearch('');
      setZoomLevel(1);
      setRotation(0);

      // Scroll para o topo da folha para focar no cabeçalho
      if (imageContainerRef.current) {
        imageContainerRef.current.scrollTop = 0;
      }

      // Carregar imagem da folha se ainda não estiver no cache
      const redacaoId = currentRedacao.id;
      if (!imagesCache[redacaoId]) {
        let isMounted = true;
        async function fetchImage() {
          setIsLoadingImage(true);
          try {
            // 1. Tenta carregar do IndexedDB local primeiro (0ms)
            if (db && db.redacoes) {
              const local = await db.redacoes.get(Number(redacaoId));
              if (local?.imagem_base64 && isMounted) {
                setImagesCache(prev => ({ ...prev, [redacaoId]: local.imagem_base64 }));
                setIsLoadingImage(false);
                return;
              }
            }

            // 2. Se não estiver local ou veio da nuvem, busca via API
            const fullData = await authService.fetchRedacaoById(redacaoId);
            if (isMounted && fullData?.imagem_base64) {
              setImagesCache(prev => ({ ...prev, [redacaoId]: fullData.imagem_base64 }));
            }
          } catch (err) {
            console.warn(`Erro ao carregar imagem para redação #${redacaoId}:`, err);
          } finally {
            if (isMounted) setIsLoadingImage(false);
          }
        }
        fetchImage();
        return () => { isMounted = false; };
      }
    }
  }, [currentRedacao]);

  // Pré-busca em background da próxima folha para navegação com 0ms de espera
  useEffect(() => {
    const nextItem = filteredRedacoes[currentIndex + 1];
    if (nextItem && !imagesCache[nextItem.id]) {
      authService.fetchRedacaoById(nextItem.id).then(data => {
        if (data?.imagem_base64) {
          setImagesCache(prev => ({ ...prev, [nextItem.id]: data.imagem_base64 }));
        }
      }).catch(() => {});
    }
  }, [currentIndex, filteredRedacoes, imagesCache]);

  // Atalhos de teclado: Setas e Enter
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignora se estiver digitando em um input ou select
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        if (currentIndex < filteredRedacoes.length - 1) {
          setCurrentIndex(prev => prev + 1);
        }
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        if (currentIndex > 0) {
          setCurrentIndex(prev => prev - 1);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, filteredRedacoes.length]);

  // Lista filtrada de estudantes cadastrados para o autocomplete
  const filteredEstudantesOptions = useMemo(() => {
    if (!studentSearch.trim()) return estudantes.slice(0, 30);
    const q = studentSearch.toLowerCase().trim();
    return estudantes.filter(e => 
      (e.nome || '').toLowerCase().includes(q) ||
      (e.email || '').toLowerCase().includes(q) ||
      (e.turma || '').toLowerCase().includes(q)
    ).slice(0, 50);
  }, [estudantes, studentSearch]);

  // Selecionar aluno da lista
  const handleSelectStudent = (st) => {
    setSelectedStudentId(String(st.id));
    setManualNome(st.nome);
    if (st.turma) setManualTurma(st.turma);
    setStudentSearch('');
  };

  // 1-Clique: Confirmar leitura da IA
  const handleConfirmAIData = () => {
    if (!currentRedacao) return;
    const aiNome = currentRedacao.extracted_data?.aluno || currentRedacao.nome_aluno;
    const aiTurma = currentRedacao.extracted_data?.turma || currentRedacao.turma_aluno;
    
    // Tenta achar estudante correspondente na lista
    if (aiNome && estudantes.length > 0) {
      const match = estudantes.find(e => 
        (e.nome || '').trim().toLowerCase() === aiNome.trim().toLowerCase()
      );
      if (match) {
        setSelectedStudentId(String(match.id));
        setManualNome(match.nome);
        setManualTurma(match.turma || aiTurma || 'Sem Turma');
        executeSave(match.id, match.nome, match.turma || aiTurma || 'Sem Turma');
        return;
      }
    }

    setManualNome(aiNome || 'Estudante Não Identificado');
    setManualTurma(aiTurma || 'Sem Turma');
    executeSave(selectedStudentId ? Number(selectedStudentId) : null, aiNome, aiTurma || 'Sem Turma');
  };

  // Executar salvamento da conferência
  const executeSave = async (userIdToSave, nomeToSave, turmaToSave) => {
    if (!currentRedacao) return;

    setIsSaving(true);
    setFeedbackMsg(null);

    try {
      const finalNome = (nomeToSave || manualNome).trim() || 'Estudante Não Identificado';
      const finalTurma = (turmaToSave || manualTurma).trim() || 'Sem Turma';
      const finalUserId = userIdToSave !== undefined 
        ? (userIdToSave ? Number(userIdToSave) : null) 
        : (selectedStudentId ? Number(selectedStudentId) : null);

      const timestamp = new Date().toISOString();

      const payload = {
        user_id: finalUserId,
        nome_aluno: finalNome,
        turma_aluno: finalTurma
      };

      // 1. Atualização otimista imediata no componente pai e cache local
      if (onRedacaoUpdated) {
        onRedacaoUpdated({
          ...currentRedacao,
          user_id: payload.user_id,
          nome_aluno: payload.nome_aluno,
          turma_aluno: payload.turma_aluno,
          nome_detectado: true,
          status_validacao: 'VALIDADA',
          validado_por: 1,
          data_validacao: timestamp
        });
      }

      // 2. Salva no banco de dados / nuvem
      await authService.vincularAluno(currentRedacao.id, payload);

      setFeedbackMsg(`Redação #${currentRedacao.id} conferida e validada com sucesso!`);
      setTimeout(() => setFeedbackMsg(null), 3500);

      // 3. Avança para a próxima se estiver na esteira
      if (currentIndex < filteredRedacoes.length - 1) {
        setCurrentIndex(prev => prev + 1);
      }
    } catch (err) {
      console.error('Erro ao salvar validação:', err);
      setFeedbackMsg(`Erro ao salvar: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAndNext = () => {
    executeSave();
  };

  const currentImageBase64 = currentRedacao ? imagesCache[currentRedacao.id] : null;
  const isCurrentConferida = currentRedacao ? Boolean(currentRedacao.data_validacao || currentRedacao.validado_por) : false;

  // Aluno correspondente selecionado
  const selectedStudentObj = useMemo(() => {
    if (!selectedStudentId) return null;
    return estudantes.find(e => String(e.id) === String(selectedStudentId)) || null;
  }, [selectedStudentId, estudantes]);

  return (
    <div className="space-y-5 animate-fadeIn">
      
      {/* ======================================================== */}
      {/* 1. HEADER PRINCIPAL COM MÉTRICAS DE CONFERÊNCIA REAL    */}
      {/* ======================================================== */}
      <div className="bg-[#ffffff] border border-[#e6e5e0] rounded-xl p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium border border-[#9fc9a2] bg-[#9fc9a2]/15 text-[#1f8a65]">
              <UserCheck className="w-3.5 h-3.5" />
              <span>Conferência Manual do Professor</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-semibold text-[#26251e] tracking-tight">
              Validação Visual de Alunos & Turmas
            </h2>
            <p className="text-xs text-[#807d72] max-w-2xl leading-relaxed">
              Confira a foto da folha manuscrita original, certifique o nome do aluno e confirme a vinculação com a lista escolar em 1 clique.
            </p>
          </div>

          {/* Cards de Métricas Realistas */}
          <div className="flex items-center gap-3 bg-[#fafaf7] border border-[#e6e5e0] p-3 rounded-lg text-xs font-mono shrink-0">
            <div>
              <span className="text-[10px] text-[#807d72] block uppercase font-medium">Conferidas</span>
              <strong className="text-[#1f8a65] text-sm">{conferidasCount} de {totalCount}</strong>
            </div>
            <div className="h-6 w-px bg-[#e6e5e0]" />
            <div>
              <span className="text-[10px] text-[#807d72] block uppercase font-medium">Progresso</span>
              <strong className="text-[#26251e] text-sm">{percentualConcluido}%</strong>
            </div>
            <div className="h-6 w-px bg-[#e6e5e0]" />
            <div>
              <span className="text-[10px] text-[#807d72] block uppercase font-medium">Pendentes</span>
              <strong className="text-[#f54e00] text-sm">{pendentesCount}</strong>
            </div>
          </div>
        </div>

        {/* Barra de Progresso Real */}
        <div className="mt-4 w-full bg-[#e6e5e0] h-2 rounded-full overflow-hidden">
          <div 
            className="bg-[#1f8a65] h-full transition-all duration-500 rounded-full"
            style={{ width: `${percentualConcluido}%` }}
          />
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. BARRA DE FILTROS & ABAS DE NAVEGAÇÃO                  */}
      {/* ======================================================== */}
      <div className="bg-[#fafaf7] border border-[#e6e5e0] p-3.5 rounded-xl flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 shadow-xs">
        
        {/* Toggle Modo: Esteira vs Tabela */}
        <div className="flex items-center gap-1 bg-[#ffffff] border border-[#e6e5e0] p-1 rounded-lg text-xs font-medium">
          <button
            type="button"
            onClick={() => setViewMode('esteira')}
            className={`px-3 py-1.5 rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
              viewMode === 'esteira' ? 'bg-[#26251e] text-white shadow-xs font-semibold' : 'text-[#807d72] hover:text-[#26251e]'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Modo Esteira (Folha Manuscrita)</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('tabela')}
            className={`px-3 py-1.5 rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
              viewMode === 'tabela' ? 'bg-[#26251e] text-white shadow-xs font-semibold' : 'text-[#807d72] hover:text-[#26251e]'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Modo Tabela ({filteredRedacoes.length})</span>
          </button>
        </div>

        {/* Abas de Status e Filtros */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* Abas de Conferência */}
          <div className="flex items-center bg-[#ffffff] border border-[#e6e5e0] p-0.5 rounded-lg text-xs font-mono">
            <button
              type="button"
              onClick={() => { setFilterType('pendentes'); setCurrentIndex(0); }}
              className={`px-2.5 py-1 rounded transition-colors cursor-pointer flex items-center gap-1 ${
                filterType === 'pendentes' ? 'bg-[#f54e00]/15 text-[#f54e00] font-bold' : 'text-[#807d72] hover:text-[#26251e]'
              }`}
            >
              <Clock className="w-3 h-3" />
              <span>Pendentes ({pendentesCount})</span>
            </button>
            <button
              type="button"
              onClick={() => { setFilterType('conferidas'); setCurrentIndex(0); }}
              className={`px-2.5 py-1 rounded transition-colors cursor-pointer flex items-center gap-1 ${
                filterType === 'conferidas' ? 'bg-[#1f8a65]/15 text-[#1f8a65] font-bold' : 'text-[#807d72] hover:text-[#26251e]'
              }`}
            >
              <CheckCircle className="w-3 h-3" />
              <span>Conferidas ({conferidasCount})</span>
            </button>
            <button
              type="button"
              onClick={() => { setFilterType('todas'); setCurrentIndex(0); }}
              className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                filterType === 'todas' ? 'bg-[#26251e] text-white font-bold' : 'text-[#807d72] hover:text-[#26251e]'
              }`}
            >
              <span>Todas ({totalCount})</span>
            </button>
          </div>

          {/* Filtro por Turma */}
          <select
            value={selectedTurmaFilter}
            onChange={(e) => { setSelectedTurmaFilter(e.target.value); setCurrentIndex(0); }}
            className="bg-[#ffffff] border border-[#e6e5e0] px-2.5 py-1.5 rounded-md text-xs text-[#26251e] focus:outline-none cursor-pointer font-mono"
          >
            <option value="todas">Todas as Turmas</option>
            {TURMAS_ESCOLA.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          {/* Busca por Nome/ID */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#807d72] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar aluno ou ID..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentIndex(0); }}
              className="pl-8 pr-2.5 py-1.5 bg-[#ffffff] border border-[#e6e5e0] rounded-md text-xs text-[#26251e] placeholder-[#a09c92] focus:outline-none focus:border-[#26251e] w-40 sm:w-44 font-mono"
            />
          </div>
        </div>

      </div>

      {/* Feedback Toast */}
      {feedbackMsg && (
        <div className="p-3 bg-[#9fc9a2]/20 border border-[#9fc9a2] text-[#1f8a65] text-xs font-mono font-medium rounded-lg flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#1f8a65]" />
            <span>{feedbackMsg}</span>
          </div>
          <button onClick={() => setFeedbackMsg(null)} className="text-[#1f8a65] hover:opacity-75 font-bold cursor-pointer">✕</button>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. MODO ESTEIRA: VISUALIZADOR DA FOLHA & FORMULÁRIO      */}
      {/* ======================================================== */}
      {viewMode === 'esteira' && (
        filteredRedacoes.length === 0 ? (
          <div className="p-12 text-center bg-[#ffffff] border border-[#e6e5e0] rounded-xl space-y-3">
            <CheckCircle2 className="w-10 h-10 text-[#1f8a65] mx-auto" />
            <h3 className="text-base font-semibold text-[#26251e]">
              {filterType === 'pendentes' ? 'Parabéns! Todas as redações foram conferidas.' : 'Nenhuma redação encontrada.'}
            </h3>
            <p className="text-xs text-[#807d72] max-w-md mx-auto">
              {filterType === 'pendentes' 
                ? 'Todas as 50 redações já possuem validação confirmada pelo professor.' 
                : 'Tente alterar os filtros ou o termo de busca.'}
            </p>
            {filterType === 'pendentes' && (
              <button
                type="button"
                onClick={() => setFilterType('todas')}
                className="mt-2 px-4 py-2 bg-[#26251e] text-white text-xs font-mono rounded-lg hover:bg-black cursor-pointer"
              >
                Ver Todas as Redações Conferidas
              </button>
            )}
          </div>
        ) : currentRedacao && (
          <div className="space-y-4">
            
            {/* Navegador Superior & Minimapa #1 a #50 */}
            <div className="bg-[#ffffff] border border-[#e6e5e0] p-3 sm:p-4 rounded-xl shadow-xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-mono text-[#807d72]">Redação</span>
                  <span className="px-2.5 py-1 rounded bg-[#26251e] text-white font-mono font-bold text-xs">
                    {currentIndex + 1} de {filteredRedacoes.length}
                  </span>
                  <span className="text-xs font-mono text-[#807d72]">ID #{currentRedacao.id}</span>
                  
                  <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-[#f54e00]/10 text-[#f54e00] border border-[#f54e00]/20">
                    {currentRedacao.nota_final} pts
                  </span>

                  {isCurrentConferida ? (
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-[#1f8a65]/15 text-[#1f8a65] border border-[#1f8a65]/30 flex items-center gap-1">
                      <Check className="w-3 h-3" /> Conferida pelo Professor
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-[#f54e00]/15 text-[#f54e00] border border-[#f54e00]/30 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Pendente de Conferência
                    </span>
                  )}
                </div>

                {/* Botões de Navegação Anterior / Próxima */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={currentIndex === 0}
                    onClick={() => setCurrentIndex(prev => prev - 1)}
                    className="px-3 py-1.5 border border-[#e6e5e0] bg-[#ffffff] hover:bg-[#fafaf7] text-[#26251e] text-xs rounded-md disabled:opacity-30 cursor-pointer flex items-center gap-1 font-mono font-medium transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" /> Anterior
                  </button>
                  <button
                    type="button"
                    disabled={currentIndex >= filteredRedacoes.length - 1}
                    onClick={() => setCurrentIndex(prev => prev + 1)}
                    className="px-3 py-1.5 border border-[#e6e5e0] bg-[#ffffff] hover:bg-[#fafaf7] text-[#26251e] text-xs rounded-md disabled:opacity-30 cursor-pointer flex items-center gap-1 font-mono font-medium transition-colors"
                  >
                    Próxima <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Minimapa Rápido de Redações (Pular direto para qualquer número) */}
              <div className="pt-2 border-t border-[#f1f5f9]">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 custom-scrollbar">
                  <span className="text-[10px] font-mono text-[#807d72] shrink-0 mr-1">Ir para:</span>
                  {filteredRedacoes.map((r, idx) => {
                    const isConf = Boolean(r.data_validacao || r.validado_por);
                    const isCurrent = idx === currentIndex;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setCurrentIndex(idx)}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold shrink-0 transition-all cursor-pointer ${
                          isCurrent
                            ? 'bg-[#26251e] text-white ring-2 ring-[#f54e00]'
                            : isConf
                              ? 'bg-[#9fc9a2]/30 text-[#1f8a65] border border-[#9fc9a2]'
                              : 'bg-[#fafaf7] text-[#807d72] border border-[#e6e5e0] hover:border-[#26251e]'
                        }`}
                        title={`Redação #${r.id} - ${r.nome_aluno || 'Pendente'}`}
                      >
                        {idx + 1}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Grid Principal: Folha Manuscrita (Esq) vs Painel de Seleção (Dir) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              
              {/* LADO ESQUERDO (7 Colunas): VISUALIZADOR COMPLETO DA FOLHA MANUSCRITA */}
              <div className="lg:col-span-7 bg-[#ffffff] border border-[#e6e5e0] rounded-xl p-4 sm:p-5 space-y-3 shadow-xs">
                
                {/* Barra de Controles da Imagem */}
                <div className="flex items-center justify-between pb-2 border-b border-[#e6e5e0] text-xs">
                  <div className="flex items-center gap-2 font-mono font-medium text-[#26251e]">
                    <ImageIcon className="w-4 h-4 text-[#f54e00]" />
                    <span className="font-semibold">Folha Manuscrita Original</span>
                  </div>

                  {/* Controles de Zoom & Visualização */}
                  <div className="flex items-center gap-1 bg-[#fafaf7] border border-[#e6e5e0] p-1 rounded-md text-xs font-mono">
                    <button
                      type="button"
                      onClick={() => setZoomLevel(prev => Math.min(prev + 0.25, 2.5))}
                      className="p-1 text-[#807d72] hover:text-[#26251e] rounded hover:bg-[#e6e5e0] cursor-pointer"
                      title="Aumentar Zoom (+)"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setZoomLevel(prev => Math.max(prev - 0.25, 0.75))}
                      className="p-1 text-[#807d72] hover:text-[#26251e] rounded hover:bg-[#e6e5e0] cursor-pointer"
                      title="Diminuir Zoom (-)"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setRotation(prev => (prev + 90) % 360)}
                      className="p-1 text-[#807d72] hover:text-[#26251e] rounded hover:bg-[#e6e5e0] cursor-pointer"
                      title="Girar 90°"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setZoomLevel(1);
                        setRotation(0);
                        if (imageContainerRef.current) imageContainerRef.current.scrollTop = 0;
                      }}
                      className="px-2 py-0.5 text-[10px] text-[#807d72] hover:text-[#26251e] rounded hover:bg-[#e6e5e0] cursor-pointer"
                      title="Resetar Zoom e Posição"
                    >
                      100%
                    </button>
                    <div className="h-4 w-px bg-[#e6e5e0] mx-0.5" />
                    <button
                      type="button"
                      onClick={() => setIsFullscreen(true)}
                      className="p-1 text-[#807d72] hover:text-[#26251e] rounded hover:bg-[#e6e5e0] cursor-pointer flex items-center gap-1 text-[11px]"
                      title="Abrir em Tela Cheia"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Expandir</span>
                    </button>
                  </div>
                </div>

                {/* Box da Imagem com Visualização Completa (Sem Cortes) */}
                <div 
                  ref={imageContainerRef}
                  className="relative bg-slate-900 rounded-lg border border-slate-800 h-[680px] overflow-y-auto overflow-x-auto custom-scrollbar p-3 flex flex-col items-center"
                >
                  {isLoadingImage ? (
                    <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-300 text-xs font-mono">
                      <Loader2 className="w-8 h-8 animate-spin text-[#f54e00]" />
                      <span>Carregando folha original em alta resolução...</span>
                    </div>
                  ) : currentImageBase64 ? (
                    <div 
                      className="w-full transition-transform duration-200 origin-top flex flex-col items-center"
                      style={{
                        transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                        transformOrigin: 'top center'
                      }}
                    >
                      {/* Imagem em tamanho completo com sombra de papel */}
                      <img
                        src={currentImageBase64}
                        alt={`Folha da Redação #${currentRedacao.id}`}
                        className="w-full h-auto max-w-none rounded shadow-2xl select-none bg-white"
                        style={{ display: 'block' }}
                      />
                    </div>
                  ) : (
                    /* Fallback caso a redação tenha sido enviada em texto puro */
                    <div className="h-full w-full flex flex-col items-center justify-center p-8 text-center text-slate-300 space-y-3 bg-[#0f172a] rounded">
                      <FileText className="w-10 h-10 text-slate-500" />
                      <p className="text-xs font-mono font-medium">Esta redação foi submetida em texto digitado (sem folha escaneada anexada).</p>
                      <div className="p-4 bg-slate-800 rounded-lg border border-slate-700 text-left font-serif text-xs text-slate-200 max-h-72 overflow-y-auto w-full italic leading-relaxed">
                        "{currentRedacao.texto_digitado || currentRedacao.extracted_data?.texto_transcrito || 'Sem transcrição disponível.'}"
                      </div>
                    </div>
                  )}
                </div>

                {/* Rodapé do Visualizador */}
                <div className="flex items-center justify-between text-[11px] font-mono text-[#807d72] pt-1">
                  <span>Dica: Use o scroll para ver a folha inteira do cabeçalho até o rodapé.</span>
                  <button
                    type="button"
                    onClick={() => onSelectRedacao && onSelectRedacao(currentRedacao)}
                    className="text-[#f54e00] hover:underline flex items-center gap-1 cursor-pointer font-medium"
                  >
                    <span>Abrir Correção Detalhada</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* LADO DIREITO (5 Colunas): PAINEL DE VALIDAÇÃO E SELEÇÃO DE ALUNO */}
              <div className="lg:col-span-5 bg-[#ffffff] border border-[#e6e5e0] rounded-xl p-5 space-y-4 shadow-xs sticky top-4">
                
                <div>
                  <h4 className="text-sm font-semibold text-[#26251e] flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-[#1f8a65]" />
                    <span>Conferir & Selecionar Aluno</span>
                  </h4>
                  <p className="text-xs text-[#807d72] mt-0.5">
                    Associe a folha ao estudante cadastrado para liberar o acesso no portal.
                  </p>
                </div>

                {/* ======================================================= */}
                {/* 1. O QUE A IA DETECTOU + BOTÃO DE 1-CLIQUE              */}
                {/* ======================================================= */}
                <div className="bg-[#fafaf7] border border-[#e6e5e0] p-3.5 rounded-lg space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-[10px] uppercase font-bold text-[#807d72] flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-[#f54e00]" />
                      Leitura Automática da IA:
                    </span>
                    <span className="text-[10px] text-[#807d72]">ID #{currentRedacao.id}</span>
                  </div>

                  <div className="space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[#807d72] font-mono">Nome Lido:</span>
                      <strong className="text-[#26251e] text-right truncate max-w-[200px] font-mono">
                        {currentRedacao.extracted_data?.aluno || currentRedacao.nome_aluno || 'Não identificado'}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[#807d72] font-mono">Turma Lida:</span>
                      <strong className="text-[#26251e] text-right font-mono">
                        {currentRedacao.extracted_data?.turma || currentRedacao.turma_aluno || 'Sem Turma'}
                      </strong>
                    </div>
                  </div>

                  {/* Botão de 1 Clique para Confirmar Leitura da IA */}
                  <button
                    type="button"
                    onClick={handleConfirmAIData}
                    disabled={isSaving}
                    className="w-full mt-1.5 px-3 py-2 bg-[#9fc9a2]/25 hover:bg-[#9fc9a2]/40 border border-[#9fc9a2] text-[#1f8a65] text-xs font-mono font-bold rounded-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>Confirmar Leitura da IA em 1 Clique</span>
                  </button>
                </div>

                {/* ======================================================= */}
                {/* 2. BUSCA RÁPIDA DE ALUNOS CADASTRADOS (700+ ESTUDANTES) */}
                {/* ======================================================= */}
                <div className="space-y-2 pt-1 border-t border-[#e6e5e0]">
                  <label className="text-xs font-mono font-medium text-[#26251e] flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Search className="w-3.5 h-3.5 text-[#807d72]" />
                      <span>Buscar Aluno na Lista da Escola:</span>
                    </span>
                    <span className="text-[10px] text-[#807d72]">({estudantes.length} alunos)</span>
                  </label>
                  
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-[#807d72] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Digite o nome ou e-mail do aluno..."
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      className="w-full pl-9 pr-8 py-2 bg-[#ffffff] border border-[#e6e5e0] rounded-md text-xs text-[#26251e] placeholder-[#a09c92] focus:outline-none focus:border-[#26251e]"
                    />
                    {studentSearch && (
                      <button 
                        onClick={() => setStudentSearch('')} 
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#807d72] hover:text-[#26251e] cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Dropdown de Sugestões em Tempo Real */}
                  {studentSearch.trim() && (
                    <div className="max-h-52 overflow-y-auto custom-scrollbar border border-[#e6e5e0] rounded-lg bg-[#ffffff] divide-y divide-[#f1f5f9] shadow-lg">
                      {filteredEstudantesOptions.length === 0 ? (
                        <div className="p-3 text-xs text-[#807d72] font-mono text-center">
                          Nenhum estudante encontrado com "{studentSearch}".
                        </div>
                      ) : (
                        filteredEstudantesOptions.map(st => (
                          <div
                            key={st.id}
                            onClick={() => handleSelectStudent(st)}
                            className="p-2.5 hover:bg-[#fafaf7] cursor-pointer flex items-center justify-between text-xs transition-colors"
                          >
                            <div className="min-w-0 pr-2">
                              <strong className="text-[#26251e] block truncate">{st.nome}</strong>
                              <span className="text-[10px] text-[#807d72] font-mono truncate block">{st.email}</span>
                            </div>
                            <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-[#e6e5e0] text-[#26251e] shrink-0">
                              {st.turma || 'Sem Turma'}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Badge do Aluno Vinculado */}
                {selectedStudentObj ? (
                  <div className="p-3 bg-[#9fc9a2]/15 border border-[#9fc9a2] rounded-lg text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-[#1f8a65] flex items-center gap-1 font-mono">
                        <Check className="w-3.5 h-3.5" /> Aluno Selecionado:
                      </span>
                      <span className="text-[10px] font-mono font-bold text-[#1f8a65]">ID #{selectedStudentObj.id}</span>
                    </div>
                    <div className="font-semibold text-[#26251e] text-sm">
                      {selectedStudentObj.nome}
                    </div>
                    <div className="text-[11px] text-[#807d72] font-mono flex items-center justify-between">
                      <span>Turma: {selectedStudentObj.turma || manualTurma}</span>
                      <span>{selectedStudentObj.email}</span>
                    </div>
                  </div>
                ) : null}

                {/* ======================================================= */}
                {/* 3. CAMPOS DE NOME & TURMA CONFIRMADOS                   */}
                {/* ======================================================= */}
                <div className="space-y-3 pt-1 border-t border-[#e6e5e0]">
                  <div className="space-y-1">
                    <label className="text-[11px] font-mono text-[#807d72] block">
                      Nome Oficial Confirmado:
                    </label>
                    <input
                      type="text"
                      value={manualNome}
                      onChange={(e) => setManualNome(e.target.value)}
                      placeholder="Nome do aluno..."
                      className="w-full px-3 py-2 bg-[#ffffff] border border-[#e6e5e0] rounded-md text-xs text-[#26251e] font-semibold focus:outline-none focus:border-[#26251e]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-mono text-[#807d72] block">
                      Turma Oficial Confirmada:
                    </label>
                    <select
                      value={manualTurma}
                      onChange={(e) => setManualTurma(e.target.value)}
                      className="w-full px-3 py-2 bg-[#ffffff] border border-[#e6e5e0] rounded-md text-xs text-[#26251e] font-semibold focus:outline-none focus:border-[#26251e] cursor-pointer"
                    >
                      {TURMAS_ESCOLA.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* ======================================================= */}
                {/* 4. BOTÕES PRINCIPAIS DE AÇÃO                            */}
                {/* ======================================================= */}
                <div className="pt-2 border-t border-[#e6e5e0] flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (currentIndex < filteredRedacoes.length - 1) {
                        setCurrentIndex(prev => prev + 1);
                      }
                    }}
                    className="px-3.5 py-2.5 bg-[#ffffff] border border-[#e6e5e0] text-[#5a5852] hover:text-[#26251e] text-xs font-medium rounded-md transition-colors cursor-pointer font-mono"
                  >
                    Pular
                  </button>

                  <button
                    type="button"
                    disabled={isSaving || !manualNome.trim()}
                    onClick={handleSaveAndNext}
                    className="flex-1 px-4 py-2.5 bg-[#1f8a65] hover:bg-[#187052] text-white text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-50 font-mono"
                  >
                    {isSaving ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Salvando...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Validar & Próxima</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>

              </div>

            </div>

          </div>
        )
      )}

      {/* ======================================================== */}
      {/* 4. MODO TABELA GERAL (VISUALIZAÇÃO EM LISTA)             */}
      {/* ======================================================== */}
      {viewMode === 'tabela' && (
        <div className="bg-[#ffffff] border border-[#e6e5e0] rounded-xl overflow-hidden shadow-xs">
          <div className="p-4 border-b border-[#e6e5e0] flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#26251e] flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-[#1f8a65]" />
              <span>Lista Geral de Redações para Conferência</span>
            </h3>
            <span className="text-xs font-mono text-[#807d72]">
              {filteredRedacoes.length} redações nesta lista
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#e6e5e0] bg-[#fafaf7] text-[#807d72] font-mono text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-4 w-16 text-center">ID</th>
                  <th className="py-3 px-4">Estudante Identificado</th>
                  <th className="py-3 px-4">Turma</th>
                  <th className="py-3 px-4 text-center">Conferência do Professor</th>
                  <th className="py-3 px-4 text-right">Nota Final</th>
                  <th className="py-3 px-4 text-center w-36">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f5f9]">
                {filteredRedacoes.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-xs text-[#807d72] font-mono">
                      Nenhuma redação encontrada com os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  filteredRedacoes.map((r, idx) => {
                    const isConf = Boolean(r.data_validacao || r.validado_por);
                    return (
                      <tr key={r.id} className="hover:bg-[#fafaf7] transition-colors">
                        <td className="py-3.5 px-4 text-center font-mono font-bold text-[#807d72]">
                          #{r.id}
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-[#26251e]">
                            {r.nome_aluno || r.extracted_data?.aluno || 'Estudante Não Identificado'}
                          </div>
                          {r.user_id && (
                            <span className="text-[10px] font-mono text-[#1f8a65]">
                              ID de Usuário: #{r.user_id}
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 font-mono text-[#5a5852]">
                          {r.turma_aluno || r.extracted_data?.turma || 'Sem Turma'}
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          {isConf ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#9fc9a2]/30 border border-[#9fc9a2] text-[#1f8a65] inline-flex items-center gap-1">
                              <Check className="w-3 h-3" /> Conferida
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#dfa88f]/30 border border-[#dfa88f] text-[#f54e00] inline-flex items-center gap-1">
                              <Clock className="w-3 h-3" /> Pendente
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-right font-mono font-bold text-[#f54e00]">
                          {r.nota_final} pts
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              setViewMode('esteira');
                              setCurrentIndex(idx);
                            }}
                            className="px-3 py-1 bg-[#ffffff] border border-[#e6e5e0] hover:border-[#26251e] text-[#26251e] text-[11px] font-mono rounded transition-colors cursor-pointer"
                          >
                            Conferir Folha
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 5. MODAL DE TELA CHEIA (FULLSCREEN VIEWER)               */}
      {/* ======================================================== */}
      {isFullscreen && currentRedacao && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex flex-col animate-fadeIn">
          
          {/* Header do Modal */}
          <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-white">
            <div className="flex items-center gap-3">
              <span className="px-2 py-0.5 bg-[#f54e00] text-white font-mono font-bold text-xs rounded">
                Redação #{currentRedacao.id}
              </span>
              <span className="text-sm font-semibold">
                {currentRedacao.nome_aluno || currentRedacao.extracted_data?.aluno || 'Estudante'}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                ({currentRedacao.turma_aluno || currentRedacao.extracted_data?.turma || 'Sem Turma'})
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setZoomLevel(prev => Math.min(prev + 0.25, 3))}
                className="p-1.5 text-slate-300 hover:text-white rounded hover:bg-slate-800 cursor-pointer"
                title="Aumentar Zoom"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setZoomLevel(prev => Math.max(prev - 0.25, 0.5))}
                className="p-1.5 text-slate-300 hover:text-white rounded hover:bg-slate-800 cursor-pointer"
                title="Diminuir Zoom"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setRotation(prev => (prev + 90) % 360)}
                className="p-1.5 text-slate-300 hover:text-white rounded hover:bg-slate-800 cursor-pointer"
                title="Girar"
              >
                <RotateCw className="w-4 h-4" />
              </button>
              <div className="h-4 w-px bg-slate-700 mx-1" />
              <button
                type="button"
                onClick={() => setIsFullscreen(false)}
                className="p-1.5 text-slate-300 hover:text-white rounded hover:bg-slate-800 cursor-pointer"
                title="Fechar Tela Cheia"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Área de Visualização Fullscreen */}
          <div className="flex-1 overflow-auto custom-scrollbar p-6 flex items-start justify-center">
            {currentImageBase64 ? (
              <div 
                className="transition-transform duration-200 origin-top flex justify-center"
                style={{
                  transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                  transformOrigin: 'top center'
                }}
              >
                <img
                  src={currentImageBase64}
                  alt={`Folha #${currentRedacao.id}`}
                  className="max-w-4xl w-full rounded shadow-2xl bg-white"
                />
              </div>
            ) : (
              <div className="text-white text-center p-12">
                <p>Nenhuma imagem disponível para esta redação.</p>
              </div>
            )}
          </div>

          {/* Barra de Ações Rápidas no Rodapé do Fullscreen */}
          <div className="p-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-white text-xs font-mono">
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentIndex === 0}
                onClick={() => setCurrentIndex(prev => prev - 1)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded disabled:opacity-30 cursor-pointer flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" /> Anterior
              </button>
              <button
                type="button"
                disabled={currentIndex >= filteredRedacoes.length - 1}
                onClick={() => setCurrentIndex(prev => prev + 1)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded disabled:opacity-30 cursor-pointer flex items-center gap-1"
              >
                Próxima <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              disabled={isSaving}
              onClick={() => {
                handleSaveAndNext();
                if (currentIndex >= filteredRedacoes.length - 1) {
                  setIsFullscreen(false);
                }
              }}
              className="px-4 py-2 bg-[#1f8a65] hover:bg-[#187052] text-white rounded font-bold cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Validar & Próxima</span>
            </button>
          </div>

        </div>
      )}

    </div>
  );
}
