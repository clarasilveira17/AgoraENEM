import React from 'react';
import { Award, Sparkles, BookOpen, Compass, ShieldCheck, GraduationCap, ArrowRight, LogIn, UserPlus, CheckCircle2, FileText, HeartHandshake, BrainCircuit } from 'lucide-react';

export default function ProjetoAgoraLandingView({ onOpenLoginModal }) {
  return (
    <div className="max-w-6xl mx-auto space-y-10 py-4 sm:py-8 px-2 sm:px-4 text-[#26251e] font-sans">
      
      {/* Hero Editorial Band (Cursor Gothic style: warm cream, weight 400 headline, Cursor Orange CTA) */}
      <div className="bg-[#ffffff] border border-[#e6e5e0] rounded-2xl p-6 sm:p-12 text-center relative overflow-hidden space-y-6">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-mono font-medium bg-[#f7f7f4] border border-[#e6e5e0] text-[#26251e]">
          <Sparkles className="w-4 h-4 text-[#f54e00]" />
          Projeto Ágora Escolar • Tecnologia Preditiva & Formação Cidadã
        </div>

        <h1 className="text-3xl sm:text-5xl font-normal text-[#26251e] tracking-tight max-w-4xl mx-auto leading-tight">
          Inteligência Artificial a Serviço da Redação ENEM & Pensamento Crítico
        </h1>

        <p className="text-sm sm:text-base text-[#5a5852] max-w-2xl mx-auto leading-relaxed">
          Plataforma educacional unificada que integra a <strong className="font-semibold text-[#26251e]">Matriz Oficial do ENEM (0-1000)</strong> às <strong className="font-semibold text-[#26251e]">Rubricas Qualitativas Sisedu (Projeto Ágora Escolar)</strong>, com validação pedagógica do corpo docente.
        </p>

        {/* CTA Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={onOpenLoginModal}
            className="w-full sm:w-auto px-6 py-3.5 bg-[#f54e00] hover:bg-[#d04200] text-white font-medium text-xs uppercase tracking-wider rounded-md transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm"
          >
            <LogIn className="w-4 h-4" />
            <span>Acessar Plataforma</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onOpenLoginModal}
            className="w-full sm:w-auto px-6 py-3.5 bg-[#ffffff] hover:bg-[#fafaf7] text-[#26251e] font-medium text-xs rounded-md border border-[#e6e5e0] transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <GraduationCap className="w-4 h-4 text-[#1f8a65]" />
            <span>Sou Aluno (Criar / Entrar na Conta)</span>
          </button>
        </div>
      </div>

      {/* Pilares do Projeto Ágora Escolar */}
      <div className="space-y-4">
        <div className="text-center max-w-xl mx-auto space-y-1">
          <span className="text-xs font-mono font-semibold uppercase text-[#807d72] tracking-wider">Metodologia Educacional</span>
          <h2 className="text-2xl sm:text-3xl font-normal tracking-tight text-[#26251e]">
            Quatro Pilares do Projeto Ágora
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Pilar 1 */}
          <div className="bg-[#ffffff] border border-[#e6e5e0] p-6 rounded-xl space-y-3">
            <div className="w-10 h-10 rounded-lg bg-[#dfa88f]/30 border border-[#dfa88f] flex items-center justify-center text-[#26251e]">
              <Award className="w-5 h-5 text-[#c08532]" />
            </div>
            <h3 className="text-base font-semibold text-[#26251e]">1. Matriz ENEM (C1-C5)</h3>
            <p className="text-xs text-[#5a5852] leading-relaxed">
              Avaliação de 0 a 200 pontos nas 5 competências do ENEM com citação textual obrigatória de trechos do aluno.
            </p>
          </div>

          {/* Pilar 2 */}
          <div className="bg-[#ffffff] border border-[#e6e5e0] p-6 rounded-xl space-y-3">
            <div className="w-10 h-10 rounded-lg bg-[#9fbbe0]/30 border border-[#9fbbe0] flex items-center justify-center text-[#26251e]">
              <Compass className="w-5 h-5 text-[#26251e]" />
            </div>
            <h3 className="text-base font-semibold text-[#26251e]">2. Rubrica Sisedu</h3>
            <p className="text-xs text-[#5a5852] leading-relaxed">
              Análise de repertório filosófico/histórico, clareza de tese, empatia, alteridade e propostas de intervenção ética.
            </p>
          </div>

          {/* Pilar 3 */}
          <div className="bg-[#ffffff] border border-[#e6e5e0] p-6 rounded-xl space-y-3">
            <div className="w-10 h-10 rounded-lg bg-[#9fc9a2]/40 border border-[#9fc9a2] flex items-center justify-center text-[#26251e]">
              <ShieldCheck className="w-5 h-5 text-[#1f8a65]" />
            </div>
            <h3 className="text-base font-semibold text-[#26251e]">3. Validação Docente</h3>
            <p className="text-xs text-[#5a5852] leading-relaxed">
              Toda análise da IA passa obrigatoriamente pela chancela e revisão do professor antes de chegar ao estudante.
            </p>
          </div>

          {/* Pilar 4 */}
          <div className="bg-[#ffffff] border border-[#e6e5e0] p-6 rounded-xl space-y-3">
            <div className="w-10 h-10 rounded-lg bg-[#c0a8dd]/30 border border-[#c0a8dd] flex items-center justify-center text-[#26251e]">
              <FileText className="w-5 h-5 text-[#26251e]" />
            </div>
            <h3 className="text-base font-semibold text-[#26251e]">4. Boletim em PDF</h3>
            <p className="text-xs text-[#5a5852] leading-relaxed">
              Emissão de boletim duplex oficial econômico de tinta para impressão e acompanhamento pedagógico de turmas.
            </p>
          </div>

        </div>
      </div>

      {/* Matriz de Avaliação Cruzada (Visão Detalhada) */}
      <div className="bg-[#ffffff] border border-[#e6e5e0] rounded-xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#e6e5e0] pb-4">
          <div>
            <span className="text-xs font-mono text-[#807d72] uppercase font-semibold">Estrutura Pedagógica</span>
            <h3 className="text-xl sm:text-2xl font-normal text-[#26251e]">
              Como Funciona a Avaliação Cruzada ENEM x Sisedu
            </h3>
          </div>
          <span className="text-xs font-mono bg-[#f7f7f4] border border-[#e6e5e0] px-3 py-1 rounded-full text-[#5a5852]">
            Algoritmo Unificado de Visão Preditiva
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Dimensão Discursiva */}
          <div className="bg-[#fafaf7] border border-[#e6e5e0] p-5 rounded-lg space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#26251e]">
              <BrainCircuit className="w-4 h-4 text-[#f54e00]" />
              Dimensão Discursiva & Argumentativa
            </div>
            <ul className="space-y-2 text-xs text-[#5a5852]">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#1f8a65] shrink-0 mt-0.5" />
                <span><strong>Clareza da Tese:</strong> Transição de opinião implícita para tese crítica problematizadora.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#1f8a65] shrink-0 mt-0.5" />
                <span><strong>Qualidade Argumentativa:</strong> Organização lógica, coerência e profundidade interdisciplinar.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#1f8a65] shrink-0 mt-0.5" />
                <span><strong>Repertório Sociocultural:</strong> Uso de citações históricas, filosóficas e científicas legítimas.</span>
              </li>
            </ul>
          </div>

          {/* Dimensão Ético-Moral */}
          <div className="bg-[#fafaf7] border border-[#e6e5e0] p-5 rounded-lg space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#26251e]">
              <HeartHandshake className="w-4 h-4 text-[#c08532]" />
              Dimensão Ético-Moral & Direitos Humanos
            </div>
            <ul className="space-y-2 text-xs text-[#5a5852]">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#1f8a65] shrink-0 mt-0.5" />
                <span><strong>Empatia e Alteridade:</strong> Consciência social e respeito à diversidade de perspectivas.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#1f8a65] shrink-0 mt-0.5" />
                <span><strong>Justificação Moral:</strong> Validação de propostas fundamentadas em princípios éticos universais.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#1f8a65] shrink-0 mt-0.5" />
                <span><strong>Proposta de Intervenção:</strong> Agente, ação, meio/modo, detalhamento e impacto comunitário.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Pre-Footer Call to Action Band */}
      <div className="bg-[#f7f7f4] border border-[#e6e5e0] rounded-2xl p-8 sm:p-12 text-center space-y-4">
        <h3 className="text-2xl sm:text-3xl font-normal text-[#26251e]">
          Pronto para Acompanhar seu Desempenho na Redação?
        </h3>
        <p className="text-xs sm:text-sm text-[#5a5852] max-w-md mx-auto">
          Faça login com sua conta de estudante ou professor para acessar seu painel individual.
        </p>
        <div>
          <button
            type="button"
            onClick={onOpenLoginModal}
            className="px-8 py-3.5 bg-[#f54e00] hover:bg-[#d04200] text-white font-medium text-xs uppercase tracking-wider rounded-md transition-all cursor-pointer inline-flex items-center gap-2"
          >
            <LogIn className="w-4 h-4" />
            Entrar na Plataforma Ágora
          </button>
        </div>
      </div>

    </div>
  );
}
