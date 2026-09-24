import React, { useMemo } from 'react';
import { Award, Sparkles, UserCheck, AlertTriangle, FileText, ChevronRight, GraduationCap, PlusCircle, TrendingUp, BarChart3, Trophy, Crown, Medal, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function DashboardView({ redacoes, rankingRedacoes = [], isLoading = false, onSelectRedacao, onNavigateToUpload, onNavigateToRanking, onNavigateToSemNome, onNavigateToDiagnostico }) {
  const { user, isAdmin } = useAuth();

  const totalCount = redacoes.length;
  const correctedList = useMemo(() => {
    return redacoes.filter(r => r.is_synced && r.nota_final !== null && r.nota_final !== undefined);
  }, [redacoes]);
  
  const avgScore = correctedList.length > 0
    ? Math.round(correctedList.reduce((acc, r) => acc + (r.nota_final || 0), 0) / correctedList.length)
    : 0;

  const maxScore = correctedList.length > 0
    ? Math.max(...correctedList.map(r => r.nota_final || 0))
    : 0;

  const latestScore = correctedList.length > 0
    ? (correctedList[0]?.nota_final || 0)
    : 0;

  const identifiedCount = redacoes.filter(r => r.is_synced && r.user_id && r.nome_aluno).length;
  const unidentifiedCount = redacoes.filter(r => r.is_synced && (!r.user_id || !r.nome_aluno)).length;

  // Compute average per ENEM competency C1-C5 (calcula para as redações do aluno ou da escola se for professor)
  const calcCompAvg = (key) => {
    if (correctedList.length === 0) return 0;
    const sum = correctedList.reduce((acc, r) => {
      const c = r.extracted_data?.avaliacoes?.enem?.[key];
      return acc + (c?.nota || 0);
    }, 0);
    return Math.round(sum / correctedList.length);
  };

  const compStats = [
    { code: 'C1', label: 'Norma Culta', avg: calcCompAvg('competencia_1'), color: '#dfa88f' },
    { code: 'C2', label: 'Tema & Repertório', avg: calcCompAvg('competencia_2'), color: '#9fc9a2' },
    { code: 'C3', label: 'Argumentação', avg: calcCompAvg('competencia_3'), color: '#9fbbe0' },
    { code: 'C4', label: 'Coesão', avg: calcCompAvg('competencia_4'), color: '#c0a8dd' },
    { code: 'C5', label: 'Intervenção', avg: calcCompAvg('competencia_5'), color: '#c08532' }
  ];

  // SISEDU Descritores Analytics (D05 a D18)
  const siseduStats = useMemo(() => {
    const descritoresConfig = [
      { code: 'D05', label: 'Interpretação Gráfica/Textual' },
      { code: 'D06', label: 'Identificação do Tema/Tese' },
      { code: 'D12', label: 'Coesão e Substituição Lexical' },
      { code: 'D13', label: 'Localização da Tese Central' },
      { code: 'D14', label: 'Partes Principais/Secundárias' },
      { code: 'D15', label: 'Posições Distintas / Contraposição' },
      { code: 'D16', label: 'Articulação Tese e Argumentos' },
      { code: 'D17', label: 'Escolha Vocabular e Norma Culta' },
      { code: 'D18', label: 'Pontuação e Recursos Expressivos' }
    ];

    if (correctedList.length === 0) {
      return {
        descritores: descritoresConfig.map(d => ({ ...d, adequado: 0, intermediario: 0, inicial: 0, total: 0, pctAdequado: 0 })),
        pctGlobalAdequado: 0,
        pctGlobalIntermediario: 0,
        pctGlobalInicial: 0,
        nivelPredominante: 'Sem Dados'
      };
    }

    let totalAdequado = 0;
    let totalIntermediario = 0;
    let totalInicial = 0;

    const descritores = descritoresConfig.map(desc => {
      let adq = 0, inter = 0, ini = 0;
      correctedList.forEach(r => {
        const dObj = r.extracted_data?.avaliacoes?.sisedu?.descritores?.[desc.code];
        const nivel = (dObj?.nivel || '').trim().toLowerCase();
        if (nivel.includes('adequado')) adq++;
        else if (nivel.includes('intermediario') || nivel.includes('intermediário')) inter++;
        else if (nivel.includes('inicial')) ini++;
        else adq++; // default fallback se validado
      });

      const total = adq + inter + ini || correctedList.length;
      totalAdequado += adq;
      totalIntermediario += inter;
      totalInicial += ini;

      return {
        ...desc,
        adequado: adq,
        intermediario: inter,
        inicial: ini,
        total,
        pctAdequado: Math.round((adq / total) * 100)
      };
    });

    const grandTotal = totalAdequado + totalIntermediario + totalInicial || 1;
    const pctGlobalAdequado = Math.round((totalAdequado / grandTotal) * 100);
    const pctGlobalIntermediario = Math.round((totalIntermediario / grandTotal) * 100);
    const pctGlobalInicial = Math.round((totalInicial / grandTotal) * 100);

    let nivelPredominante = 'Adequado';
    if (pctGlobalInicial >= 30) nivelPredominante = 'Inicial (Atenção)';
    else if (pctGlobalIntermediario > pctGlobalAdequado) nivelPredominante = 'Intermediário';

    return {
      descritores,
      pctGlobalAdequado,
      pctGlobalIntermediario,
      pctGlobalInicial,
      nivelPredominante
    };
  }, [correctedList]);

  // Top 3 Ranking Preview Geral da Escola (baseado no dataset completo de ranking com desempate ENEM)
  const topRanking = useMemo(() => {
    const listToRank = rankingRedacoes && rankingRedacoes.length > 0 ? rankingRedacoes : redacoes;
    const validList = listToRank.filter(r => r.is_synced && r.nota_final !== null && r.nota_final !== undefined);

    const map = new Map();
    validList.forEach(r => {
      const nome = (r.nome_aluno || r.extracted_data?.aluno || 'Estudante').trim();
      const turma = (r.turma_aluno || r.extracted_data?.turma || 'Geral').trim();
      const nota = Number(r.nota_final || 0);
      const userId = r.user_id;
      const key = userId ? `user_${userId}` : `${nome.toLowerCase()}_${turma.toLowerCase()}`;

      if (!map.has(key)) {
        map.set(key, { nome, turma, userId, maxNota: nota, redacao: r });
      } else {
        const item = map.get(key);
        if (nota > item.maxNota) {
          item.maxNota = nota;
          item.redacao = r;
        }
      }
    });

    const getComp = (item, compKey) => {
      const ext = item.redacao?.extracted_data || {};
      return ext?.avaliacoes?.enem?.[compKey]?.nota || 0;
    };

    const sorted = Array.from(map.values()).sort((a, b) => {
      if (b.maxNota !== a.maxNota) return b.maxNota - a.maxNota;
      const bC1 = getComp(b, 'competencia_1');
      const aC1 = getComp(a, 'competencia_1');
      if (bC1 !== aC1) return bC1 - aC1;
      const bC4 = getComp(b, 'competencia_4');
      const aC4 = getComp(a, 'competencia_4');
      if (bC4 !== aC4) return bC4 - aC4;
      const bC3 = getComp(b, 'competencia_3');
      const aC3 = getComp(a, 'competencia_3');
      if (bC3 !== aC3) return bC3 - aC3;
      const bC2 = getComp(b, 'competencia_2');
      const aC2 = getComp(a, 'competencia_2');
      if (bC2 !== aC2) return bC2 - aC2;
      const bC5 = getComp(b, 'competencia_5');
      const aC5 = getComp(a, 'competencia_5');
      if (bC5 !== aC5) return bC5 - aC5;
      return a.nome.localeCompare(b.nome);
    });

    let currentRank = 1;
    return sorted.slice(0, 3).map((item, idx, arr) => {
      if (idx > 0) {
        const prev = arr[idx - 1];
        const isTied = prev.maxNota === item.maxNota &&
          getComp(prev, 'competencia_1') === getComp(item, 'competencia_1') &&
          getComp(prev, 'competencia_4') === getComp(item, 'competencia_4') &&
          getComp(prev, 'competencia_3') === getComp(item, 'competencia_3') &&
          getComp(prev, 'competencia_2') === getComp(item, 'competencia_2') &&
          getComp(prev, 'competencia_5') === getComp(item, 'competencia_5');
        if (!isTied) {
          currentRank += 1;
        }
      }
      return { ...item, rank: currentRank };
    });
  }, [rankingRedacoes, redacoes]);

  return (
    <div className="space-y-5">
      
      {/* Hero Welcome Banner */}
      <div className="bg-[#ffffff] border border-[#e6e5e0] rounded-xl p-5 sm:p-6 shadow-xs relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium border border-[#dfa88f] bg-[#dfa88f]/20 text-[#f54e00]">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isAdmin ? 'Painel do Professor' : 'Portal do Aluno'}</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-semibold text-[#26251e] tracking-tight">
              {isAdmin ? 'Painel Geral de Desempenho' : `Olá, ${user?.nome || 'Estudante'}!`}
            </h2>
            <p className="text-xs text-[#807d72] max-w-xl leading-relaxed">
              {isAdmin
                ? 'Análise textual cruzada baseada na Matriz do ENEM (0-1000) e Rubricas Qualitativas Sisedu.'
                : 'Acompanhe o desempenho detalhado, ranking da turma e as notas das suas redações.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {onNavigateToDiagnostico && (
              <button
                type="button"
                onClick={onNavigateToDiagnostico}
                className="w-full sm:w-auto px-4 py-2.5 border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-medium text-xs rounded-md transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs"
              >
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <span>Painel Feira de Ciências</span>
              </button>
            )}

            {onNavigateToRanking && (
              <button
                type="button"
                onClick={onNavigateToRanking}
                className="w-full sm:w-auto px-4 py-2.5 border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 font-medium text-xs rounded-md transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs"
              >
                <Trophy className="w-4 h-4 text-amber-600" />
                <span>Ver Ranking Geral</span>
              </button>
            )}

            {isAdmin && (
              <button
                type="button"
                onClick={onNavigateToUpload}
                className="w-full sm:w-auto px-4 py-2.5 border border-[#dfa88f] bg-[#dfa88f]/20 hover:bg-[#dfa88f]/40 text-[#f54e00] font-medium text-xs rounded-md transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Nova Correção em Lote</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* SCIENCE FAIR CALLOUT BANNER */}
      {onNavigateToDiagnostico && (
        <div 
          onClick={onNavigateToDiagnostico}
          className="bg-gradient-to-r from-emerald-500/10 via-amber-500/10 to-rose-500/10 border border-emerald-300/80 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs hover:border-emerald-400 transition-all cursor-pointer group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#26251e] group-hover:text-emerald-700 transition-colors">
                  Apresentação Feira de Ciências 2026: Diagnóstico de Defasagem & Melhoria Textual
                </span>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-100 text-emerald-800 uppercase">
                  Novo
                </span>
              </div>
              <p className="text-[11px] text-[#5a5852] mt-0.5">
                Veja o gráfico de onde os alunos mais perdem pontos (defasagem ENEM/SISEDU) e as evidências quantitativas de melhoria das notas.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 text-xs font-mono font-bold text-emerald-800 group-hover:translate-x-1 transition-transform shrink-0">
            <span>Abrir Painel Científico</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </div>
      )}

      {/* ADMIN ATTENTION BANNER: Unlinked Essays Pending */}
      {isAdmin && unidentifiedCount > 0 && onNavigateToSemNome && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-200 border border-amber-400 flex items-center justify-center text-amber-800 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-950 flex items-center gap-1.5">
                <span>{unidentifiedCount} Redação(ões) Aguardando Vínculo</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-200 text-amber-900 uppercase">
                  Ação Necessária
                </span>
              </h4>
              <p className="text-xs text-amber-800 mt-0.5">
                Existem redações avaliadas sem aluno vinculado. Vincule-as à lista oficial de estudantes ou cadastre novos alunos para que eles visualizem a nota.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onNavigateToSemNome}
            className="w-full sm:w-auto px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs shrink-0"
          >
            <span>Resolver Vínculos Pendentes</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main KPI Stat Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 animate-pulse">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="bg-[#ffffff] border border-[#e6e5e0] p-5 rounded-xl space-y-3">
              <div className="h-3 bg-[#e6e5e0] rounded w-24" />
              <div className="h-7 bg-[#fafaf7] rounded w-16" />
              <div className="h-3 bg-[#fafaf7] rounded w-32" />
            </div>
          ))}
        </div>
      ) : isAdmin ? (
        /* Admin KPI Cards */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-[#ffffff] border border-[#e6e5e0] p-4 sm:p-5 rounded-xl hover:border-[#d0cecb] transition-colors shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-[#807d72] uppercase tracking-wider">Total de Redações</span>
              <div className="p-2 rounded-lg bg-[#fafaf7] border border-[#e6e5e0] text-[#5a5852]">
                <FileText className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-bold font-mono text-[#26251e]">{totalCount}</div>
            <div className="text-[11px] text-[#807d72] mt-1 font-mono">{correctedList.length} corrigidas com sucesso</div>
          </div>

          <div className="bg-[#ffffff] border border-[#e6e5e0] p-4 sm:p-5 rounded-xl hover:border-[#d0cecb] transition-colors shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-[#807d72] uppercase tracking-wider">Média Geral ENEM</span>
              <div className="p-2 rounded-lg bg-[#dfa88f]/20 border border-[#dfa88f] text-[#f54e00]">
                <Award className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-bold font-mono text-[#f54e00]">{avgScore > 0 ? avgScore : '—'}</div>
            <div className="text-[11px] text-[#807d72] mt-1 font-mono">escala 0 a 1000 pontos</div>
          </div>

          <div className="bg-[#ffffff] border border-[#e6e5e0] p-4 sm:p-5 rounded-xl hover:border-[#d0cecb] transition-colors shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-[#807d72] uppercase tracking-wider">Alunos Vinculados</span>
              <div className="p-2 rounded-lg bg-[#9fc9a2]/20 border border-[#9fc9a2] text-[#1f8a65]">
                <UserCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-bold font-mono text-[#26251e]">{identifiedCount}</div>
            <div className="text-[11px] text-[#807d72] mt-1 font-mono">vinculados a portal individual</div>
          </div>

          <div 
            onClick={onNavigateToSemNome}
            className={`bg-[#ffffff] border p-4 sm:p-5 rounded-xl transition-all shadow-xs ${
              unidentifiedCount > 0 ? 'border-amber-300 hover:border-amber-400 bg-amber-50/20 cursor-pointer' : 'border-[#e6e5e0]'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-[#807d72] uppercase tracking-wider">Sem Vínculo (Pendentes)</span>
              <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-700">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-bold font-mono text-[#26251e] flex items-center justify-between">
              <span>{unidentifiedCount}</span>
              {unidentifiedCount > 0 && (
                <span className="text-[11px] font-sans font-medium text-amber-700 underline">
                  Vincular ➔
                </span>
              )}
            </div>
            <div className="text-[11px] text-[#807d72] mt-1 font-mono">aguardando vínculo com aluno</div>
          </div>
        </div>
      ) : (
        /* Student KPI Cards */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-[#ffffff] border border-[#e6e5e0] p-4 sm:p-5 rounded-xl hover:border-[#d0cecb] transition-colors shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-[#807d72] uppercase tracking-wider">Redações Validadas</span>
              <div className="p-2 rounded-lg bg-[#9fc9a2]/20 border border-[#9fc9a2] text-[#1f8a65]">
                <GraduationCap className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-bold font-mono text-[#26251e]">{correctedList.length}</div>
            <div className="text-[11px] text-[#807d72] mt-1 font-mono">disponíveis para consulta</div>
          </div>

          <div className="bg-[#ffffff] border border-[#e6e5e0] p-4 sm:p-5 rounded-xl hover:border-[#d0cecb] transition-colors shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-[#807d72] uppercase tracking-wider">Sua Média ENEM</span>
              <div className="p-2 rounded-lg bg-[#dfa88f]/20 border border-[#dfa88f] text-[#f54e00]">
                <Award className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-bold font-mono text-[#f54e00]">{avgScore > 0 ? avgScore : '—'}</div>
            <div className="text-[11px] text-[#807d72] mt-1 font-mono">sua pontuação média</div>
          </div>

          <div className="bg-[#ffffff] border border-[#e6e5e0] p-4 sm:p-5 rounded-xl hover:border-[#d0cecb] transition-colors shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-[#807d72] uppercase tracking-wider">Sua Maior Nota</span>
              <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-600">
                <Sparkles className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-bold font-mono text-[#26251e]">{maxScore > 0 ? maxScore : '—'}</div>
            <div className="text-[11px] text-[#807d72] mt-1 font-mono">melhor resultado</div>
          </div>

          <div className="bg-[#ffffff] border border-[#e6e5e0] p-4 sm:p-5 rounded-xl hover:border-[#d0cecb] transition-colors shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-[#807d72] uppercase tracking-wider">Última Nota</span>
              <div className="p-2 rounded-lg bg-[#fafaf7] border border-[#e6e5e0] text-[#5a5852]">
                <FileText className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-bold font-mono text-[#26251e]">{latestScore > 0 ? latestScore : '—'}</div>
            <div className="text-[11px] text-[#807d72] mt-1 font-mono">avaliação mais recente</div>
          </div>
        </div>
      )}

      {/* TOP 3 RANKING PODIUM PREVIEW (NOVO!) */}
      {topRanking.length > 0 && (
        <div className="bg-[#ffffff] border border-amber-300/80 rounded-xl p-4 sm:p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between pb-2 border-b border-[#e6e5e0]">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm sm:text-base font-semibold text-[#26251e] tracking-tight">
                Top Melhores Notas da Escola
              </h3>
            </div>
            {onNavigateToRanking && (
              <button
                type="button"
                onClick={onNavigateToRanking}
                className="text-xs font-medium text-[#f54e00] hover:text-[#d04200] flex items-center gap-1 cursor-pointer font-mono"
              >
                <span>Ver Ranking Completo</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {topRanking.map((item) => {
              const borderCol = item.rank === 1 ? 'border-amber-300 bg-amber-50/40' : item.rank === 2 ? 'border-slate-200 bg-slate-50/40' : 'border-amber-700/20 bg-amber-50/20';
              const badgeBg = item.rank === 1 ? 'bg-amber-100 text-amber-700 border-amber-300' : item.rank === 2 ? 'bg-slate-100 text-slate-600 border-slate-300' : 'bg-amber-50 text-amber-800 border-amber-700/30';
              const isOwn = user && (
                (item.userId && Number(item.userId) === Number(user.id)) ||
                (user.nome && item.nome && user.nome.trim().toLowerCase() === item.nome.trim().toLowerCase())
              );

              return (
                <div
                  key={`${item.nome}_${item.turma}_${item.rank}`}
                  onClick={() => {
                    if (isAdmin || isOwn) {
                      onSelectRedacao(item.redacao);
                    } else if (onNavigateToRanking) {
                      onNavigateToRanking();
                    }
                  }}
                  className={`p-3 rounded-lg border ${borderCol} flex items-center justify-between hover:shadow-xs transition-all cursor-pointer group`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-8 h-8 rounded-full border ${badgeBg} flex items-center justify-center font-mono font-bold text-xs shrink-0 shadow-2xs`}>
                      {item.rank === 1 ? <Crown className="w-4 h-4 text-amber-600" /> : <Medal className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-[#26251e] truncate group-hover:text-[#f54e00] transition-colors">
                        {item.nome}
                      </div>
                      <div className="text-[10px] font-mono text-[#807d72] truncate">
                        {item.turma}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-sm font-black font-mono text-[#f54e00] block">
                      {item.maxNota} pts
                    </span>
                    <span className="text-[9px] text-[#807d72] font-mono uppercase">
                      {item.rank}º Lugar
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* PAINEL PEDAGÓGICO SISEDU / SPAECE (D05 a D18)            */}
      {/* ======================================================== */}
      <div className="bg-[#ffffff] border border-[#e6e5e0] p-4 sm:p-6 rounded-xl space-y-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#e6e5e0]">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#1f8a65]/10 text-[#1f8a65] border border-[#1f8a65]/20">
              <span>SISEDU & SPAECE 2026</span>
            </div>
            <h3 className="text-base sm:text-lg font-semibold text-[#26251e] tracking-tight flex items-center gap-2">
              <Award className="w-4 h-4 text-[#1f8a65]" />
              {isAdmin ? 'Diagnóstico Escolar de Descritores SISEDU (D05 - D18)' : 'Seu Desempenho nos Descritores SISEDU'}
            </h3>
            <p className="text-xs text-[#807d72]">
              Acompanhamento de proficiência qualitativa em Língua Portuguesa e Produção Textual (Projeto Ágora).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="px-3 py-1.5 bg-[#fafaf7] border border-[#e6e5e0] rounded-lg text-xs font-mono">
              <span className="text-[#807d72]">Nível Global: </span>
              <span className="font-bold text-[#1f8a65]">{siseduStats.nivelPredominante}</span>
            </div>
          </div>
        </div>

        {/* Resumo dos 3 Níveis SPAECE */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 bg-emerald-50/50 border border-emerald-200 rounded-lg space-y-1">
            <div className="flex items-center justify-between text-xs text-emerald-900 font-medium">
              <span>Nível Adequado</span>
              <span className="font-mono font-bold">{siseduStats.pctGlobalAdequado}%</span>
            </div>
            <div className="w-full bg-emerald-100 h-2 rounded-full overflow-hidden">
              <div className="bg-emerald-600 h-full rounded-full transition-all duration-500" style={{ width: `${siseduStats.pctGlobalAdequado}%` }} />
            </div>
            <p className="text-[10px] text-emerald-700">Domínio consolidado das habilidades</p>
          </div>

          <div className="p-3.5 bg-amber-50/50 border border-amber-200 rounded-lg space-y-1">
            <div className="flex items-center justify-between text-xs text-amber-900 font-medium">
              <span>Nível Intermediário</span>
              <span className="font-mono font-bold">{siseduStats.pctGlobalIntermediario}%</span>
            </div>
            <div className="w-full bg-amber-100 h-2 rounded-full overflow-hidden">
              <div className="bg-amber-500 h-full rounded-full transition-all duration-500" style={{ width: `${siseduStats.pctGlobalIntermediario}%` }} />
            </div>
            <p className="text-[10px] text-amber-700">Desenvolvimento parcial dos critérios</p>
          </div>

          <div className="p-3.5 bg-rose-50/50 border border-rose-200 rounded-lg space-y-1">
            <div className="flex items-center justify-between text-xs text-rose-900 font-medium">
              <span>Nível Inicial (Alerta)</span>
              <span className="font-mono font-bold">{siseduStats.pctGlobalInicial}%</span>
            </div>
            <div className="w-full bg-rose-100 h-2 rounded-full overflow-hidden">
              <div className="bg-rose-500 h-full rounded-full transition-all duration-500" style={{ width: `${siseduStats.pctGlobalInicial}%` }} />
            </div>
            <p className="text-[10px] text-rose-700">Exige intervenção e oficina pedagógica</p>
          </div>
        </div>

        {/* Grade Analítica dos 9 Descritores */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
          {siseduStats.descritores.map((desc) => (
            <div key={desc.code} className="bg-[#fafaf7] border border-[#e6e5e0] p-3.5 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded font-mono font-bold text-xs bg-[#26251e] text-white">
                  {desc.code}
                </span>
                <span className="text-xs font-mono font-semibold text-[#1f8a65]">
                  {desc.pctAdequado}% Adequado
                </span>
              </div>
              <div className="text-xs font-semibold text-[#26251e] leading-tight">
                {desc.label}
              </div>
              <div className="flex gap-1 h-1.5 rounded-full overflow-hidden bg-[#e6e5e0]">
                <div style={{ width: `${desc.pctAdequado}%` }} className="bg-emerald-500 h-full" title="Adequado" />
                <div style={{ width: `${Math.round((desc.intermediario / (desc.total || 1)) * 100)}%` }} className="bg-amber-400 h-full" title="Intermediário" />
                <div style={{ width: `${Math.round((desc.inicial / (desc.total || 1)) * 100)}%` }} className="bg-rose-500 h-full" title="Inicial" />
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono text-[#807d72] pt-0.5">
                <span>{desc.adequado} adq</span>
                <span>{desc.intermediario} inter</span>
                <span className={desc.inicial > 0 ? 'text-rose-600 font-bold' : ''}>{desc.inicial} ini</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ENEM Competencies Average Chart */}
      <div className="bg-[#ffffff] border border-[#e6e5e0] p-4 sm:p-5 rounded-xl space-y-4 shadow-xs">
        <div className="flex items-center justify-between pb-2 border-b border-[#e6e5e0]">
          <h3 className="text-sm sm:text-base font-semibold text-[#26251e] tracking-tight flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[#f54e00]" />
            {isAdmin ? 'Média por Competência do ENEM (C1 a C5)' : 'Seu Desempenho por Competência'}
          </h3>
          <span className="text-[11px] font-mono text-[#807d72]">Máx: 200 pts/comp</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {compStats.map((item, idx) => (
            <div key={idx} className="bg-[#fafaf7] border border-[#e6e5e0] p-3.5 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold text-[#f54e00] px-1.5 py-0.5 rounded bg-[#dfa88f]/20 border border-[#dfa88f]/40">
                  {item.code}
                </span>
                <span className="text-xs font-mono font-semibold text-[#26251e]">
                  {item.avg} <span className="text-[10px] text-[#807d72]">/ 200</span>
                </span>
              </div>
              <div className="text-xs font-medium text-[#26251e] truncate">{item.label}</div>
              <div className="w-full bg-[#e6e5e0] h-1.5 rounded-full overflow-hidden">
                <div
                  className="h-full transition-all duration-500 rounded-full"
                  style={{ width: `${(item.avg / 200) * 100}%`, backgroundColor: item.color }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Redações Overview */}
      <div className="bg-[#ffffff] border border-[#e6e5e0] p-4 sm:p-5 rounded-xl space-y-3.5 shadow-xs">
        <div className="flex items-center justify-between pb-2 border-b border-[#e6e5e0]">
          <h3 className="text-sm sm:text-base font-semibold text-[#26251e] tracking-tight flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#807d72]" />
            {isAdmin ? 'Últimas Redações Registradas' : 'Suas Redações Avaliadas'}
          </h3>
          <span className="text-[11px] font-mono text-[#807d72]">{correctedList.length} total</span>
        </div>

        {correctedList.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#807d72] bg-[#fafaf7] rounded-lg border border-[#e6e5e0]">
            {isAdmin
              ? 'Nenhuma redação registrada no momento.'
              : 'Você ainda não possui redações validadas pelo professor.'}
          </div>
        ) : (
          <div className="space-y-1.5">
            {correctedList.slice(0, 5).map((r) => (
              <div
                key={r.id}
                onClick={() => onSelectRedacao(r)}
                className="py-2.5 px-3 flex items-center justify-between hover:bg-[#fafaf7] rounded-lg border border-transparent hover:border-[#e6e5e0] transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="text-xs font-mono font-bold text-[#807d72] shrink-0">
                    #{r.id}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-[#26251e] truncate group-hover:text-[#f54e00] transition-colors">
                      {r.nome_aluno || 'Estudante'}
                    </div>
                    <div className="text-[10px] font-mono text-[#807d72] truncate">
                      {r.turma_aluno || 'Geral'} • {new Date(r.data_captura).toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-[#dfa88f]/20 border border-[#dfa88f] text-[#f54e00]">
                    {r.nota_final} pts
                  </span>
                  <ChevronRight className="w-4 h-4 text-[#807d72] group-hover:text-[#26251e] transition-colors" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
