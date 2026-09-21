import React from 'react';
import { Settings, ShieldCheck, Key, Bot, Cpu, HardDrive, CheckCircle2, UserCheck, Sparkles } from 'lucide-react';

export default function ConfigView() {
  return (
    <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6 text-[#26251e] min-w-0">
      {/* Header */}
      <div className="bg-white border border-[#e6e5e0] rounded-xl p-4 sm:p-6">
        <h2 className="text-lg font-bold text-[#26251e] tracking-tight flex items-center gap-2">
          <Settings className="w-5 h-5 text-[#f54e00]" />
          Configurações & Integração da API
        </h2>
        <p className="text-xs text-[#6b6960] mt-1 font-mono">
          Parâmetros do motor Multi-Agente de IA e persistência do banco local (Dexie / IndexedDB)
        </p>
      </div>

      {/* API Key Status Box */}
      <div className="bg-white border border-[#e6e5e0] rounded-xl p-4 sm:p-6 space-y-4">
        <h3 className="text-xs font-mono font-bold text-[#26251e] uppercase tracking-wider flex items-center gap-2">
          <Key className="w-4 h-4 text-[#f54e00]" />
          Status da Chave Gemini API
        </h3>

        <div className="p-4 bg-[#fafaf7] border border-[#e6e5e0] rounded-lg space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#436444]" />
              <span className="text-xs font-bold text-[#26251e]">Chave Configurada no Arquivo backend/.env</span>
            </div>
            <span className="px-2.5 py-1 rounded bg-[#9fc9a2]/30 text-[#244525] border border-[#9fc9a2] text-[10px] font-mono font-bold">
              ATIVA
            </span>
          </div>
          <p className="text-xs text-[#6b6960] leading-relaxed">
            A chave da API está sendo utilizada diretamente pelas requisições paralelas do backend Express (Google Gen AI SDK v0.24).
          </p>
        </div>
      </div>

      {/* Unified AI Config Card */}
      <div className="bg-white border border-[#e6e5e0] rounded-xl p-4 sm:p-6 space-y-4">
        <h3 className="text-xs font-mono font-bold text-[#26251e] uppercase tracking-wider flex items-center gap-2">
          <Bot className="w-4 h-4 text-[#f54e00]" />
          Arquitetura IA: Agente Único Multimodal (Gemini 3.5 Flash Lite)
        </h3>

        <div className="p-4 bg-[#fafaf7] border border-[#e6e5e0] rounded-lg space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-[#26251e]">
              <Sparkles className="w-4 h-4 text-[#f54e00]" />
              <span>Agente Único Unificado (OCR + ENEM C1-C5 + Rubricas Sisedu)</span>
            </div>
            <span className="px-2.5 py-0.5 rounded bg-[#9fc9a2]/30 text-[#244525] border border-[#9fc9a2] text-[10px] font-mono font-bold">
              1 CHAMADA / FOTO
            </span>
          </div>
          <p className="text-[#6b6960] text-[11px] leading-relaxed">
            Otimizado para economia de requisições (15 RPM). Realiza a leitura visual da imagem, a transcrição 100% integral do texto e o cálculo das 5 competências do ENEM com citações obrigatórias em uma <strong className="font-bold text-[#26251e]">única passada multimodal</strong>.
          </p>
        </div>
      </div>

      {/* Database Status Box */}
      <div className="bg-white border border-[#e6e5e0] rounded-xl p-4 sm:p-6 space-y-4">
        <h3 className="text-xs font-mono font-bold text-[#26251e] uppercase tracking-wider flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-[#f54e00]" />
          Banco de Dados Local (Dexie.js / IndexedDB)
        </h3>

        <div className="p-4 bg-[#fafaf7] border border-[#e6e5e0] rounded-lg flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#436444]" />
            <span className="text-[#26251e]">
              Tabela <code className="font-mono bg-white px-1.5 py-0.5 border border-[#e6e5e0] rounded text-[#f54e00] font-bold">redacoes</code> Operacional
            </span>
          </div>
          <span className="font-mono text-[#6b6960] text-[11px]">IndexedDB v2</span>
        </div>
      </div>
    </div>
  );
}

