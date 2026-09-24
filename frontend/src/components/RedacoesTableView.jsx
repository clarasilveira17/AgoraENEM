import React, { useState, useMemo } from 'react';
import { FileText, UserX, Award, Trash2, ChevronRight, AlertTriangle, Compass, CheckCircle2, Clock, Filter, X, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { TURMAS_ESCOLA, normalizeTurma } from '../constants/turmas';
import { reprocessarRedacao } from '../services/cloudCorrectionService';

export default function RedacoesTableView({ redacoes, isLoading = false, filterTab, setFilterTab, onSelectRedacao, onDeleteRedacao, searchQuery }) {
  const { isAdmin, isEstudante } = useAuth();
  const [selectedTurma, setSelectedTurma] = useState('todas');

  // Lista de todas as turmas oficiais da escola (19 turmas)
  const turmasList = TURMAS_ESCOLA;

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

      const matchesSearch = !searchQuery.trim() ||
        aluno.toLowerCase().includes(searchQuery.toLowerCase()) ||
        turma.toLowerCase().includes(searchQuery.toLowerCase()) ||
        idStr.includes(searchQuery);

      if (!matchesSearch) return false;

      if (filterTab === 'identificadas') return item.user_id && item.nome_aluno;
      if (filterTab === 'sem_nome') return !item.user_id || !item.nome_aluno;
      if (filterTab === 'excelentes') return item.nota_final >= 800;
      if (filterTab === 'baixas') return item.is_synced && item.nota_final < 600;
      if (filterTab === 'erros') return item.status_validacao === 'ERRO_PROCESSAMENTO';

      return true;
    });
  }, [redacoes, selectedTurma, searchQuery, filterTab]);

  const erroCount = useMemo(() => {
    return redacoes.filter(r => r.status_validacao === 'ERRO_PROCESSAMENTO').length;
  }, [redacoes]);

  return (
    <div className="space-y-4">
      {/* Table Header & Filter Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#ffffff] border border-[#e6e5e0] p-4 rounded-xl">
        <div>
          <h3 className="text-base font-normal text-[#26251e] tracking-tight flex items-center gap-2">
            <Award className="w-4 h-4 text-[#f54e00]" />
            {isAdmin ? `Repositório Geral de Redações (${filteredRedacoes.length})` : `Minhas Redações Avaliadas (${filteredRedacoes.length})`}
          </h3>
          <p className="text-xs text-[#807d72]">
            {isAdmin
              ? 'Tabela analítica de acompanhamento de alunos e notas ENEM / Sisedu'
              : 'Boletim individual de acompanhamento das suas correções validadas'}
          </p>
        </div>

        {/* Filter Controls: Turma Dropdown & Status Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Turma Dropdown */}
          {turmasList.length > 0 && (
            <div className="flex items-center gap-1.5 bg-[#fafaf7] border border-[#e6e5e0] px-2.5 py-1.5 rounded-lg text-xs">
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
                  className="p-0.5 hover:bg-[#e6e5e0] rounded text-[#807d72] hover:text-[#26251e] cursor-pointer ml-1"
                  title="Limpar filtro de turma"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )}

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 custom-scrollbar">
            <button
              onClick={() => setFilterTab('todas')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors ${filterTab === 'todas'
                  ? 'bg-[#26251e] text-white border-[#26251e]'
                  : 'bg-[#fafaf7] border-[#e6e5e0] text-[#5a5852] hover:text-[#26251e]'
                }`}
            >
              Todas ({redacoes.length})
            </button>

            {isAdmin && (
              <>
                <button
                  onClick={() => setFilterTab('identificadas')}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors ${filterTab === 'identificadas'
                      ? 'bg-[#9fc9a2] text-[#26251e] border-[#9fc9a2]'
                      : 'bg-[#fafaf7] border-[#e6e5e0] text-[#5a5852] hover:text-[#26251e]'
                    }`}
                >
                  Com Nome
                </button>
                <button
                  onClick={() => setFilterTab('sem_nome')}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors flex items-center gap-1 ${filterTab === 'sem_nome'
                      ? 'bg-[#dfa88f] text-[#26251e] border-[#dfa88f]'
                      : 'bg-[#fafaf7] border-[#e6e5e0] text-[#5a5852] hover:text-[#26251e]'
                    }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-[#26251e]" />
                  Sem Nome
                </button>
              </>
            )}

            <button
              onClick={() => setFilterTab('excelentes')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors ${filterTab === 'excelentes'
                  ? 'bg-[#c08532] text-white border-[#c08532]'
                  : 'bg-[#fafaf7] border-[#e6e5e0] text-[#5a5852] hover:text-[#26251e]'
                }`}
            >
              Notas ≥ 800
            </button>

            {isAdmin && erroCount > 0 && (
              <button
                onClick={() => setFilterTab('erros')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors flex items-center gap-1.5 ${filterTab === 'erros'
                    ? 'bg-red-600 text-white border-red-600'
                    : 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
                  }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                Falhas IA ({erroCount})
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Card List Container */}
      <div className="space-y-2.5">
        {isLoading ? (
          <div className="space-y-2.5 animate-pulse">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="bg-[#ffffff] border border-[#e6e5e0] rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-2 flex-1 w-full">
                  <div className="h-4 bg-[#e6e5e0] rounded-md w-48" />
                  <div className="h-3 bg-[#fafaf7] rounded-md w-32" />
                </div>
                <div className="h-8 bg-[#fafaf7] border border-[#e6e5e0] rounded-lg w-24 shrink-0" />
              </div>
            ))}
          </div>
        ) : filteredRedacoes.length === 0 ? (
          <div className="bg-[#ffffff] border border-[#e6e5e0] rounded-xl p-8 text-center text-[#807d72]">
            <FileText className="w-8 h-8 mx-auto mb-2 text-[#807d72]" aria-hidden="true" />
            {isAdmin
              ? 'Nenhuma redação encontrada para os filtros selecionados.'
              : 'Nenhuma redação validada pelo professor encontrada para a sua conta.'}
          </div>
        ) : (
          filteredRedacoes.map((item) => {
            const isIdentified = item.nome_detectado && item.nome_aluno;
            const isError = item.status_validacao === 'ERRO_PROCESSAMENTO';
            let ext = item.extracted_data || {};
            if (typeof ext === 'string') {
              try { ext = JSON.parse(ext); } catch(e) { ext = {}; }
            }
            const enemObj = ext.avaliacoes?.enem || {};
            const cSum = (Number(enemObj.competencia_1?.nota || 0) +
                          Number(enemObj.competencia_2?.nota || 0) +
                          Number(enemObj.competencia_3?.nota || 0) +
                          Number(enemObj.competencia_4?.nota || 0) +
                          Number(enemObj.competencia_5?.nota || 0));
            const enemScore = (enemObj.competencia_1 || enemObj.competencia_2) ? cSum : (enemObj.nota_total_enem ?? item.nota_final ?? 0);

            return (
              <div
                key={item.id}
                onClick={() => !isError && item.is_synced && onSelectRedacao(item)}
                className={`bg-[#ffffff] hover:bg-[#fafaf7] border ${isError ? 'border-red-300 bg-red-50/20' : 'border-[#e6e5e0] hover:border-[#cfcdc4]'} rounded-xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4 transition-all shadow-2xs ${
                  !isError && item.is_synced ? 'cursor-pointer' : ''
                }`}
              >
                {/* Header Row on Mobile / Left Info on Desktop */}
                <div className="flex items-center justify-between sm:justify-start gap-2 min-w-0">
                  <div className="flex items-center gap-2 min-w-0 flex-1 sm:flex-none">
                    <span className="font-mono text-xs font-bold text-[#807d72] shrink-0">
                      #{String(item.id).padStart(4, '0')}
                    </span>

                    {isIdentified ? (
                      <span className="font-semibold text-xs sm:text-sm text-[#26251e] truncate">
                        {item.nome_aluno}
                      </span>
                    ) : isError ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700 bg-red-100 border border-red-200 px-2 py-0.5 rounded-full shrink-0">
                        <AlertTriangle className="w-3 h-3 text-red-600" />
                        Falha no Gemini
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#c08532] bg-[#dfa88f]/30 border border-[#dfa88f] px-2 py-0.5 rounded-full shrink-0">
                        <UserX className="w-3 h-3 text-[#c08532]" />
                        Sem Nome
                      </span>
                    )}
                  </div>

                  {/* Score Pill on Mobile Header (shown on mobile right, hidden on desktop sm:) */}
                  {!isError && item.is_synced && enemScore !== null && enemScore !== undefined && (
                    <div className="sm:hidden px-2.5 py-0.5 rounded-lg bg-[#fafaf7] border border-[#e6e5e0] text-center font-mono shrink-0">
                      <span className="text-xs font-bold text-[#f54e00]">{enemScore}</span>
                      <span className="text-[9px] text-[#807d72] ml-0.5">pts</span>
                    </div>
                  )}
                </div>

                {/* Secondary Row on Mobile / Subtitle + Actions */}
                <div className="flex items-center justify-between gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#e6e5e0]/60 flex-1">
                  {/* Meta Details: Turma, Data, Status */}
                  <div className="flex items-center gap-1.5 flex-wrap text-xs text-[#807d72] font-mono">
                    {(item.turma_aluno || ext.turma) && (
                      <>
                        <span className="text-xs text-[#5a5852] font-sans font-medium">
                          {item.turma_aluno || ext.turma}
                        </span>
                        <span>•</span>
                      </>
                    )}

                    <span className="text-[11px]">
                      {new Date(item.data_captura).toLocaleDateString('pt-BR')}
                    </span>

                    <span>•</span>

                    {isError ? (
                      <span className="px-2 py-0.5 rounded-full bg-red-100 border border-red-300 text-red-700 text-[9.5px] font-mono font-bold">
                        ERRO PROCESSAMENTO
                      </span>
                    ) : item.is_synced ? (
                      <span className="px-2 py-0.5 rounded-full bg-[#9fc9a2]/40 border border-[#9fc9a2] text-[#1f8a65] text-[9.5px] font-mono font-bold">
                        CORRIGIDO
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-[#dfa88f]/40 border border-[#dfa88f] text-[#cf2d56] text-[9.5px] font-mono font-bold">
                        PENDENTE
                      </span>
                    )}
                  </div>

                  {/* Desktop Score Pill & Action Buttons */}
                  <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {/* Score Pill (Desktop Only) */}
                    {!isError && item.is_synced && enemScore !== null && enemScore !== undefined && (
                      <div className="hidden sm:block px-3 py-1.5 rounded-xl bg-[#fafaf7] border border-[#e6e5e0] text-center font-mono">
                        <span className="text-sm sm:text-base font-bold text-[#f54e00]">{enemScore}</span>
                        <span className="text-[10px] text-[#807d72] ml-0.5 font-normal">pts</span>
                      </div>
                    )}

                    <div className="flex items-center gap-1.5">
                      {isError ? (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await reprocessarRedacao(item.id);
                              alert(`Redação #${item.id} reprocessada com sucesso! Recarregando...`);
                              window.location.reload();
                            } catch (err) {
                              alert(`Erro ao reprocessar: ${err.message}`);
                            }
                          }}
                          className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold text-xs flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                          title="Reprocessar no Gemini"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Tentar Novamente</span>
                        </button>
                      ) : (
                        <>
                          {isAdmin && !item.user_id && (
                            <button
                              type="button"
                              onClick={() => item.is_synced && onSelectRedacao(item)}
                              className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                              title="Vincular a um aluno"
                            >
                              <UserX className="w-3.5 h-3.5" />
                              <span>Vincular Aluno</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => item.is_synced && onSelectRedacao(item)}
                            className="p-1.5 sm:p-2 rounded-lg bg-[#fafaf7] hover:bg-[#e6e5e0] border border-[#e6e5e0] text-[#26251e] transition-colors cursor-pointer"
                            title="Ver Boletim Completo"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </>
                      )}

                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => onDeleteRedacao(item.id)}
                          className="p-1.5 sm:p-2 rounded-lg bg-[#fafaf7] hover:bg-red-50 border border-[#e6e5e0] text-[#807d72] hover:text-[#cf2d56] transition-colors cursor-pointer"
                          title="Excluir Redação"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
