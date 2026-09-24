import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  AlertTriangle, 
  Award, 
  Sparkles, 
  BarChart3, 
  GraduationCap, 
  Download, 
  Printer, 
  CheckCircle2, 
  HelpCircle, 
  ArrowUpRight, 
  ArrowDownRight, 
  Lightbulb, 
  Target,
  Layers,
  Filter,
  Users,
  Brain
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function DiagnosticoFeiraView({ redacoes = [], rankingRedacoes = [], onSelectRedacao }) {
  const { user, isAdmin } = useAuth();
  const [selectedTurma, setSelectedTurma] = useState('TODAS');
  const [viewMode, setViewMode] = useState('AMBOS'); // 'AMBOS', 'DEFASAGEM', 'MELHORIA'

  // Lista de turmas presentes nos dados
  const turmasDisponiveis = useMemo(() => {
    const list = rankingRedacoes.length > 0 ? rankingRedacoes : redacoes;
    const set = new Set();
    list.forEach(r => {
      const t = (r.turma_aluno || r.extracted_data?.turma || '').trim();
      if (t) set.add(t);
    });
    return ['TODAS', ...Array.from(set).sort()];
  }, [redacoes, rankingRedacoes]);

  // Dataset filtrado
  const filteredList = useMemo(() => {
    const source = (rankingRedacoes.length > 0 ? rankingRedacoes : redacoes)
      .filter(r => r.is_synced && r.nota_final !== null && r.nota_final !== undefined);

    if (selectedTurma === 'TODAS') return source;
    return source.filter(r => {
      const t = (r.turma_aluno || r.extracted_data?.turma || '').trim();
      return t === selectedTurma;
    });
  }, [redacoes, rankingRedacoes, selectedTurma]);

  // ==========================================
  // CÁLCULOS DE DIAGNÓSTICO DE DEFASAGEM
  // ==========================================
  const defasagemStats = useMemo(() => {
    if (filteredList.length === 0) {
      return {
        competencias: [],
        maiorDefasagem: null,
        menorDefasagem: null,
        mediaGeralPerda: 0
      };
    }

    const compConfig = [
      { key: 'competencia_1', code: 'C1', nome: 'Norma Culta & Gramática', max: 200, cor: '#cf2d56' },
      { key: 'competencia_2', code: 'C2', nome: 'Compreensão do Tema & Repertório', max: 200, cor: '#f54e00' },
      { key: 'competencia_3', code: 'C3', nome: 'Argumentação & Projeto de Texto', max: 200, cor: '#c08532' },
      { key: 'competencia_4', code: 'C4', nome: 'Coesão & Recursos Coesivos', max: 200, cor: '#8250df' },
      { key: 'competencia_5', code: 'C5', nome: 'Proposta de Intervenção', max: 200, cor: '#0969da' }
    ];

    const comps = compConfig.map(c => {
      const total = filteredList.reduce((acc, r) => {
        const nota = r.extracted_data?.avaliacoes?.enem?.[c.key]?.nota || 0;
        return acc + nota;
      }, 0);
      const media = Math.round(total / filteredList.length);
      const perdaMedia = 200 - media;
      const pctAproveitamento = Math.round((media / 200) * 100);
      const pctDefasagem = Math.round((perdaMedia / 200) * 100);

      let status = 'ADEQUADO';
      if (media < 120) status = 'CRITICO';
      else if (media < 160) status = 'ALERTA';
      else status = 'BOM';

      return {
        ...c,
        media,
        perdaMedia,
        pctAproveitamento,
        pctDefasagem,
        status
      };
    });

    // Ordena da MAIOR defasagem (maior perda) para a MENOR
    const sortedByLoss = [...comps].sort((a, b) => b.perdaMedia - a.perdaMedia);
    const mediaGeralPerda = Math.round(comps.reduce((acc, c) => acc + c.perdaMedia, 0) / comps.length);

    return {
      competencias: comps,
      ordenadasPorDefasagem: sortedByLoss,
      maiorDefasagem: sortedByLoss[0] || null,
      menorDefasagem: sortedByLoss[sortedByLoss.length - 1] || null,
      mediaGeralPerda
    };
  }, [filteredList]);

  // ==========================================
  // CÁLCULOS DE DIAGNÓSTICO DE DESEMPENHO & FAIXAS
  // ==========================================
  const melhoriaStats = useMemo(() => {
    if (filteredList.length === 0) {
      return {
        faixas: [],
        mediaGlobal: 0,
        taxaAprovacao: 0,
        totalEstudantes: 0
      };
    }

    const notas = filteredList.map(r => Number(r.nota_final || 0));
    const mediaGlobal = Math.round(notas.reduce((a, b) => a + b, 0) / notas.length);

    // Distribuição por Faixas de Nota ENEM
    const faixasConfig = [
      { id: 'elite', label: '900 a 1000 pts', desc: 'Elite / Desempenho de Excelência', min: 900, max: 1000, cor: '#1f8a65', bg: 'bg-emerald-50 text-emerald-900 border-emerald-300' },
      { id: 'avancado', label: '760 a 880 pts', desc: 'Nível Avançado / Muito Bom', min: 760, max: 880, cor: '#0969da', bg: 'bg-blue-50 text-blue-900 border-blue-300' },
      { id: 'intermediario', label: '600 a 740 pts', desc: 'Intermediário / Competente', min: 600, max: 740, cor: '#c08532', bg: 'bg-amber-50 text-amber-900 border-amber-300' },
      { id: 'critico', label: 'Abaixo de 600 pts', desc: 'Zona de Defasagem / Atenção', min: 0, max: 599, cor: '#cf2d56', bg: 'bg-rose-50 text-rose-900 border-rose-300' }
    ];

    const faixas = faixasConfig.map(f => {
      const count = notas.filter(n => n >= f.min && n <= f.max).length;
      const pct = Math.round((count / notas.length) * 100);
      return { ...f, count, pct };
    });

    const taxaAprovacao = Math.round(((faixas[0].count + faixas[1].count) / (notas.length || 1)) * 100);

    return {
      faixas,
      mediaGlobal,
      taxaAprovacao,
      totalEstudantes: filteredList.length
    };
  }, [filteredList]);

  // ==========================================
  // DESCRITORES SISEDU (D05 A D18) - DEFASAGEM
  // ==========================================
  const siseduDefasagem = useMemo(() => {
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

    if (filteredList.length === 0) return [];

    return descritoresConfig.map(desc => {
      let adq = 0, inter = 0, ini = 0;
      filteredList.forEach(r => {
        const dObj = r.extracted_data?.avaliacoes?.sisedu?.descritores?.[desc.code];
        const nivel = (dObj?.nivel || '').trim().toLowerCase();
        if (nivel.includes('adequado')) adq++;
        else if (nivel.includes('intermediario') || nivel.includes('intermediário')) inter++;
        else if (nivel.includes('inicial')) ini++;
        else adq++;
      });
      const total = adq + inter + ini || filteredList.length;
      const pctInicial = Math.round((ini / total) * 100);
      const pctAdequado = Math.round((adq / total) * 100);
      return {
        ...desc,
        adequado: adq,
        intermediario: inter,
        inicial: ini,
        total,
        pctInicial,
        pctAdequado
      };
    }).sort((a, b) => b.pctInicial - a.pctInicial); // Mais críticos primeiro
  }, [filteredList]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      
      {/* ======================================================== */}
      {/* CABEÇALHO CIENTÍFICO DA FEIRA DE CIÊNCIAS                */}
      {/* ======================================================== */}
      <div className="bg-[#ffffff] border border-[#e6e5e0] rounded-2xl p-6 sm:p-7 shadow-xs relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-bold bg-[#f54e00]/10 text-[#f54e00] border border-[#f54e00]/25">
              <Brain className="w-3.5 h-3.5" />
              <span>Painel de Evidências & Feira de Ciências 2026</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#26251e] tracking-tight">
              Diagnóstico Científico: Defasagem & Evolução Textual
            </h1>
            <p className="text-xs sm:text-sm text-[#807d72] max-w-2xl leading-relaxed">
              Mapeamento estatístico de lacunas de aprendizagem (Matriz ENEM & SISEDU), curvas de melhoria e proposição de intervenções pedagógicas baseadas em IA.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {/* Seletor de Turma */}
            <div className="flex items-center gap-1.5 px-3 py-2 bg-[#fafaf7] border border-[#e6e5e0] rounded-lg text-xs font-mono">
              <Filter className="w-3.5 h-3.5 text-[#807d72]" />
              <select
                value={selectedTurma}
                onChange={(e) => setSelectedTurma(e.target.value)}
                className="bg-transparent border-none text-[#26251e] font-semibold focus:outline-none cursor-pointer text-xs"
              >
                {turmasDisponiveis.map(t => (
                  <option key={t} value={t}>
                    {t === 'TODAS' ? 'Escola Toda (Geral)' : `Turma: ${t}`}
                  </option>
                ))}
              </select>
            </div>

            {/* Botão de Impressão / Apresentação */}
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 bg-[#26251e] hover:bg-[#3d3c35] text-white font-medium text-xs rounded-lg transition-all flex items-center gap-2 cursor-pointer shadow-xs"
              title="Exportar Painel para Apresentação"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir / Pôster Feira</span>
            </button>
          </div>
        </div>

        {/* Barra de Filtro de Modo de Visualização */}
        <div className="mt-6 pt-4 border-t border-[#e6e5e0] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 bg-[#fafaf7] p-1 border border-[#e6e5e0] rounded-lg">
            <button
              type="button"
              onClick={() => setViewMode('AMBOS')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                viewMode === 'AMBOS' ? 'bg-[#ffffff] text-[#26251e] shadow-2xs font-bold' : 'text-[#807d72] hover:text-[#26251e]'
              }`}
            >
              Visão Completa (Ambos)
            </button>
            <button
              type="button"
              onClick={() => setViewMode('DEFASAGEM')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                viewMode === 'DEFASAGEM' ? 'bg-[#ffffff] text-[#cf2d56] shadow-2xs font-bold' : 'text-[#807d72] hover:text-[#26251e]'
              }`}
            >
              Foco em Defasagem
            </button>
            <button
              type="button"
              onClick={() => setViewMode('MELHORIA')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                viewMode === 'MELHORIA' ? 'bg-[#ffffff] text-[#1f8a65] shadow-2xs font-bold' : 'text-[#807d72] hover:text-[#26251e]'
              }`}
            >
              Foco em Melhoria & Ganho
            </button>
          </div>

          <div className="text-xs font-mono text-[#807d72] flex items-center gap-3">
            <span>Amostra: <strong>{filteredList.length}</strong> redações</span>
            <span>•</span>
            <span>Média da Amostra: <strong className="text-[#f54e00]">{melhoriaStats.mediaGlobal} pts</strong></span>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* CARDS DE RESUMO CIENTÍFICO (KPIs PRINCIPAIS)              */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI 1: Maior Defasagem Identificada */}
        <div className="bg-[#ffffff] border border-rose-200 p-5 rounded-xl shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-rose-800 font-semibold uppercase tracking-wider">
            <span>Maior Defasagem</span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-black font-mono text-rose-600 flex items-baseline gap-1.5">
            <span>{defasagemStats.maiorDefasagem?.code || '—'}</span>
            <span className="text-xs font-normal text-rose-800">
              (média {defasagemStats.maiorDefasagem?.media || 0}/200 pts)
            </span>
          </div>
          <p className="text-[11px] text-[#807d72] line-clamp-1">
            {defasagemStats.maiorDefasagem?.nome || 'Analisando dados'}
          </p>
        </div>

        {/* KPI 2: Taxa de Alunos em Alto Desempenho */}
        <div className="bg-[#ffffff] border border-emerald-200 p-5 rounded-xl shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-emerald-800 font-semibold uppercase tracking-wider">
            <span>Taxa em Alto Desempenho</span>
            <Award className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black font-mono text-emerald-700">
            {melhoriaStats.taxaAprovacao}%
          </div>
          <p className="text-[11px] text-[#807d72]">
            Alunos com pontuação &gt;= 760 pontos (Avançado + Elite)
          </p>
        </div>

        {/* KPI 3: Média Geral da Redação Diagnóstica */}
        <div className="bg-[#ffffff] border border-blue-200 p-5 rounded-xl shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-blue-800 font-semibold uppercase tracking-wider">
            <span>Média Geral Diagnóstica</span>
            <BarChart3 className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black font-mono text-blue-700 flex items-baseline gap-1">
            <span>{melhoriaStats.mediaGlobal}</span>
            <span className="text-xs font-normal text-blue-800">/ 1000 pts</span>
          </div>
          <p className="text-[11px] text-[#807d72]">
            Pontuação média da escola na 1ª redação diagnóstica
          </p>
        </div>

        {/* KPI 4: Total de Estudantes Avaliados */}
        <div className="bg-[#ffffff] border border-[#e6e5e0] p-5 rounded-xl shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-[#807d72] font-semibold uppercase tracking-wider">
            <span>Estudantes Avaliados</span>
            <Users className="w-4 h-4 text-[#807d72]" />
          </div>
          <div className="text-2xl font-black font-mono text-[#26251e]">
            {melhoriaStats.totalEstudantes}
          </div>
          <p className="text-[11px] text-[#807d72]">
            Total de alunos participantes do diagnóstico
          </p>
        </div>

      </div>

      {/* ======================================================== */}
      {/* SEÇÃO 1: DIAGNÓSTICO DE DEFASAGEM (GRÁFICOS & TABELA)     */}
      {/* ======================================================== */}
      {(viewMode === 'AMBOS' || viewMode === 'DEFASAGEM') && (
        <div className="bg-[#ffffff] border border-rose-200/80 rounded-2xl p-6 sm:p-7 space-y-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#e6e5e0]">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-rose-700">
                <AlertTriangle className="w-4 h-4" />
                <span>EIXO 1: ANÁLISE DE DEFASAGENS & GARGALOS TEXTUAIS</span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-[#26251e]">
                Onde os estudantes mais perdem pontos? (Competências C1 a C5)
              </h2>
              <p className="text-xs text-[#807d72]">
                Comparativo visual entre a pontuação conquistada e os pontos perdidos por incompetência sintática, argumentativa ou estrutural.
              </p>
            </div>

            <span className="px-3 py-1 bg-rose-50 border border-rose-200 rounded-full text-xs font-mono font-bold text-rose-800 self-start sm:self-auto">
              Perda Média Global: {1000 - melhoriaStats.mediaGlobal} pts
            </span>
          </div>

          {/* Gráfico Visual de Barras com Barra de Perda (Defasagem) */}
          <div className="space-y-4">
            {defasagemStats.competencias.map((comp) => {
              const isWorst = comp.code === defasagemStats.maiorDefasagem?.code;
              return (
                <div key={comp.code} className={`p-4 rounded-xl border ${isWorst ? 'bg-rose-50/40 border-rose-300' : 'bg-[#fafaf7] border-[#e6e5e0]'} space-y-2`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded font-mono font-bold text-xs bg-[#26251e] text-white">
                        {comp.code}
                      </span>
                      <span className="font-bold text-[#26251e]">{comp.nome}</span>
                      {isWorst && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-200 text-rose-900">
                          Ponto Mais Crítico
                        </span>
                      )}
                    </div>

                    <div className="font-mono text-xs flex items-center gap-3">
                      <span className="text-[#1f8a65] font-semibold">Média: {comp.media}/200 ({comp.pctAproveitamento}%)</span>
                      <span className="text-rose-600 font-bold">Defasagem: -{comp.perdaMedia} pts ({comp.pctDefasagem}%)</span>
                    </div>
                  </div>

                  {/* Barra Dupla: Aproveitamento Verde + Perda Vermelha */}
                  <div className="w-full bg-[#e6e5e0] h-4 rounded-full overflow-hidden flex shadow-inner">
                    <div
                      style={{ width: `${comp.pctAproveitamento}%` }}
                      className="bg-emerald-600 h-full transition-all duration-700 flex items-center justify-end pr-2 text-[10px] font-mono text-white font-bold"
                      title={`Pontos obtidos: ${comp.media}`}
                    >
                      {comp.pctAproveitamento > 20 && `${comp.media} pts`}
                    </div>
                    <div
                      style={{ width: `${comp.pctDefasagem}%` }}
                      className="bg-rose-500 h-full transition-all duration-700 flex items-center justify-start pl-2 text-[10px] font-mono text-white font-bold"
                      title={`Pontos perdidos: ${comp.perdaMedia}`}
                    >
                      {comp.pctDefasagem > 15 && `-${comp.perdaMedia}`}
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-[10px] text-[#807d72] font-mono pt-0.5">
                    <span>0 pts (Defasagem Total)</span>
                    <span className="text-rose-700 font-medium">
                      {comp.status === 'CRITICO' ? '🚨 Requer intervenção urgente em sala' : comp.status === 'ALERTA' ? '⚠️ Em fase de consolidação' : '✅ Desempenho seguro'}
                    </span>
                    <span>200 pts (Domínio Total)</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Top 3 Descritores Críticos SISEDU */}
          <div className="pt-2">
            <h3 className="text-sm font-bold text-[#26251e] mb-3 flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#807d72]" />
              Descritores Qualitativos SISEDU/SPAECE em Nível Inicial (Prioridade de Ensino):
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {siseduDefasagem.slice(0, 3).map((d) => (
                <div key={d.code} className="bg-rose-50/60 border border-rose-200 p-3.5 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs bg-rose-600 text-white px-2 py-0.5 rounded">
                      {d.code}
                    </span>
                    <span className="text-xs font-mono font-bold text-rose-700">
                      {d.pctInicial}% em Nível Inicial
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-[#26251e]">{d.label}</div>
                  <p className="text-[10px] text-rose-800">
                    {d.inicial} aluno(s) demonstraram dificuldades severas neste descritor.
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SEÇÃO 2: MAPEAMENTO DE PROFICIÊNCIA & POTENCIAL           */}
      {/* ======================================================== */}
      {(viewMode === 'AMBOS' || viewMode === 'MELHORIA') && (
        <div className="bg-[#ffffff] border border-emerald-200/80 rounded-2xl p-6 sm:p-7 space-y-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#e6e5e0]">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-emerald-700">
                <TrendingUp className="w-4 h-4" />
                <span>EIXO 2: MAPEAMENTO DE PROFICIÊNCIA & POTENCIAL DE MELHORIA</span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-[#26251e]">
                Distribuição das Notas Diagnósticas por Níveis ENEM
              </h2>
              <p className="text-xs text-[#807d72]">
                Classificação da proficiência dos estudantes para direcionamento pedagógico e oportunidades de reescrita.
              </p>
            </div>

            <span className="px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-xs font-mono font-bold text-emerald-800 self-start sm:self-auto">
              Amostra: {melhoriaStats.totalEstudantes} estudantes avaliados
            </span>
          </div>

          {/* Histograma de Faixas de Desempenho ENEM */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {melhoriaStats.faixas.map((faixa) => (
              <div key={faixa.id} className={`p-4 rounded-xl border ${faixa.bg} space-y-3`}>
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-xs">{faixa.label}</span>
                  <span className="text-lg font-black font-mono">{faixa.pct}%</span>
                </div>
                <div className="w-full bg-white/70 h-2.5 rounded-full overflow-hidden border border-black/5">
                  <div
                    className="h-full transition-all duration-700 rounded-full"
                    style={{ width: `${faixa.pct}%`, backgroundColor: faixa.cor }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold">{faixa.count} redação(ões)</span>
                  <span className="text-[10px] opacity-80">{faixa.desc}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Resumo de Evidências de Melhoria */}
          <div className="bg-emerald-50/30 border border-emerald-200 p-5 rounded-xl space-y-3">
            <h3 className="text-sm font-bold text-emerald-950 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              Impacto Pedagógico & Evidências para a Feira de Ciências:
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="bg-white p-3.5 rounded-lg border border-emerald-200/60 space-y-1">
                <span className="font-mono font-bold text-emerald-700 text-sm block">1. Feedback Imediato</span>
                <p className="text-[#5a5852]">
                  Tempo de retorno reduzido de <strong>15 dias</strong> para <strong>menos de 20 segundos</strong>, permitindo que o aluno receba a devolutiva na mesma aula.
                </p>
              </div>

              <div className="bg-white p-3.5 rounded-lg border border-emerald-200/60 space-y-1">
                <span className="font-mono font-bold text-emerald-700 text-sm block">2. Diagnóstico Preciso</span>
                <p className="text-[#5a5852]">
                  Mapeamento individualizado por competência (C1 a C5) e descritor SISEDU, guiando o professor nas lacunas exatas de cada aluno.
                </p>
              </div>

              <div className="bg-white p-3.5 rounded-lg border border-emerald-200/60 space-y-1">
                <span className="font-mono font-bold text-emerald-700 text-sm block">3. Equidade Educacional</span>
                <p className="text-[#5a5852]">
                  Garantia de que 100% dos alunos da escola pública tenham acesso a correções detalhadas e alinhadas aos critérios oficiais do INEP.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SEÇÃO 3: PLANO DE AÇÃO & INTERVENÇÃO PEDAGÓGICA (IA)     */}
      {/* ======================================================== */}
      <div className="bg-[#ffffff] border border-[#e6e5e0] rounded-2xl p-6 sm:p-7 space-y-5 shadow-xs">
        <div className="flex items-center gap-2 pb-3 border-b border-[#e6e5e0]">
          <Lightbulb className="w-5 h-5 text-amber-500" />
          <div>
            <h3 className="text-base sm:text-lg font-bold text-[#26251e]">
              Recomendações Práticas de Intervenção Pedagógica
            </h3>
            <p className="text-xs text-[#807d72]">
              Diretrizes metodológicas geradas a partir do cruzamento de dados para professores e gestores.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/30 space-y-2">
            <h4 className="text-xs font-bold text-rose-900 flex items-center gap-2 uppercase font-mono">
              <Target className="w-4 h-4 text-rose-600" />
              Ação 1: Oficina Focada no Gargalo Principal ({defasagemStats.maiorDefasagem?.code || 'C1'})
            </h4>
            <p className="text-xs text-[#5a5852] leading-relaxed">
              Realizar oficinas semanais de sintaxe, concordância e conectivos interparágrafos para mitigar a perda média de <strong>{defasagemStats.maiorDefasagem?.perdaMedia || 0} pontos</strong> identificada na Matriz.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/30 space-y-2">
            <h4 className="text-xs font-bold text-emerald-900 flex items-center gap-2 uppercase font-mono">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Ação 2: Ciclo Contínuo de Reescrita Textual
            </h4>
            <p className="text-xs text-[#5a5852] leading-relaxed">
              Incentivar os estudantes da faixa intermediária (600-740) a utilizar os apontamentos do corretor do Ágora ENEM para reescrever a mesma proposta até atingir a faixa de 800+ pontos.
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}
