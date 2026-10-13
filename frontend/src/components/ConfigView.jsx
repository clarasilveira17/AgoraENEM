import React from 'react';
import { Settings, ShieldCheck, Key, Bot, Cpu, HardDrive, CheckCircle2, UserCheck, Sparkles } from 'lucide-react';

export default function ConfigView() {
  return (
    <div className="max-w-4xl mx-auto space-y-6 text-[#26251e]">
      {/* Header */}
      <div className="bg-white border border-[#e6e5e0] rounded-xl p-6">
        <h2 className="text-lg font-bold text-[#26251e] tracking-tight flex items-center gap-2">
          <Settings className="w-5 h-5 text-[#f54e00]" />
          Configurações & Parâmetros Pedagógicos
        </h2>
        <p className="text-xs text-[#807d72] mt-1">
          Diretrizes de correção ortográfica, leitura automatizada e critérios oficiais do ENEM.
        </p>
      </div>

      {/* Status da Inteligência Artificial */}
      <div className="bg-white border border-[#e6e5e0] rounded-xl p-6 space-y-4">
        <h3 className="text-xs font-mono font-bold text-[#26251e] uppercase tracking-wider flex items-center gap-2">
          <Key className="w-4 h-4 text-[#f54e00]" />
          Motor de Leitura e Assistência Pedagógica
        </h3>

        <div className="p-4 bg-[#fafaf7] border border-[#e6e5e0] rounded-lg space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#1f8a65]" />
              <span className="text-xs font-bold text-[#26251e]">Assistente de Leitura Visual Conectado</span>
            </div>
            <span className="px-2.5 py-1 rounded bg-[#9fc9a2]/30 text-[#1f8a65] border border-[#9fc9a2] text-[10px] font-mono font-bold">
              OPERACIONAL
            </span>
          </div>
          <p className="text-xs text-[#807d72] leading-relaxed">
            O assistente pedagógico está habilitado e pronto para analisar as redações enviadas, transcrevendo os textos manuscritos com precisão para apoiar os professores.
          </p>
        </div>
      </div>

      {/* Critérios ENEM */}
      <div className="bg-white border border-[#e6e5e0] rounded-xl p-6 space-y-4">
        <h3 className="text-xs font-mono font-bold text-[#26251e] uppercase tracking-wider flex items-center gap-2">
          <Bot className="w-4 h-4 text-[#f54e00]" />
          Critérios de Correção (Competências 1 a 5 do ENEM)
        </h3>

        <div className="p-4 bg-[#fafaf7] border border-[#e6e5e0] rounded-lg space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-[#26251e]">
              <Sparkles className="w-4 h-4 text-[#f54e00]" />
              <span>Diagnóstico Completo por Competência e Rubricas Oficiais</span>
            </div>
            <span className="px-2.5 py-0.5 rounded bg-[#9fc9a2]/30 text-[#1f8a65] border border-[#9fc9a2] text-[10px] font-mono font-bold">
              PADRÃO INEP / ENEM
            </span>
          </div>
          <p className="text-[#807d72] text-[11px] leading-relaxed">
            Realiza a leitura das folhas de redação, identifica a estrutura do parágrafo, gramática, repertório sociocultural e proposta de intervenção, fornecendo justificativas detalhadas para orientar os alunos.
          </p>
        </div>
      </div>

      {/* Armazenamento e Segurança */}
      <div className="bg-white border border-[#e6e5e0] rounded-xl p-6 space-y-4">
        <h3 className="text-xs font-mono font-bold text-[#26251e] uppercase tracking-wider flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-[#f54e00]" />
          Segurança e Backup de Redações
        </h3>

        <div className="p-4 bg-[#fafaf7] border border-[#e6e5e0] rounded-lg flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#1f8a65]" />
            <span className="text-[#26251e] font-medium">
              Sincronização em Nuvem Ativa e Criptografada
            </span>
          </div>
          <span className="font-mono text-[#1f8a65] text-[11px] font-bold">100% Protegido</span>
        </div>
      </div>
    </div>
  );
}

