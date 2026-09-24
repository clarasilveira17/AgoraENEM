import React, { useState, useRef, useMemo, useEffect } from 'react';
import { 
  Upload, Database, FileText, CheckCircle2, AlertCircle, 
  Loader2, Image as ImageIcon, Plus, Trash2, Edit3, User, 
  GraduationCap, Sparkles, Filter, X, ChevronRight, AlertTriangle, 
  UserX, Search, CheckCircle, Check, Clock, RefreshCw, BarChart2, Award,
  Copy, Layers, FileSearch, Eye
} from 'lucide-react';
import { processRedacoesCloud } from '../services/cloudCorrectionService';
import { authService } from '../services/authService';
import { useAuth } from '../context/AuthContext';
import { TURMAS_ESCOLA, normalizeTurma } from '../constants/turmas';

export default function GestaoRedacoesView({ 
  redacoes = [], 
  isLoading = false, 
  filterTab = 'todas', 
  setFilterTab, 
  onSelectRedacao, 
  onDeleteRedacao, 
  onRedacaoSaved,
  searchQuery = '',
  setSearchQuery
}) {
  const { user, isAdmin, isEstudante } = useAuth();

  // ==========================================
  // ESTADO DA COLUNA DE ENVIO (ESQUERDA)
  // ==========================================
  const [mode, setMode] = useState('imagem'); // 'imagem' | 'texto'
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [fileStatuses, setFileStatuses] = useState({});
  const [typedText, setTypedText] = useState('');
  const [manualName, setManualName] = useState(isEstudante && user ? user.nome : '');
  const [manualTurma, setManualTurma] = useState(isEstudante && user?.turma ? user.turma : '');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [feedback, setFeedback] = useState(null);
  const fileInputRef = useRef(null);

  // Lista de estudantes para autocompletar
  const [showStudentDropdown, setShowStudentDropdown] = useState(false);
  const [estudantesList, setEstudantesList] = useState([]);

  useEffect(() => {
    let isMounted = true;
    async function loadStudents() {
      try {
        const fetchFn = authService.fetchEstudantes ? authService.fetchEstudantes.bind(authService) : authService.getEstudantes.bind(authService);
        const list = await fetchFn();
        if (isMounted && Array.isArray(list)) {
          setEstudantesList(list);
        }
      } catch (e) {
        console.warn('Erro ao carregar estudantes para autocompletar:', e);
      }
    }
    loadStudents();
    return () => { isMounted = false; };
  }, []);

  const filteredStudentSuggestions = useMemo(() => {
    if (!manualName || !manualName.trim() || manualName.trim().length < 2) return [];
    const q = manualName.toLowerCase().trim();
    return estudantesList.filter(e => 
      (e.nome || '').toLowerCase().includes(q) ||
      (e.email || '').toLowerCase().includes(q)
    ).slice(0, 5);
  }, [estudantesList, manualName]);

  const handleFilesSelected = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const filePromises = files.map((file, idx) => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          resolve({
            id: `img_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 6)}`,
            name: file.name,
            size: (file.size / 1024).toFixed(1) + ' KB',
            base64: ev.target?.result,
            file
          });
        };
        reader.readAsDataURL(file);
      });
    });

    Promise.all(filePromises).then((newFiles) => {
      setSelectedFiles(prev => [...prev, ...newFiles]);
    });
  };

  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleRetrySingleFile = async (file) => {
    setFileStatuses((prev) => ({
      ...prev,
      [file.id]: { status: 'PROCESSING', statusText: 'Reavaliando com Gemini...' }
    }));
    try {
      const res = await processRedacoesCloud(
        [{
          id: file.id,
          name: file.name,
          imagem_base64: file.base64,
          tipo_input: 'imagem',
          nome_manual: manualName.trim() || null,
          turma_manual: manualTurma.trim() || null
        }],
        null,
        {
          usuarioId: isEstudante && user ? user.id : null,
          nomePadrao: isEstudante && user ? user.nome : (manualName || null),
          turmaPadrao: isEstudante && user?.turma ? user.turma : (manualTurma || null)
        }
      );
      const r = (res.results && res.results[0]) || {};
      if (r.status === 'success') {
        setFileStatuses((prev) => ({
          ...prev,
          [file.id]: {
            status: 'SUCCESS',
            nota: r.extracted?.nota_final ?? r.extracted?.avaliacoes?.enem?.nota_total_enem,
            aluno: r.extracted?.aluno
          }
        }));
      } else {
        setFileStatuses((prev) => ({
          ...prev,
          [file.id]: {
            status: 'ERROR',
            error: r.error || 'Falha ao avaliar foto.'
          }
        }));
      }
      if (onRedacaoSaved) onRedacaoSaved();
    } catch (err) {
      setFileStatuses((prev) => ({
        ...prev,
        [file.id]: {
          status: 'ERROR',
          error: err.message
        }
      }));
    }
  };

  const handleStartProcessing = async () => {
    if (mode === 'imagem' && selectedFiles.length === 0) {
      setFeedback({ type: 'error', message: 'Selecione ao menos uma imagem de redação.' });
      return;
    }
    if (mode === 'texto' && (!typedText || typedText.trim().length < 50)) {
      setFeedback({ type: 'error', message: 'O texto da redação deve conter ao menos 50 caracteres.' });
      return;
    }

    setIsProcessing(true);
    setProgressText('Inicializando fila com rate-limiting seguro (~12 req/min)...');
    setFeedback(null);

    // Marca todos os arquivos como pendentes na fila
    if (mode === 'imagem') {
      const initialStatuses = {};
      selectedFiles.forEach((f) => {
        initialStatuses[f.id] = { status: 'PENDING', statusText: 'Na fila' };
      });
      setFileStatuses(initialStatuses);
    }

    try {
      if (mode === 'imagem') {
        const itemsToProcess = selectedFiles.map((f) => ({
          id: f.id,
          name: f.name,
          imagem_base64: f.base64,
          tipo_input: 'imagem',
          nome_manual: manualName.trim() || null,
          turma_manual: manualTurma.trim() || null
        }));

        const res = await processRedacoesCloud(
          itemsToProcess,
          (cur, total, meta) => {
            const data = (typeof cur === 'object' && cur !== null) ? cur : (meta || { currentIndex: cur, total });
            const { currentIndex, total: tot, currentItem, status, attempt, allResults } = data;

            setProgressText(status || `Avaliando foto ${cur} de ${total}...`);

            if (currentItem && currentItem.id) {
              setFileStatuses((prev) => ({
                ...prev,
                [currentItem.id]: {
                  status: status?.includes('Aguardando') || status?.includes('Repetindo') ? 'WAITING_RETRY' : 'PROCESSING',
                  statusText: status,
                  attempt
                }
              }));
            }

            if (Array.isArray(allResults)) {
              allResults.forEach((r) => {
                if (r.id) {
                  setFileStatuses((prev) => ({
                    ...prev,
                    [r.id]: {
                      status: r.status === 'success' ? 'SUCCESS' : 'ERROR',
                      nota: r.extracted?.nota_final ?? r.extracted?.avaliacoes?.enem?.nota_total_enem,
                      aluno: r.extracted?.aluno,
                      error: r.error
                    }
                  }));
                }
              });
            }
          },
          {
            usuarioId: isEstudante && user ? user.id : null,
            nomePadrao: isEstudante && user ? user.nome : (manualName || null),
            turmaPadrao: isEstudante && user?.turma ? user.turma : (manualTurma || null)
          }
        );

        setFeedback({
          type: res.errorCount > 0 && res.successCount === 0 ? 'error' : (res.errorCount > 0 ? 'warning' : 'success'),
          message: res.message || `${res.successCount} redação(ões) processada(s) com sucesso!`
        });
        setSelectedFiles([]);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } else {
        const res = await processRedacoesCloud(
          [{
            texto_digitado: typedText.trim(),
            tipo_input: 'texto',
            nome_manual: isEstudante && user ? user.nome : (manualName.trim() || null),
            turma_manual: isEstudante && user?.turma ? user.turma : (manualTurma.trim() || null),
            user_id: isEstudante && user ? user.id : null
          }],
          null,
          {
            usuarioId: isEstudante && user ? user.id : null,
            nomePadrao: isEstudante && user ? user.nome : (manualName || null),
            turmaPadrao: isEstudante && user?.turma ? user.turma : (manualTurma || null)
          }
        );

        setFeedback({
          type: res.errorCount > 0 && res.successCount === 0 ? 'error' : 'success',
          message: res.message || 'Redação digitada avaliada e salva na nuvem com sucesso!'
        });
        setTypedText('');
        setManualName('');
        setManualTurma('');
      }
      if (onRedacaoSaved) onRedacaoSaved();
    } catch (error) {
      setFeedback({
        type: 'error',
        message: `Erro ao processar: ${error.message || 'Erro desconhecido'}`
      });
    } finally {
      setIsProcessing(false);
      setProgressText('');
    }
  };

  // Aliases for backwards compatibility with existing JSX
  const handleFileSelect = handleFilesSelected;
  const handleRemoveFile = removeFile;
  const handleSaveImages = handleStartProcessing;
  const handleSaveTypedText = handleStartProcessing;

  // Contadores de texto ao vivo
  const wordCount = typedText.trim() ? typedText.split(/\s+/).length : 0;
  const lineCount = typedText.trim() ? typedText.split('\n').length : 0;

  // ==========================================
  // ESTADO DA COLUNA DO BANCO (DIREITA)
  // ==========================================
  const [selectedTurma, setSelectedTurma] = useState('todas');
  const [localSearch, setLocalSearch] = useState(searchQuery || '');

  // Turmas Oficiais da Escola (todas as 19 turmas da Lista Geral dos Alunos)
  const turmasList = TURMAS_ESCOLA;

  // ==========================================
  // DETECÇÃO E AGRUPAMENTO DE DUPLICATAS
  // ==========================================
  const { duplicateGroups, duplicateItemIds, duplicateMap } = useMemo(() => {
    const groupsByStudent = {};
    const groupsByText = {};

    redacoes.forEach((r) => {
      const ext = r.extracted_data || {};
      const rawName = (r.nome_aluno || ext.aluno || '').trim();
      const rawText = (r.texto_digitado || ext.texto_transcrito || '').trim();

      // 1. Agrupamento por Aluno (se tiver nome válido)
      if (rawName && rawName.length >= 3) {
        const normName = rawName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (!groupsByStudent[normName]) {
          groupsByStudent[normName] = {
            key: `aluno_${normName}`,
            type: 'aluno',
            title: rawName,
            turma: r.turma_aluno || ext.turma || '',
            items: []
          };
        }
        groupsByStudent[normName].items.push(r);
      }

      // 2. Agrupamento por Texto idêntico (caso o nome esteja vazio ou inconsistente)
      if (rawText && rawText.length >= 50) {
        const textKey = rawText.slice(0, 100).toLowerCase().replace(/\s+/g, ' ');
        if (!groupsByText[textKey]) {
          groupsByText[textKey] = {
            key: `text_${textKey}`,
            type: 'texto',
            title: rawName || 'Redações com texto idêntico',
            turma: r.turma_aluno || ext.turma || '',
            items: []
          };
        }
        if (!groupsByText[textKey].items.some(it => it.id === r.id)) {
          groupsByText[textKey].items.push(r);
        }
      }
    });

    const finalGroups = [];
    const itemIds = new Set();
    const mapInfo = {};

    // Filtra apenas grupos com 2 ou mais redações
    Object.values(groupsByStudent).forEach((grp) => {
      if (grp.items.length >= 2) {
        // Ordena itens: maior nota primeiro, ou mais recente
        grp.items.sort((a, b) => {
          const scoreA = Number(a.nota_final ?? -1);
          const scoreB = Number(b.nota_final ?? -1);
          if (scoreB !== scoreA) return scoreB - scoreA;
          return new Date(b.data_captura || 0) - new Date(a.data_captura || 0);
        });

        const highestScore = grp.items[0]?.nota_final;
        const latestTime = Math.max(...grp.items.map(it => new Date(it.data_captura || 0).getTime()));

        grp.items.forEach((item, idx) => {
          itemIds.add(item.id);
          const itemTime = new Date(item.data_captura || 0).getTime();
          mapInfo[item.id] = {
            isDuplicate: true,
            totalCount: grp.items.length,
            isHighest: idx === 0 && grp.items.length > 1,
            isLatest: itemTime === latestTime,
            groupKey: grp.key,
            groupTitle: grp.title
          };
        });

        finalGroups.push(grp);
      }
    });

    // Grupos por texto que não foram totalmente cobertos por nome
    Object.values(groupsByText).forEach((grp) => {
      if (grp.items.length >= 2) {
        const alreadyInGroup = grp.items.every(it => itemIds.has(it.id));
        if (!alreadyInGroup) {
          grp.items.sort((a, b) => (Number(b.nota_final ?? -1) - Number(a.nota_final ?? -1)));
          grp.items.forEach((item, idx) => {
            itemIds.add(item.id);
            if (!mapInfo[item.id]) {
              mapInfo[item.id] = {
                isDuplicate: true,
                totalCount: grp.items.length,
                isHighest: idx === 0,
                isLatest: false,
                groupKey: grp.key,
                groupTitle: grp.title || 'Texto Idêntico'
              };
            }
          });
          finalGroups.push(grp);
        }
      }
    });

    return {
      duplicateGroups: finalGroups,
      duplicateItemIds: itemIds,
      duplicateMap: mapInfo
    };
  }, [redacoes]);

  // Grupos de duplicatas filtrados por busca e turma
  const filteredDuplicateGroups = useMemo(() => {
    return duplicateGroups.filter((grp) => {
      // Filtro por turma
      if (selectedTurma !== 'todas') {
        const hasMatchingTurma = grp.items.some(it => {
          const t = normalizeTurma(it.turma_aluno || it.extracted_data?.turma || '');
          return t.toLowerCase() === selectedTurma.toLowerCase();
        });
        if (!hasMatchingTurma) return false;
      }

      // Filtro por busca
      const q = localSearch.trim().toLowerCase();
      if (!q) return true;
      const matchTitle = (grp.title || '').toLowerCase().includes(q);
      const matchItem = grp.items.some(it => {
        const ext = it.extracted_data || {};
        const aluno = (it.nome_aluno || ext.aluno || '').toLowerCase();
        const turma = normalizeTurma(it.turma_aluno || ext.turma || '').toLowerCase();
        return aluno.includes(q) || turma.includes(q) || String(it.id).includes(q);
      });
      return matchTitle || matchItem;
    });
  }, [duplicateGroups, selectedTurma, localSearch]);

  // Lista filtrada do banco
  const filteredRedacoes = useMemo(() => {
    return redacoes.filter((item) => {
      const ext = item.extracted_data || {};
      const aluno = item.nome_aluno || ext.aluno || '';
      const turma = normalizeTurma(item.turma_aluno || ext.turma || '');
      const idStr = String(item.id);

      // Filtro por turma
      if (selectedTurma !== 'todas' && turma.toLowerCase() !== selectedTurma.toLowerCase()) {
        return false;
      }

      const q = localSearch.trim().toLowerCase();
      const matchesSearch = !q ||
        aluno.toLowerCase().includes(q) ||
        turma.toLowerCase().includes(q) ||
        idStr.includes(q);

      if (!matchesSearch) return false;

      const isConferida = Boolean(item.data_validacao || item.validado_por);
      const hasName = Boolean(item.user_id && item.nome_aluno);

      if (filterTab === 'identificadas') return hasName;
      if (filterTab === 'sem_nome') return !hasName;
      if (filterTab === 'conferidas') return isConferida;
      if (filterTab === 'pendentes') return !isConferida;
      if (filterTab === 'excelentes') return Number(item.nota_final || 0) >= 800;
      if (filterTab === 'baixas') return item.is_synced && Number(item.nota_final || 0) < 600;
      if (filterTab === 'duplicatas') return duplicateItemIds.has(item.id);

      return true;
    });
  }, [redacoes, selectedTurma, localSearch, filterTab, duplicateItemIds]);

  // Métricas rápidas
  const totalBanco = redacoes.length;
  const semNomeCount = redacoes.filter(r => !r.nome_aluno || !r.user_id).length;
  const comNomeCount = totalBanco - semNomeCount;
  const conferidasCount = redacoes.filter(r => Boolean(r.data_validacao || r.validado_por)).length;
  const totalDuplicatasCount = duplicateItemIds.size;
  
  const mediaNotas = useMemo(() => {
    const valid = redacoes.filter(r => r.nota_final !== null && r.nota_final !== undefined);
    if (valid.length === 0) return 0;
    const sum = valid.reduce((acc, r) => acc + Number(r.nota_final || 0), 0);
    return Math.round(sum / valid.length);
  }, [redacoes]);

  return (
    <div className="space-y-6 animate-fadeIn">
      
      {/* ======================================================== */}
      {/* 1. HEADER PRINCIPAL COM RESUMO DO BANCO                 */}
      {/* ======================================================== */}
      <div className="bg-[#ffffff] border border-[#e6e5e0] rounded-xl p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium border border-[#e6e5e0] bg-[#fafaf7] text-[#26251e]">
              <Database className="w-3.5 h-3.5 text-[#f54e00]" />
              <span>Gestão Integrada de Redações</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-semibold text-[#26251e] tracking-tight">
              {isAdmin ? 'Envio & Banco de Redações' : 'Enviar Redação & Minhas Avaliações'}
            </h2>
            <p className="text-xs text-[#807d72] max-w-2xl leading-relaxed">
              {isAdmin 
                ? 'Lançamento em lote de novas redações para avaliação instantânea e consulta completa ao repositório escolar.'
                : 'Envie sua redação para correção da IA e acompanhe o seu histórico de notas avaliadas.'}
            </p>
          </div>

          {/* Quick Metrics Bar */}
          <div className="flex flex-wrap items-center gap-3 bg-[#fafaf7] border border-[#e6e5e0] p-3 rounded-lg text-xs font-mono shrink-0">
            <div>
              <span className="text-[10px] text-[#807d72] block uppercase">No Banco</span>
              <strong className="text-[#26251e] text-sm">{totalBanco}</strong>
            </div>
            <div className="h-6 w-px bg-[#e6e5e0]" />
            <div>
              <span className="text-[10px] text-[#807d72] block uppercase">Média Geral</span>
              <strong className="text-[#f54e00] text-sm">{mediaNotas} pts</strong>
            </div>
            <div className="h-6 w-px bg-[#e6e5e0]" />
            <div>
              <span className="text-[10px] text-[#807d72] block uppercase">Conferidas</span>
              <strong className="text-[#1f8a65] text-sm">{conferidasCount}</strong>
            </div>
            {isAdmin && totalDuplicatasCount > 0 && (
              <>
                <div className="h-6 w-px bg-[#e6e5e0]" />
                <button
                  type="button"
                  onClick={() => setFilterTab('duplicatas')}
                  className="text-left cursor-pointer hover:opacity-80 transition-opacity"
                  title="Filtrar redações com duplicatas detectadas"
                >
                  <span className="text-[10px] text-[#c08532] block uppercase flex items-center gap-1 font-bold">
                    <Copy className="w-2.5 h-2.5" /> Duplicatas
                  </span>
                  <strong className="text-[#c08532] text-sm font-bold">{totalDuplicatasCount}</strong>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. GRID EM DUAS COLUNAS: ENVIO (ESQ) vs BANCO (DIR)     */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* ======================================================= */}
        {/* COLUNA 1 (5 Colunas): ENVIO E LANÇAMENTO DE REDAÇÕES   */}
        {/* ======================================================= */}
        <div className="lg:col-span-5 bg-[#ffffff] border border-[#e6e5e0] rounded-xl p-5 space-y-4 shadow-xs sticky top-4">
          
          <div className="border-b border-[#e6e5e0] pb-3">
            <h3 className="text-sm font-semibold text-[#26251e] flex items-center gap-2">
              <Upload className="w-4 h-4 text-[#f54e00]" />
              <span>Novo Envio & Lançamento</span>
            </h3>
            <p className="text-xs text-[#807d72] mt-0.5">
              Fotos manuscritas (em lote) ou texto digitado
            </p>
          </div>

          {/* Toggle Modo: Imagem vs Texto */}
          <div className="grid grid-cols-2 gap-2 bg-[#fafaf7] p-1 rounded-lg border border-[#e6e5e0]">
            <button
              type="button"
              onClick={() => setMode('imagem')}
              className={`py-2 px-3 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                mode === 'imagem'
                  ? 'bg-[#26251e] text-white shadow-xs'
                  : 'text-[#807d72] hover:text-[#26251e]'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Fotos / Lote</span>
            </button>

            <button
              type="button"
              onClick={() => setMode('texto')}
              className={`py-2 px-3 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                mode === 'texto'
                  ? 'bg-[#26251e] text-white shadow-xs'
                  : 'text-[#807d72] hover:text-[#26251e]'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Digitar Texto</span>
            </button>
          </div>

          {/* Metadados Opcionais (Nome & Turma) */}
          <div className="space-y-3 pt-1">
            <div className="relative">
              <label className="block text-[11px] font-mono text-[#807d72] mb-1">
                Nome do Aluno (Opcional - IA detecta na folha):
              </label>
              <input
                type="text"
                placeholder={isEstudante ? user?.nome : "Nome do aluno..."}
                value={manualName}
                onChange={(e) => {
                  setManualName(e.target.value);
                  setShowStudentDropdown(true);
                }}
                disabled={isEstudante}
                className="w-full bg-[#fafaf7] border border-[#e6e5e0] rounded-md px-3 py-2 text-xs text-[#26251e] placeholder-[#807d72] focus:outline-none focus:border-[#26251e]"
              />

              {/* Sugestões de Alunos Cadastrados */}
              {showStudentDropdown && filteredStudentSuggestions.length > 0 && !isEstudante && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-[#ffffff] border border-[#e6e5e0] rounded-lg shadow-lg z-20 divide-y divide-[#f1f5f9] max-h-40 overflow-y-auto custom-scrollbar">
                  {filteredStudentSuggestions.map(st => (
                    <div
                      key={st.id}
                      onClick={() => {
                        setManualName(st.nome);
                        if (st.turma) setManualTurma(st.turma);
                        setShowStudentDropdown(false);
                      }}
                      className="p-2 text-xs hover:bg-[#fafaf7] cursor-pointer flex items-center justify-between"
                    >
                      <span className="font-semibold text-[#26251e] truncate">{st.nome}</span>
                      <span className="text-[10px] font-mono text-[#807d72] px-1.5 py-0.5 rounded bg-[#e6e5e0]">
                        {st.turma || 'Sem Turma'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-mono text-[#807d72] mb-1">
                Turma Oficial:
              </label>
              <select
                value={manualTurma}
                onChange={(e) => setManualTurma(e.target.value)}
                disabled={isEstudante && Boolean(user?.turma)}
                className="w-full bg-[#fafaf7] border border-[#e6e5e0] rounded-md px-3 py-2 text-xs text-[#26251e] focus:outline-none focus:border-[#26251e] cursor-pointer font-mono"
              >
                <option value="">Detectar Automaticamente pela IA</option>
                {TURMAS_ESCOLA.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          {/* ======================================================= */}
          {/* MODO FOTO / IMAGEM (UPLOAD EM LOTE)                     */}
          {/* ======================================================= */}
          {mode === 'imagem' && (
            <div className="space-y-3 pt-1">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept="image/*"
                multiple
                className="hidden"
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-[#cfcdc4] hover:border-[#26251e] bg-[#fafaf7] rounded-xl p-5 text-center cursor-pointer transition-all group"
              >
                <ImageIcon className="w-8 h-8 mx-auto text-[#807d72] group-hover:text-[#f54e00] transition-colors mb-2" />
                <p className="text-xs font-semibold text-[#26251e]">
                  Clique para anexar fotos de redação
                </p>
                <p className="text-[11px] text-[#807d72] mt-0.5">
                  Suporta PNG, JPG e WEBP (Uma ou várias)
                </p>
              </div>

              {/* Lista de Arquivos Selecionados */}
              {selectedFiles.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[11px] font-mono text-[#807d72] flex justify-between items-center">
                    <span>{selectedFiles.length} foto(s) selecionada(s)</span>
                    <button
                      type="button"
                      onClick={() => setSelectedFiles([])}
                      className="text-[#cf2d56] hover:underline cursor-pointer"
                    >
                      Limpar
                    </button>
                  </div>

                  <div className="max-h-56 overflow-y-auto space-y-2 custom-scrollbar pr-1">
                    {selectedFiles.map((file, idx) => {
                      const fileStatus = fileStatuses[file.id] || {};
                      const isFileProcessing = fileStatus.status === 'PROCESSING';
                      const isFileWaiting = fileStatus.status === 'WAITING_RETRY';
                      const isFileSuccess = fileStatus.status === 'SUCCESS';
                      const isFileError = fileStatus.status === 'ERROR';

                      return (
                        <div
                          key={file.id || idx}
                          className={`flex items-center justify-between bg-[#ffffff] border ${
                            isFileError ? 'border-red-300 bg-red-50/20' :
                            isFileSuccess ? 'border-emerald-300 bg-emerald-50/20' :
                            isFileProcessing ? 'border-blue-300 bg-blue-50/20 animate-pulse' :
                            'border-[#e6e5e0]'
                          } rounded-lg p-2 text-xs transition-all shadow-2xs`}
                        >
                          <div className="flex items-center gap-2.5 truncate flex-1 min-w-0">
                            {/* Miniatura Real da Foto */}
                            {file.base64 ? (
                              <img
                                src={file.base64}
                                alt={file.name}
                                className="w-10 h-10 object-cover rounded-md border border-[#e6e5e0] shrink-0 bg-[#fafaf7]"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-md bg-[#fafaf7] border border-[#e6e5e0] flex items-center justify-center shrink-0">
                                <ImageIcon className="w-4 h-4 text-[#807d72]" />
                              </div>
                            )}

                            <div className="truncate flex-1 min-w-0">
                              <p className="truncate text-[#26251e] font-mono text-[11px] font-medium leading-tight">
                                {file.name}
                              </p>
                              <p className="text-[10px] font-mono text-[#807d72] mt-0.5">
                                {file.size}
                              </p>
                            </div>
                          </div>

                          {/* Status / Ações da Foto */}
                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            {isFileProcessing && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-blue-100 text-blue-800 border border-blue-200">
                                <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
                                Avaliando...
                              </span>
                            )}

                            {isFileWaiting && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-amber-100 text-amber-800 border border-amber-200">
                                <Clock className="w-3 h-3 text-amber-600" />
                                Aguardando cota
                              </span>
                            )}

                            {isFileSuccess && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                {fileStatus.nota !== undefined ? `${fileStatus.nota} pts` : 'OK'}
                              </span>
                            )}

                            {isFileError && (
                              <div className="flex items-center gap-1.5">
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-mono font-medium bg-red-100 text-red-700 border border-red-200" title={fileStatus.error}>
                                  <AlertTriangle className="w-3 h-3 text-red-600" />
                                  Falha
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleRetrySingleFile(file)}
                                  className="px-2 py-1 rounded bg-red-600 hover:bg-red-700 text-white text-[10px] font-mono font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                                  title="Reprocessar foto no Gemini"
                                >
                                  <RefreshCw className="w-2.5 h-2.5" />
                                  Retry
                                </button>
                              </div>
                            )}

                            {!isProcessing && !isFileSuccess && (
                              <button
                                type="button"
                                onClick={() => handleRemoveFile(idx)}
                                className="text-[#807d72] hover:text-[#cf2d56] p-1 cursor-pointer transition-colors"
                                title="Remover imagem"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Indicador de Segurança de Rate Limit */}
              {selectedFiles.length > 1 && (
                <div className="bg-[#fafaf7] border border-[#e6e5e0] rounded-md px-3 py-1.5 text-[10.5px] font-mono text-[#807d72] flex items-center justify-between">
                  <span>🔒 Taxa Segura: ~12 fotos/min</span>
                  <span className="text-[#1f8a65] font-semibold">Gemini Pacing Ativo</span>
                </div>
              )}

              {/* Botão de Enviar Lote */}
              <button
                type="button"
                disabled={isProcessing || selectedFiles.length === 0}
                onClick={handleSaveImages}
                className="w-full py-2.5 bg-[#f54e00] hover:bg-[#d04200] text-white font-semibold text-xs rounded-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 font-mono shadow-xs"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{progressText || 'Avaliando com IA...'}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Corrigir {selectedFiles.length > 0 ? `${selectedFiles.length} ` : ''}com IA</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* ======================================================= */}
          {/* MODO TEXTO DIGITADO                                     */}
          {/* ======================================================= */}
          {mode === 'texto' && (
            <div className="space-y-3 pt-1">
              <div>
                <div className="flex items-center justify-between mb-1 text-[11px] font-mono text-[#807d72]">
                  <span>Texto da Redação:</span>
                  <div className="flex gap-2">
                    <span>Palavras: <strong className="text-[#26251e]">{wordCount}</strong></span>
                    <span>Linhas: <strong className="text-[#26251e]">{lineCount}</strong></span>
                  </div>
                </div>

                <textarea
                  rows={8}
                  placeholder="Cole ou digite aqui a redação completa..."
                  value={typedText}
                  onChange={(e) => setTypedText(e.target.value)}
                  className="w-full bg-[#fafaf7] border border-[#e6e5e0] rounded-md p-3 text-xs font-mono text-[#26251e] placeholder-[#807d72] focus:outline-none focus:border-[#26251e] custom-scrollbar"
                />
              </div>

              <button
                type="button"
                disabled={isProcessing || !typedText.trim()}
                onClick={handleSaveTypedText}
                className="w-full py-2.5 bg-[#f54e00] hover:bg-[#d04200] text-white font-semibold text-xs rounded-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 font-mono shadow-xs"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Avaliando texto com IA...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Avaliar Redação com IA</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Feedback Toast */}
          {feedback && (
            <div
              className={`p-3 rounded-lg border text-xs flex items-center justify-between animate-fadeIn font-mono ${
                feedback.type === 'success'
                  ? 'bg-[#9fc9a2]/20 border-[#9fc9a2] text-[#1f8a65]'
                  : 'bg-[#dfa88f]/30 border-[#dfa88f] text-[#cf2d56]'
              }`}
            >
              <div className="flex items-center gap-2">
                {feedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-[#1f8a65]" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-[#cf2d56]" />
                )}
                <span>{feedback.message}</span>
              </div>
              <button onClick={() => setFeedback(null)} className="font-bold cursor-pointer">✕</button>
            </div>
          )}

        </div>

        {/* ======================================================= */}
        {/* COLUNA 2 (7 Colunas): BANCO DE REDAÇÕES EXISTENTES      */}
        {/* ======================================================= */}
        <div className="lg:col-span-7 bg-[#ffffff] border border-[#e6e5e0] rounded-xl p-5 space-y-4 shadow-xs">
          
          {/* Cabeçalho do Banco & Controles de Busca */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#e6e5e0] pb-3.5">
            <div>
              <h3 className="text-sm font-semibold text-[#26251e] flex items-center gap-2">
                <Database className="w-4 h-4 text-[#1f8a65]" />
                <span>Repositório de Redações ({filteredRedacoes.length})</span>
              </h3>
              <p className="text-xs text-[#807d72]">
                {isAdmin ? 'Lista completa de redações processadas pela IA' : 'Histórico das suas correções'}
              </p>
            </div>

            {/* Dropdown de Turma */}
            {turmasList.length > 0 && (
              <div className="flex items-center gap-1.5 bg-[#fafaf7] border border-[#e6e5e0] px-2.5 py-1.5 rounded-lg text-xs font-mono">
                <Filter className="w-3.5 h-3.5 text-[#807d72]" />
                <select
                  value={selectedTurma}
                  onChange={(e) => setSelectedTurma(e.target.value)}
                  className="bg-transparent border-none text-xs text-[#26251e] font-medium focus:outline-none cursor-pointer"
                >
                  <option value="todas">Todas as Turmas ({turmasList.length})</option>
                  {turmasList.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                {selectedTurma !== 'todas' && (
                  <button
                    onClick={() => setSelectedTurma('todas')}
                    className="text-[#807d72] hover:text-[#26251e] cursor-pointer ml-1"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Barra de Pesquisa + Pills de Filtro */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-[#807d72] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                aria-label="Pesquisar por aluno, turma ou ID"
                placeholder="Pesquisar por aluno, turma ou ID..."
                value={localSearch}
                onChange={(e) => {
                  setLocalSearch(e.target.value);
                  if (setSearchQuery) setSearchQuery(e.target.value);
                }}
                className="w-full pl-8 pr-3 py-1.5 bg-[#fafaf7] border border-[#e6e5e0] rounded-md text-xs text-[#26251e] placeholder-[#807d72] focus:outline-none focus:border-[#26251e] font-mono"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 custom-scrollbar text-xs font-mono">
              <button
                type="button"
                onClick={() => setFilterTab('todas')}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  filterTab === 'todas'
                    ? 'bg-[#26251e] text-white font-bold'
                    : 'bg-[#fafaf7] border border-[#e6e5e0] text-[#807d72] hover:text-[#26251e]'
                }`}
              >
                Todas ({redacoes.length})
              </button>

              {isAdmin && (
                <>
                  <button
                    type="button"
                    onClick={() => setFilterTab('conferidas')}
                    className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                      filterTab === 'conferidas'
                        ? 'bg-[#1f8a65]/20 text-[#1f8a65] border border-[#1f8a65] font-bold'
                        : 'bg-[#fafaf7] border border-[#e6e5e0] text-[#807d72] hover:text-[#26251e]'
                    }`}
                  >
                    Conferidas ({conferidasCount})
                  </button>

                  <button
                    type="button"
                    onClick={() => setFilterTab('sem_nome')}
                    className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                      filterTab === 'sem_nome'
                        ? 'bg-[#dfa88f]/30 text-[#f54e00] border border-[#dfa88f] font-bold'
                        : 'bg-[#fafaf7] border border-[#e6e5e0] text-[#807d72] hover:text-[#26251e]'
                    }`}
                  >
                    Sem Nome ({semNomeCount})
                  </button>

                  <button
                    type="button"
                    onClick={() => setFilterTab('duplicatas')}
                    className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                      filterTab === 'duplicatas'
                        ? 'bg-[#c08532]/25 text-[#9a641f] border border-[#c08532] font-bold shadow-xs'
                        : totalDuplicatasCount > 0
                        ? 'bg-amber-50/70 border border-amber-300 text-amber-800 hover:bg-amber-100/70 font-semibold'
                        : 'bg-[#fafaf7] border border-[#e6e5e0] text-[#807d72] hover:text-[#26251e]'
                    }`}
                  >
                    <Copy className="w-3 h-3" />
                    <span>Duplicatas ({totalDuplicatasCount})</span>
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => setFilterTab('excelentes')}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  filterTab === 'excelentes'
                    ? 'bg-[#f54e00]/15 text-[#f54e00] border border-[#f54e00] font-bold'
                    : 'bg-[#fafaf7] border border-[#e6e5e0] text-[#807d72] hover:text-[#26251e]'
                }`}
              >
                ≥ 800
              </button>
            </div>
          </div>

          {/* ======================================================= */}
          {/* SEÇÃO DEDICADA DE DUPLICATAS OU LISTA GERAL             */}
          {/* ======================================================= */}
          <div className="space-y-3 max-h-[620px] overflow-y-auto custom-scrollbar pr-1">
            {isLoading ? (
              <div className="space-y-2 animate-pulse">
                {[1, 2, 3, 4, 5].map((n) => (
                  <div key={n} className="bg-[#fafaf7] border border-[#e6e5e0] rounded-lg p-3.5 flex items-center justify-between">
                    <div className="space-y-1.5 flex-1">
                      <div className="h-3.5 bg-[#e6e5e0] rounded w-44" />
                      <div className="h-3 bg-[#e6e5e0]/60 rounded w-28" />
                    </div>
                    <div className="h-7 bg-[#e6e5e0] rounded w-16" />
                  </div>
                ))}
              </div>
            ) : filterTab === 'duplicatas' ? (
              /* ======================================================= */
              /* MODO: SEÇÃO AGRUPADA DE DUPLICATAS                      */
              /* ======================================================= */
              <div className="space-y-4">
                {/* Banner Informativo da Seção */}
                <div className="bg-amber-50/70 border border-amber-200/90 rounded-xl p-3.5 sm:p-4 text-xs font-mono text-amber-950 space-y-1 shadow-2xs">
                  <div className="flex items-center gap-2 font-bold text-amber-900">
                    <Layers className="w-4 h-4 text-[#c08532] shrink-0" />
                    <span>Detecção Inteligente de Duplicatas</span>
                  </div>
                  <p className="text-[11px] text-amber-800/90 leading-relaxed">
                    Foram encontrados <strong>{filteredDuplicateGroups.length} aluno(s)/grupo(s)</strong> com múltiplos envios cadastrados ({totalDuplicatasCount} redações no total). Compare as versões abaixo, mantenha a melhor nota ou a redação conferida e exclua envios duplicados.
                  </p>
                </div>

                {filteredDuplicateGroups.length === 0 ? (
                  <div className="bg-[#fafaf7] border border-[#e6e5e0] rounded-xl p-8 text-center text-[#807d72]">
                    <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-[#1f8a65]" aria-hidden="true" />
                    <p className="text-xs font-semibold text-[#26251e]">Nenhuma duplicata encontrada</p>
                    <p className="text-[11px] text-[#807d72] mt-0.5">
                      {localSearch || selectedTurma !== 'todas'
                        ? 'Nenhuma duplicata corresponde aos filtros aplicados.'
                        : 'Todas as redações no banco pertencem a envios únicos.'}
                    </p>
                  </div>
                ) : (
                  filteredDuplicateGroups.map((group) => {
                    const topScore = group.items[0]?.nota_final;
                    return (
                      <div
                        key={group.key}
                        className="bg-[#ffffff] border border-[#e6e5e0] rounded-xl p-3.5 sm:p-4 space-y-3 shadow-xs hover:border-[#cfcdc4] transition-all"
                      >
                        {/* Cabeçalho do Grupo de Aluno */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#f1f0ea] pb-2.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="p-1 rounded bg-[#fafaf7] border border-[#e6e5e0] text-[#26251e]">
                              <User className="w-3.5 h-3.5 text-[#f54e00]" />
                            </div>
                            <span className="font-bold text-xs text-[#26251e]">
                              {group.title}
                            </span>
                            {group.turma && (
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#fafaf7] border border-[#e6e5e0] text-[#807d72]">
                                {group.turma}
                              </span>
                            )}
                            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                              {group.items.length} envios
                            </span>
                          </div>

                          {topScore !== undefined && topScore !== null && (
                            <div className="text-[11px] font-mono text-[#807d72] sm:text-right">
                              Maior nota: <strong className="text-[#1f8a65] font-bold">{topScore} pts</strong>
                            </div>
                          )}
                        </div>

                        {/* Cards Comparativos dos Envios do Grupo */}
                        <div className="grid grid-cols-1 gap-2.5">
                          {group.items.map((item, itemIdx) => {
                            const isConferida = Boolean(item.data_validacao || item.validado_por);
                            const score = Number(item.nota_final ?? 0);
                            const isHighest = itemIdx === 0 && group.items.length > 1;
                            const textPreview = (item.texto_digitado || item.extracted_data?.texto_transcrito || '').trim();

                            let scoreColor = 'text-[#f54e00] bg-[#f54e00]/10 border-[#f54e00]/20';
                            if (score >= 800) scoreColor = 'text-[#1f8a65] bg-[#1f8a65]/10 border-[#1f8a65]/20';
                            else if (score >= 600) scoreColor = 'text-[#c08532] bg-[#c08532]/10 border-[#c08532]/20';

                            return (
                              <div
                                key={item.id}
                                className={`rounded-lg p-3 border text-xs transition-all ${
                                  isHighest
                                    ? 'bg-[#fafaf7] border-emerald-300/80 shadow-2xs'
                                    : 'bg-[#ffffff] border-[#e6e5e0]'
                                }`}
                              >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                                  
                                  {/* Info Principal */}
                                  <div className="space-y-1 flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-mono text-[11px] font-bold text-[#807d72]">
                                        #{String(item.id).padStart(4, '0')}
                                      </span>

                                      {isHighest && (
                                        <span className="text-[9.5px] font-mono font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 inline-flex items-center gap-0.5">
                                          ★ Maior Nota
                                        </span>
                                      )}

                                      {isConferida ? (
                                        <span className="text-[9.5px] font-mono font-bold px-1.5 py-0.2 rounded bg-[#9fc9a2]/25 text-[#1f8a65] border border-[#9fc9a2] inline-flex items-center gap-0.5">
                                          <Check className="w-2.5 h-2.5" /> Conferida
                                        </span>
                                      ) : (
                                        <span className="text-[9.5px] font-mono font-bold px-1.5 py-0.2 rounded bg-[#f54e00]/10 text-[#f54e00] border border-[#f54e00]/20">
                                          Pendente
                                        </span>
                                      )}

                                      <span className="text-[9.5px] font-mono px-1.5 py-0.2 rounded bg-[#fafaf7] border border-[#e6e5e0] text-[#807d72]">
                                        {item.tipo_input === 'texto' ? 'Texto Digitado' : 'Foto Manuscrita'}
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-2 text-[10.5px] font-mono text-[#807d72]">
                                      <span>{item.turma_aluno || item.extracted_data?.turma || 'Sem Turma'}</span>
                                      <span>•</span>
                                      <span>Envio: {item.data_captura ? new Date(item.data_captura).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'Hoje'}</span>
                                    </div>

                                    {/* Trecho do Texto Transcrito/Digitado */}
                                    {textPreview && (
                                      <p className="text-[11px] text-[#4a483f] line-clamp-2 bg-[#ffffff] p-1.5 rounded border border-[#e6e5e0]/60 font-serif italic mt-1">
                                        "{textPreview}"
                                      </p>
                                    )}
                                  </div>

                                  {/* Nota e Ações */}
                                  <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-1 sm:pt-0">
                                    <div className={`px-2.5 py-1 rounded-md border font-mono font-bold text-xs ${scoreColor}`}>
                                      <span>{score}</span>
                                      <span className="text-[9px] font-normal ml-0.5">pts</span>
                                    </div>

                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => onSelectRedacao && onSelectRedacao(item)}
                                        className="px-2.5 py-1 rounded bg-[#fafaf7] hover:bg-[#e6e5e0] border border-[#e6e5e0] text-[#26251e] text-[11px] font-mono transition-colors cursor-pointer flex items-center gap-1 font-semibold"
                                        title="Abrir Boletim Oficial desta redação"
                                      >
                                        <Eye className="w-3 h-3 text-[#f54e00]" />
                                        <span>Ver</span>
                                      </button>

                                      {isAdmin && onDeleteRedacao && (
                                        <button
                                          type="button"
                                          onClick={() => onDeleteRedacao(item.id)}
                                          className="p-1.5 rounded hover:bg-red-100 text-[#807d72] hover:text-[#cf2d56] transition-colors cursor-pointer border border-transparent hover:border-red-200"
                                          title="Excluir esta duplicata"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  </div>

                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            ) : filteredRedacoes.length === 0 ? (
              <div className="bg-[#fafaf7] border border-[#e6e5e0] rounded-xl p-8 text-center text-[#807d72]">
                <FileText className="w-8 h-8 mx-auto mb-2 text-[#807d72]" aria-hidden="true" />
                <p className="text-xs font-semibold text-[#26251e]">Nenhuma redação encontrada</p>
                <p className="text-[11px] text-[#807d72] mt-0.5">
                  {isAdmin ? 'Envie uma nova redação na coluna ao lado ou ajuste os filtros de busca.' : 'Você ainda não possui redações cadastradas.'}
                </p>
              </div>
            ) : (
              /* ======================================================= */
              /* MODO: LISTAGEM PADRÃO DO BANCO COM BADGES               */
              /* ======================================================= */
              filteredRedacoes.map((item) => {
                const isIdentified = item.nome_detectado && item.nome_aluno;
                const isConferida = Boolean(item.data_validacao || item.validado_por);
                const score = Number(item.nota_final ?? 0);
                const dupInfo = duplicateMap[item.id];

                let scoreColor = 'text-[#f54e00] bg-[#f54e00]/10 border-[#f54e00]/20';
                if (score >= 800) scoreColor = 'text-[#1f8a65] bg-[#1f8a65]/10 border-[#1f8a65]/20';
                else if (score >= 600) scoreColor = 'text-[#c08532] bg-[#c08532]/10 border-[#c08532]/20';

                return (
                  <div
                    key={item.id}
                    onClick={() => item.is_synced && onSelectRedacao && onSelectRedacao(item)}
                    className="bg-[#ffffff] hover:bg-[#fafaf7] border border-[#e6e5e0] hover:border-[#cfcdc4] rounded-lg p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all cursor-pointer shadow-xs group"
                  >
                    {/* Informações Principais */}
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-[#807d72]">
                          #{String(item.id).padStart(4, '0')}
                        </span>

                        {isIdentified ? (
                          <span className="font-semibold text-xs text-[#26251e] truncate">
                            {item.nome_aluno}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#c08532] bg-[#dfa88f]/30 border border-[#dfa88f] px-1.5 py-0.2 rounded">
                            <UserX className="w-3 h-3 text-[#c08532]" />
                            Sem Nome
                          </span>
                        )}

                        {isConferida ? (
                          <span className="text-[9.5px] font-mono font-bold px-1.5 py-0.2 rounded bg-[#9fc9a2]/25 text-[#1f8a65] border border-[#9fc9a2] inline-flex items-center gap-0.5">
                            <Check className="w-2.5 h-2.5" /> Conferida
                          </span>
                        ) : (
                          <span className="text-[9.5px] font-mono font-bold px-1.5 py-0.2 rounded bg-[#f54e00]/10 text-[#f54e00] border border-[#f54e00]/20">
                            Pendente
                          </span>
                        )}

                        {/* Badge de Duplicata Detectada */}
                        {dupInfo?.isDuplicate && (
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              setFilterTab('duplicatas');
                              if (item.nome_aluno) setLocalSearch(item.nome_aluno);
                            }}
                            className="text-[9.5px] font-mono font-medium px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-300 inline-flex items-center gap-1 cursor-pointer hover:bg-amber-200 transition-colors"
                            title="Clique para gerenciar duplicatas deste aluno"
                          >
                            <Copy className="w-2.5 h-2.5" /> Duplicata ({dupInfo.totalCount} envios)
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-[11px] font-mono text-[#807d72]">
                        <span>{item.turma_aluno || item.extracted_data?.turma || 'Sem Turma'}</span>
                        <span>•</span>
                        <span>{item.data_captura ? new Date(item.data_captura).toLocaleDateString('pt-BR') : 'Hoje'}</span>
                      </div>
                    </div>

                    {/* Nota Final & Botões de Ação */}
                    <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <div className={`px-2.5 py-1 rounded-md border font-mono font-bold text-xs ${scoreColor}`}>
                        <span>{score}</span>
                        <span className="text-[9px] font-normal ml-0.5">pts</span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onSelectRedacao && onSelectRedacao(item)}
                          className="px-2 py-1 rounded bg-[#fafaf7] hover:bg-[#e6e5e0] border border-[#e6e5e0] text-[#26251e] text-[11px] font-mono transition-colors cursor-pointer flex items-center gap-1"
                          title="Abrir Boletim Oficial"
                        >
                          <span>Ver</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>

                        {isAdmin && onDeleteRedacao && (
                          <button
                            type="button"
                            onClick={() => onDeleteRedacao(item.id)}
                            className="p-1 rounded hover:bg-red-50 text-[#807d72] hover:text-[#cf2d56] transition-colors cursor-pointer"
                            title="Excluir Redação"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                  </div>
                );
              })
            )}
          </div>

        </div>

      </div>

    </div>
  );
}

