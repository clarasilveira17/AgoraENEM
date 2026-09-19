import React, { useState, useMemo } from 'react';
import { 
  Trophy, Medal, Award, Crown, Sparkles, TrendingUp, 
  Search, Filter, GraduationCap, ChevronRight, Star,
  Flame, CheckCircle2, User, ArrowUpRight, Lock
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { TURMAS_ESCOLA, normalizeTurma } from '../constants/turmas';

export default function RankingView({ redacoes = [], onSelectRedacao }) {
  const { user, isAdmin } = useAuth();
  const [selectedTurma, setSelectedTurma] = useState('todas');
  const [searchQuery, setSearchQuery] = useState('');
  const [rankingMode, setRankingMode] = useState('alunos'); // 'alunos' | 'redacoes'
  const [sortBy, setSortBy] = useState('maxNota'); // 'maxNota' | 'avgNota' | 'totalRedacoes'

  // Helper para extrair notas das competências ENEM para desempate
  const getComp = (r, key) => {
    const ext = r?.extracted_data || r?.bestRedacao?.extracted_data || {};
    return ext?.avaliacoes?.enem?.[key]?.nota || 0;
  };

  // Filtrar apenas redações corrigidas com nota válida
  const validRedacoes = useMemo(() => {
    return redacoes.filter(r => r.is_synced && r.nota_final !== null && r.nota_final !== undefined);
  }, [redacoes]);

  // Lista de todas as turmas oficiais da escola para filtro (19 turmas)
  const turmasList = TURMAS_ESCOLA;

  // Agrupamento por Aluno (Top 10 Melhores Notas com Critérios Oficiais de Desempate ENEM)
  const rankingAlunos = useMemo(() => {
    const map = new Map();

    validRedacoes.forEach(r => {
      const nome = (r.nome_aluno || r.extracted_data?.aluno || 'Estudante Não Identificado').trim();
      const turma = (r.turma_aluno || r.extracted_data?.turma || 'Geral').trim();
      const nota = Number(r.nota_final || 0);
      const userId = r.user_id;

      const key = userId ? `user_${userId}` : `nome_${nome.toLowerCase()}_turma_${turma.toLowerCase()}`;

      if (!map.has(key)) {
        map.set(key, {
          key,
          nome,
          turma,
          userId,
          redacoes: [],
          maxNota: 0,
          sumNotas: 0,
          bestRedacao: r
        });
      }

      const item = map.get(key);
      item.redacoes.push(r);
      item.sumNotas += nota;
      if (nota >= item.maxNota) {
        item.maxNota = nota;
        item.bestRedacao = r;
      }
    });

    let list = Array.from(map.values()).map(item => ({
      ...item,
      totalRedacoes: item.redacoes.length,
      avgNota: Math.round(item.sumNotas / item.redacoes.length)
    }));

    // Filtro por turma
    if (selectedTurma !== 'todas') {
      list = list.filter(item => item.turma.toLowerCase() === selectedTurma.toLowerCase());
    }

    // Filtro por busca
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(item => item.nome.toLowerCase().includes(q) || item.turma.toLowerCase().includes(q));
    }

    // Ordenação com Critérios de Desempate ENEM:
    list.sort((a, b) => {
      if (sortBy === 'maxNota') {
        if (b.maxNota !== a.maxNota) return b.maxNota - a.maxNota;

        const bC1 = getComp(b.bestRedacao || b, 'competencia_1');
        const aC1 = getComp(a.bestRedacao || a, 'competencia_1');
        if (bC1 !== aC1) return bC1 - aC1;

        const bC4 = getComp(b.bestRedacao || b, 'competencia_4');
        const aC4 = getComp(a.bestRedacao || a, 'competencia_4');
        if (bC4 !== aC4) return bC4 - aC4;

        const bC3 = getComp(b.bestRedacao || b, 'competencia_3');
        const aC3 = getComp(a.bestRedacao || a, 'competencia_3');
        if (bC3 !== aC3) return bC3 - aC3;

        const bC2 = getComp(b.bestRedacao || b, 'competencia_2');
        const aC2 = getComp(a.bestRedacao || a, 'competencia_2');
        if (bC2 !== aC2) return bC2 - aC2;

        const bC5 = getComp(b.bestRedacao || b, 'competencia_5');
        const aC5 = getComp(a.bestRedacao || a, 'competencia_5');
        if (bC5 !== aC5) return bC5 - aC5;

        return a.nome.localeCompare(b.nome);
      }
      if (sortBy === 'avgNota') {
        if (b.avgNota !== a.avgNota) return b.avgNota - a.avgNota;
        return b.maxNota - a.maxNota;
      }
      if (sortBy === 'totalRedacoes') {
        if (b.totalRedacoes !== a.totalRedacoes) return b.totalRedacoes - a.totalRedacoes;
        return b.maxNota - a.maxNota;
      }
      return a.nome.localeCompare(b.nome);
    });

    // Atribuição de Posição com Empate Técnico (Dense Ranking nos 6 Critérios)
    let currentRank = 1;
    const rankedList = [];
    for (let idx = 0; idx < list.length; idx++) {
      const item = list[idx];
      if (idx > 0) {
        const prev = list[idx - 1];
        let isTied = false;
        if (sortBy === 'maxNota') {
          isTied = prev.maxNota === item.maxNota &&
            getComp(prev, 'competencia_1') === getComp(item, 'competencia_1') &&
            getComp(prev, 'competencia_4') === getComp(item, 'competencia_4') &&
            getComp(prev, 'competencia_3') === getComp(item, 'competencia_3') &&
            getComp(prev, 'competencia_2') === getComp(item, 'competencia_2') &&
            getComp(prev, 'competencia_5') === getComp(item, 'competencia_5');
        } else if (sortBy === 'avgNota') {
          isTied = prev.avgNota === item.avgNota && prev.maxNota === item.maxNota;
        } else if (sortBy === 'totalRedacoes') {
          isTied = prev.totalRedacoes === item.totalRedacoes && prev.maxNota === item.maxNota;
        }
        if (!isTied) {
          currentRank += 1;
        }
      }
      rankedList.push({ ...item, rank: currentRank });
    }
    return rankedList.slice(0, 10);
  }, [validRedacoes, selectedTurma, searchQuery, sortBy]);

  // Ranking direto por redações individuais (Top 10 com Dense Ranking)
  const rankingRedacoes = useMemo(() => {
    let list = [...validRedacoes];

    if (selectedTurma !== 'todas') {
      list = list.filter(r => (r.turma_aluno || r.extracted_data?.turma || '').toLowerCase() === selectedTurma.toLowerCase());
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(r => (r.nome_aluno || '').toLowerCase().includes(q) || (r.turma_aluno || '').toLowerCase().includes(q));
    }

    // Ordenação com desempate ENEM
    list.sort((a, b) => {
      if ((b.nota_final || 0) !== (a.nota_final || 0)) {
        return (b.nota_final || 0) - (a.nota_final || 0);
      }
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

      const aName = (a.nome_aluno || '').trim().toLowerCase();
      const bName = (b.nome_aluno || '').trim().toLowerCase();
      return aName.localeCompare(bName);
    });

    // Atribuição de Posição com Empate Técnico (Dense Ranking)
    let currentRank = 1;
    const rankedList = [];
    for (let idx = 0; idx < list.length; idx++) {
      const r = list[idx];
      if (idx > 0) {
        const prev = list[idx - 1];
        const isTied = (prev.nota_final || 0) === (r.nota_final || 0) &&
          getComp(prev, 'competencia_1') === getComp(r, 'competencia_1') &&
          getComp(prev, 'competencia_4') === getComp(r, 'competencia_4') &&
          getComp(prev, 'competencia_3') === getComp(r, 'competencia_3') &&
          getComp(prev, 'competencia_2') === getComp(r, 'competencia_2') &&
          getComp(prev, 'competencia_5') === getComp(r, 'competencia_5');
        if (!isTied) {
          currentRank += 1;
        }
      }
      rankedList.push({ ...r, rank: currentRank });
    }
    return rankedList.slice(0, 10);
  }, [validRedacoes, selectedTurma, searchQuery]);

  // Posição do usuário logado (caso seja estudante)
  const currentStudentRank = useMemo(() => {
    if (isAdmin || !user) return null;
    const cleanUserName = (user.nome || '').toLowerCase().trim();
    const found = rankingAlunos.find(item => 
      (item.userId && Number(item.userId) === Number(user.id)) ||
      (item.nome.toLowerCase().trim() === cleanUserName)
    );
    return found || null;
  }, [rankingAlunos, isAdmin, user]);

  // Top 3 do pódio
  const top1 = rankingMode === 'alunos' ? rankingAlunos[0] : rankingRedacoes[0];
  const top2 = rankingMode === 'alunos' ? rankingAlunos[1] : rankingRedacoes[1];
  const top3 = rankingMode === 'alunos' ? rankingAlunos[2] : rankingRedacoes[2];

  const getMedalColor = (rank) => {
    if (rank === 1) return { bg: 'bg-amber-500/20', text: 'text-amber-500', border: 'border-amber-400', badge: 'bg-amber-500 text-white', label: '1º Lugar' };
    if (rank === 2) return { bg: 'bg-slate-300/30', text: 'text-slate-400', border: 'border-slate-300', badge: 'bg-slate-400 text-white', label: '2º Lugar' };
    if (rank === 3) return { bg: 'bg-amber-700/20', text: 'text-amber-700', border: 'border-amber-600', badge: 'bg-amber-700 text-white', label: '3º Lugar' };
    return { bg: 'bg-[#f7f7f4]', text: 'text-[#807d72]', border: 'border-[#e6e5e0]', badge: 'bg-[#e6e5e0] text-[#26251e]', label: `${rank}º` };
  };

  const getPodiumCardStyle = (rank) => {
    if (rank === 1) {
      return {
        badgeBg: 'bg-amber-500 text-white',
        border: 'border-amber-400',
        bgGradient: 'bg-gradient-to-b from-amber-50/80 to-[#ffffff]',
        iconColor: 'text-amber-600',
        iconBg: 'bg-amber-100 border-2 border-amber-400',
        title: '1º LUGAR',
        IconComp: Crown
      };
    }
    if (rank === 2) {
      return {
        badgeBg: 'bg-slate-400 text-white',
        border: 'border-slate-300',
        bgGradient: 'bg-[#ffffff]',
        iconColor: 'text-slate-500',
        iconBg: 'bg-slate-100 border-2 border-slate-300',
        title: '2º LUGAR',
        IconComp: Medal
      };
    }
    if (rank === 3) {
      return {
        badgeBg: 'bg-amber-700 text-white',
        border: 'border-amber-700/20',
        bgGradient: 'bg-[#ffffff]',
        iconColor: 'text-amber-800',
        iconBg: 'bg-amber-50 border-2 border-amber-700/30',
        title: '3º LUGAR',
        IconComp: Medal
      };
    }
    return {
      badgeBg: 'bg-[#e6e5e0] text-[#26251e]',
      border: 'border-[#e6e5e0]',
      bgGradient: 'bg-[#ffffff]',
      iconColor: 'text-[#807d72]',
      iconBg: 'bg-[#f7f7f4] border-2 border-[#e6e5e0]',
      title: `${rank}º LUGAR`,
      IconComp: Award
    };
  };

  // Helper para verificar se a redação pertence ao aluno logado
  const canViewEssay = (itemOrRedacao) => {
    if (isAdmin) return true;
    if (!user) return false;
    const uId = itemOrRedacao.userId || itemOrRedacao.user_id;
    const sName = (itemOrRedacao.nome || itemOrRedacao.nome_aluno || '').toLowerCase().trim();
    const myName = (user.nome || '').toLowerCase().trim();
    return (uId && Number(uId) === Number(user.id)) || (sName && sName === myName);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header Banner Enxuto */}
      <div className="bg-[#ffffff] border border-[#e6e5e0] rounded-xl p-5 sm:p-6 shadow-xs relative overflow-hidden">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium border border-amber-300 bg-amber-50 text-amber-800">
            <Trophy className="w-3.5 h-3.5 text-amber-600" />
            <span>Quadro Oficial • Top 10 Melhores Notas</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-semibold text-[#26251e] tracking-tight flex items-center gap-2">
            <span>Top 10 Ranking Escolar Ágora ENEM</span>
          </h2>
          <p className="text-xs text-[#807d72] max-w-2xl leading-relaxed">
            Classificação das 10 maiores notas da escola validadas na Matriz ENEM.
          </p>
        </div>
      </div>

      {/* ESTUDANTE: Card de Destaque da Sua Posição */}
      {!isAdmin && currentStudentRank && (
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-2 border-amber-400/50 rounded-xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-500 text-white flex flex-col items-center justify-center font-bold shadow-md shrink-0">
              <Crown className="w-5 h-5 text-amber-100 mb-0.5" />
              <span className="text-base font-mono leading-none">{currentStudentRank.rank}º</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                  Sua Classificação
                </span>
                <span className="text-xs text-[#807d72] font-mono">
                  {currentStudentRank.rank <= 10 ? 'Você está no Top 10 Oficial' : `Posição ${currentStudentRank.rank}º no quadro escolar`}
                </span>
              </div>
              <h3 className="text-lg font-bold text-[#26251e] mt-1">
                {currentStudentRank.nome}
              </h3>
              <p className="text-xs text-[#5a5852] mt-0.5">
                Turma: <strong>{currentStudentRank.turma}</strong> • {currentStudentRank.totalRedacoes} redação(ões) avaliada(s)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-auto">
            <div className="bg-[#ffffff] border border-amber-200 px-4 py-2 rounded-lg text-center shadow-xs">
              <span className="text-[10px] text-[#807d72] uppercase font-mono block">Sua Maior Nota</span>
              <span className="text-xl font-black font-mono text-[#f54e00]">{currentStudentRank.maxNota}</span>
              <span className="text-[10px] text-[#807d72] font-mono"> / 1000</span>
            </div>

            <div className="bg-[#ffffff] border border-amber-200 px-4 py-2 rounded-lg text-center shadow-xs">
              <span className="text-[10px] text-[#807d72] uppercase font-mono block">Sua Média</span>
              <span className="text-xl font-black font-mono text-[#26251e]">{currentStudentRank.avgNota}</span>
              <span className="text-[10px] text-[#807d72] font-mono"> / 1000</span>
            </div>
          </div>
        </div>
      )}

      {/* PÓDIO TOP 3 VISUAL */}
      {rankingAlunos.length > 0 && (
        <div className="space-y-2">
          {top1 && top2 && top1.rank === 1 && top2.rank === 1 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 text-xs text-amber-900 font-mono flex items-center justify-center gap-2 text-center">
              <span><strong>Empate Técnico Oficial:</strong> Alunos com notas idênticas em todos os critérios da matriz ENEM dividem o 1º lugar do pódio.</span>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end pt-2 pb-2">
            
            {/* 2º ALUNO (ESQUERDA NO PÓDIO) */}
            {top2 && (() => {
              const style = getPodiumCardStyle(top2.rank);
              const IconComp = style.IconComp;
              return (
                <div 
                  onClick={() => {
                    if (canViewEssay(top2)) onSelectRedacao(top2.bestRedacao || top2);
                  }}
                  className={`${style.bgGradient} border-2 ${style.border} rounded-xl p-4 sm:p-5 flex flex-col items-center text-center relative shadow-sm transition-all order-2 md:order-1 ${
                    canViewEssay(top2) ? 'hover:shadow-md cursor-pointer' : 'cursor-default'
                  }`}
                >
                  <div className={`absolute -top-3.5 ${style.badgeBg} text-[11px] font-mono font-bold px-3 py-0.5 rounded-full flex items-center gap-1 shadow-xs`}>
                    <IconComp className="w-3.5 h-3.5" />
                    {top2.rank === 1 ? '1º LUGAR' : `${top2.rank}º LUGAR`}
                  </div>
                  <div className={`w-12 h-12 rounded-full ${style.iconBg} flex items-center justify-center ${style.iconColor} mb-2 mt-2 shadow-2xs`}>
                    <IconComp className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-sm text-[#26251e] truncate max-w-[200px]">{top2.nome || top2.nome_aluno}</h4>
                  <span className="text-[11px] text-[#807d72] font-mono">{top2.turma || top2.turma_aluno || 'Geral'}</span>
                  
                  <div className="mt-3 w-full pt-3 border-t border-[#e6e5e0] flex justify-around items-center text-xs font-mono">
                    <div>
                      <span className="text-[10px] text-[#807d72] block">MAIOR NOTA</span>
                      <strong className="text-[#f54e00] text-base">{top2.maxNota ?? top2.nota_final}</strong>
                    </div>
                    {top2.avgNota && (
                      <div>
                        <span className="text-[10px] text-[#807d72] block">MÉDIA</span>
                        <strong className="text-[#26251e] text-base">{top2.avgNota}</strong>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* 1º ALUNO (CENTRO & ELEVADO NO PÓDIO) */}
            {top1 && (() => {
              const style = getPodiumCardStyle(top1.rank);
              const IconComp = style.IconComp;
              return (
                <div 
                  onClick={() => {
                    if (canViewEssay(top1)) onSelectRedacao(top1.bestRedacao || top1);
                  }}
                  className={`bg-gradient-to-b from-amber-50/80 to-[#ffffff] border-2 border-amber-400 rounded-2xl p-5 sm:p-6 flex flex-col items-center text-center relative shadow-md transition-all order-1 md:order-2 md:-translate-y-2 ${
                    canViewEssay(top1) ? 'hover:shadow-lg cursor-pointer' : 'cursor-default'
                  }`}
                >
                  <div className="absolute -top-4 bg-amber-500 text-white text-xs font-mono font-bold px-4 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
                    <IconComp className="w-4 h-4 text-amber-200" />
                    {top1.rank === 1 ? (top2?.rank === 1 ? 'CO-CAMPEÃO • 1º LUGAR' : 'CAMPEÃO • 1º LUGAR') : `${top1.rank}º LUGAR`}
                  </div>
                  <div className="w-16 h-16 rounded-full bg-amber-100 border-2 border-amber-400 flex items-center justify-center text-amber-700 mb-2 mt-3 shadow-inner">
                    <Crown className="w-8 h-8 text-amber-600" />
                  </div>
                  <h4 className="font-black text-base text-[#26251e] truncate max-w-[220px]">{top1.nome || top1.nome_aluno}</h4>
                  <span className="text-xs text-[#807d72] font-mono font-medium">{top1.turma || top1.turma_aluno || 'Geral'}</span>
                  
                  <div className="mt-4 w-full pt-3 border-t border-amber-200/60 flex justify-around items-center text-xs font-mono">
                    <div>
                      <span className="text-[10px] text-amber-800 font-bold block">MAIOR NOTA</span>
                      <strong className="text-[#f54e00] text-xl font-black">{top1.maxNota ?? top1.nota_final}</strong>
                    </div>
                    {top1.avgNota && (
                      <div>
                        <span className="text-[10px] text-[#807d72] block">MÉDIA GERAL</span>
                        <strong className="text-[#26251e] text-xl font-black">{top1.avgNota}</strong>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* 3º ALUNO (DIREITA NO PÓDIO) */}
            {top3 && (() => {
              const style = getPodiumCardStyle(top3.rank);
              const IconComp = style.IconComp;
              return (
                <div 
                  onClick={() => {
                    if (canViewEssay(top3)) onSelectRedacao(top3.bestRedacao || top3);
                  }}
                  className={`${style.bgGradient} border-2 ${style.border} rounded-xl p-4 sm:p-5 flex flex-col items-center text-center relative shadow-sm transition-all order-3 ${
                    canViewEssay(top3) ? 'hover:shadow-md cursor-pointer' : 'cursor-default'
                  }`}
                >
                  <div className={`absolute -top-3.5 ${style.badgeBg} text-[11px] font-mono font-bold px-3 py-0.5 rounded-full flex items-center gap-1 shadow-xs`}>
                    <IconComp className="w-3.5 h-3.5" />
                    {top3.rank === 1 ? '1º LUGAR' : `${top3.rank}º LUGAR`}
                  </div>
                  <div className={`w-12 h-12 rounded-full ${style.iconBg} flex items-center justify-center ${style.iconColor} mb-2 mt-2 shadow-2xs`}>
                    <IconComp className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-sm text-[#26251e] truncate max-w-[200px]">{top3.nome || top3.nome_aluno}</h4>
                  <span className="text-[11px] text-[#807d72] font-mono">{top3.turma || top3.turma_aluno || 'Geral'}</span>
                  
                  <div className="mt-3 w-full pt-3 border-t border-[#e6e5e0] flex justify-around items-center text-xs font-mono">
                    <div>
                      <span className="text-[10px] text-[#807d72] block">MAIOR NOTA</span>
                      <strong className="text-[#f54e00] text-base">{top3.maxNota ?? top3.nota_final}</strong>
                    </div>
                    {top3.avgNota && (
                      <div>
                        <span className="text-[10px] text-[#807d72] block">MÉDIA</span>
                        <strong className="text-[#26251e] text-base">{top3.avgNota}</strong>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

          </div>
        </div>
      )}

      {/* BARRA DE FILTROS E PESQUISA */}
      <div className="bg-[#fafaf7] border border-[#e6e5e0] p-4 rounded-xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-xs">
        
        {/* Toggle Alunos / Redações */}
        <div className="flex items-center gap-1 bg-[#ffffff] border border-[#e6e5e0] p-1 rounded-lg text-xs font-medium">
          <button
            type="button"
            onClick={() => setRankingMode('alunos')}
            className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
              rankingMode === 'alunos' ? 'bg-[#26251e] text-white shadow-xs' : 'text-[#807d72] hover:text-[#26251e]'
            }`}
          >
            Top 10 por Estudante
          </button>
          <button
            type="button"
            onClick={() => setRankingMode('redacoes')}
            className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
              rankingMode === 'redacoes' ? 'bg-[#26251e] text-white shadow-xs' : 'text-[#807d72] hover:text-[#26251e]'
            }`}
          >
            Top 10 por Redação
          </button>
        </div>

        {/* Filtros de Turma & Busca */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Turma Dropdown */}
          <div className="flex items-center gap-1.5 bg-[#ffffff] border border-[#e6e5e0] px-2.5 py-1.5 rounded-md text-xs">
            <Filter className="w-3.5 h-3.5 text-[#807d72]" />
            <select
              value={selectedTurma}
              onChange={(e) => setSelectedTurma(e.target.value)}
              className="bg-transparent border-none text-xs text-[#26251e] focus:outline-none cursor-pointer"
            >
              <option value="todas">Todas as Turmas ({turmasList.length})</option>
              {turmasList.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Busca Input */}
          <div className="relative flex-1 sm:w-56">
            <Search className="w-3.5 h-3.5 text-[#807d72] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Pesquisar por nome..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1.5 bg-[#ffffff] border border-[#e6e5e0] rounded-md text-xs text-[#26251e] placeholder-[#a09c92] focus:outline-none focus:border-[#26251e]"
            />
          </div>
        </div>

      </div>

      {/* TABELA DE CLASSIFICAÇÃO TOP 10 */}
      <div className="bg-[#ffffff] border border-[#e6e5e0] rounded-xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-[#e6e5e0] flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#26251e] flex items-center gap-2">
            <Award className="w-4 h-4 text-[#f54e00]" />
            Top 10 Melhores Notas da Escola
          </h3>
          <span className="text-xs font-mono text-[#807d72]">
            {rankingMode === 'alunos' ? `${rankingAlunos.length} classificados` : `${rankingRedacoes.length} classificados`}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#e6e5e0] bg-[#fafaf7] text-[#807d72] font-mono text-[11px] uppercase tracking-wider">
                <th className="py-3 px-4 w-16 text-center">Posição</th>
                <th className="py-3 px-4">Estudante</th>
                <th className="py-3 px-4">Turma</th>
                {rankingMode === 'alunos' ? (
                  <>
                    <th className="py-3 px-4 text-center">Redações</th>
                    <th className="py-3 px-4 text-right">Média Geral</th>
                    <th className="py-3 px-4 text-right">Maior Nota</th>
                  </>
                ) : (
                  <>
                    <th className="py-3 px-4">Data da Avaliação</th>
                    <th className="py-3 px-4 text-right">Nota Final</th>
                  </>
                )}
                <th className="py-3 px-4 w-28 text-center">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9]">
              {rankingMode === 'alunos' ? (
                rankingAlunos.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-xs text-[#807d72] font-mono">
                      Nenhum estudante encontrado com os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  rankingAlunos.map((item) => {
                    const isCurrentUser = !isAdmin && user && (
                      (item.userId && Number(item.userId) === Number(user.id)) ||
                      (item.nome.toLowerCase().trim() === (user.nome || '').toLowerCase().trim())
                    );
                    const isAuthorized = canViewEssay(item);
                    const medal = getMedalColor(item.rank);

                    return (
                      <tr 
                        key={item.key}
                        onClick={() => {
                          if (isAuthorized) onSelectRedacao(item.bestRedacao);
                        }}
                        className={`transition-colors ${
                          isAuthorized ? 'hover:bg-[#fafaf7] cursor-pointer group' : 'cursor-default'
                        } ${isCurrentUser ? 'bg-amber-500/10 font-semibold' : ''}`}
                      >
                        <td className="py-3.5 px-4 text-center font-mono">
                          {item.rank <= 3 ? (
                            <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full font-bold text-xs ${medal.badge}`}>
                              #{item.rank}
                            </span>
                          ) : (
                            <span className="font-bold text-[#807d72] text-xs">
                              #{item.rank}
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <span className={`text-[#26251e] font-semibold text-xs sm:text-sm ${isAuthorized ? 'group-hover:text-[#f54e00]' : ''} transition-colors`}>
                              {item.nome}
                            </span>
                            {isCurrentUser && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-500 text-white uppercase">
                                Você
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-[#807d72] font-mono text-xs">
                          {item.turma}
                        </td>

                        <td className="py-3.5 px-4 text-center font-mono text-xs text-[#5a5852]">
                          {item.totalRedacoes}
                        </td>

                        <td className="py-3.5 px-4 text-right font-mono font-semibold text-[#26251e] text-xs sm:text-sm">
                          {item.avgNota} pts
                        </td>

                        <td className="py-3.5 px-4 text-right font-mono font-bold text-[#f54e00] text-sm sm:text-base">
                          {item.maxNota} pts
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          {isAuthorized ? (
                            <span className="px-2 py-1 rounded bg-[#ffffff] border border-[#e6e5e0] text-[#f54e00] font-mono font-medium text-[10px] hover:bg-[#e6e5e0] inline-flex items-center gap-1 shadow-2xs">
                              Ver Redação <ChevronRight className="w-3 h-3 inline" />
                            </span>
                          ) : (
                            <span className="text-[10px] text-[#a09c92] font-mono inline-flex items-center justify-center gap-1">
                              <Lock className="w-3 h-3" /> Restrito
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )
              ) : (
                rankingRedacoes.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-xs text-[#807d72] font-mono">
                      Nenhuma redação encontrada com os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  rankingRedacoes.map((r) => {
                    const isCurrentUser = !isAdmin && user && (
                      (r.user_id && Number(r.user_id) === Number(user.id)) ||
                      (r.nome_aluno && r.nome_aluno.toLowerCase().trim() === (user.nome || '').toLowerCase().trim())
                    );
                    const isAuthorized = canViewEssay(r);

                    return (
                      <tr 
                        key={r.id}
                        onClick={() => {
                          if (isAuthorized) onSelectRedacao(r);
                        }}
                        className={`transition-colors ${
                          isAuthorized ? 'hover:bg-[#fafaf7] cursor-pointer group' : 'cursor-default'
                        } ${isCurrentUser ? 'bg-amber-500/10 font-semibold' : ''}`}
                      >
                        <td className="py-3.5 px-4 text-center font-mono font-bold text-xs">
                          {r.rank <= 3 ? (
                            <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full font-bold text-xs ${r.rank === 1 ? 'bg-amber-500 text-white' : r.rank === 2 ? 'bg-slate-400 text-white' : 'bg-amber-700 text-white'}`}>
                              #{r.rank}
                            </span>
                          ) : (
                            `#${r.rank}`
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <span className={`text-[#26251e] font-semibold text-xs sm:text-sm ${isAuthorized ? 'group-hover:text-[#f54e00]' : ''} transition-colors`}>
                              {r.nome_aluno || 'Estudante'}
                            </span>
                            {isCurrentUser && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-500 text-white uppercase">
                                Você
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-[#807d72] font-mono text-xs">
                          {r.turma_aluno || r.extracted_data?.turma || 'Geral'}
                        </td>

                        <td className="py-3.5 px-4 text-[#807d72] font-mono text-xs">
                          {new Date(r.data_captura).toLocaleDateString('pt-BR')}
                        </td>

                        <td className="py-3.5 px-4 text-right font-mono font-bold text-[#f54e00] text-sm sm:text-base">
                          {r.nota_final} pts
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          {isAuthorized ? (
                            <span className="px-2 py-1 rounded bg-[#ffffff] border border-[#e6e5e0] text-[#f54e00] font-mono font-medium text-[10px] hover:bg-[#e6e5e0] inline-flex items-center gap-1 shadow-2xs">
                              Ver Redação <ChevronRight className="w-3 h-3 inline" />
                            </span>
                          ) : (
                            <span className="text-[10px] text-[#a09c92] font-mono inline-flex items-center justify-center gap-1">
                              <Lock className="w-3 h-3" /> Restrito
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
