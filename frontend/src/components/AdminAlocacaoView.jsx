import React, { useState, useEffect } from 'react';
import { 
  Layers, Clock, CheckCircle2, AlertTriangle, RefreshCw, 
  Play, Sparkles, Database, ShieldAlert, CheckCircle, Loader2 
} from 'lucide-react';
import { authService } from '../services/authService';

export default function AdminAlocacaoView() {
  const [metricas, setMetricas] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCleaning, setIsCleaning] = useState(false);
  const [isProcessingJobs, setIsProcessingJobs] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const loadMetricas = async () => {
    setIsLoading(true);
    try {
      const data = await authService.fetchMetricasAlocacao();
      setMetricas(data || {});
    } catch (err) {
      setFeedback({ type: 'error', text: err.message || 'Falha ao carregar métricas.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMetricas();
  }, []);

  const handleCleanupLeases = async () => {
    setIsCleaning(true);
    try {
      const res = await fetch('/api/cron/cleanup-leases');
      const data = await res.json();
      setFeedback({ type: 'success', text: `Limpeza concluída! ${data.leasesLiberados || 0} redação(ões) liberadas de volta para a fila.` });
      loadMetricas();
      setTimeout(() => setFeedback(null), 5000);
    } catch (err) {
      setFeedback({ type: 'error', text: 'Falha ao executar limpeza de leases.' });
    } finally {
      setIsCleaning(false);
    }
  };

  const handleRunJobsWorker = async () => {
    setIsProcessingJobs(true);
    try {
      const res = await fetch('/api/cron/process-jobs');
      const data = await res.json();
      setFeedback({ type: 'success', text: `Worker executado! ${data.processed || 0} job(s) processados.` });
      loadMetricas();
      setTimeout(() => setFeedback(null), 5000);
    } catch (err) {
      setFeedback({ type: 'error', text: 'Falha ao executar worker de jobs.' });
    } finally {
      setIsProcessingJobs(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 text-[#26251e] pb-12 animate-fadeIn">
      {/* Header */}
      <div className="bg-[#ffffff] border border-[#e6e5e0] rounded-xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div>
          <h2 className="text-lg sm:text-xl font-bold tracking-tight text-[#26251e] flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#f54e00]" />
            <span>Distribuição de Redações & Fila de Correção</span>
          </h2>
          <p className="text-xs text-[#807d72] mt-0.5">
            Acompanhamento em tempo real do fluxo de redações entre os corretores e a equipe pedagógica.
          </p>
        </div>

        <button
          type="button"
          onClick={loadMetricas}
          className="p-2 rounded-lg bg-[#fafaf7] hover:bg-[#e6e5e0] border border-[#e6e5e0] text-[#26251e] text-xs font-mono flex items-center gap-1.5 cursor-pointer shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Atualizar Dados</span>
        </button>
      </div>

      {feedback && (
        <div className={`p-3.5 rounded-lg border text-xs flex items-center justify-between font-mono animate-fadeIn ${
          feedback.type === 'success' ? 'bg-emerald-50 text-emerald-900 border-emerald-200' : 'bg-red-50 text-red-900 border-red-200'
        }`}>
          <span>{feedback.text}</span>
          <button onClick={() => setFeedback(null)} className="font-bold cursor-pointer">✕</button>
        </div>
      )}

      {/* Cards de Métricas em Tempo Real */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-[#ffffff] border border-[#e6e5e0] rounded-xl p-4 space-y-1 shadow-xs">
          <span className="text-[10.5px] font-mono text-[#807d72] uppercase block">Total de Redações</span>
          <strong className="text-2xl font-bold text-[#26251e]">{isLoading ? '...' : metricas?.total ?? 0}</strong>
          <span className="text-[10px] text-[#807d72] block">Cadastradas no sistema</span>
        </div>

        <div className="bg-[#ffffff] border border-[#e6e5e0] rounded-xl p-4 space-y-1 shadow-xs">
          <span className="text-[10.5px] font-mono text-[#1f8a65] uppercase block flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#1f8a65]" /> Disponíveis na Fila
          </span>
          <strong className="text-2xl font-bold text-[#1f8a65]">{isLoading ? '...' : metricas?.disponiveis ?? 0}</strong>
          <span className="text-[10px] text-[#807d72] block">Aguardando corretor</span>
        </div>

        <div className="bg-[#ffffff] border border-[#e6e5e0] rounded-xl p-4 space-y-1 shadow-xs">
          <span className="text-[10.5px] font-mono text-[#c08532] uppercase block flex items-center gap-1">
            <Clock className="w-3 h-3 text-[#c08532]" /> Em Correção Ativa
          </span>
          <strong className="text-2xl font-bold text-[#c08532]">{isLoading ? '...' : metricas?.emCorrecao ?? 0}</strong>
          <span className="text-[10px] text-[#807d72] block">Com professores no momento</span>
        </div>

        <div className="bg-[#ffffff] border border-[#e6e5e0] rounded-xl p-4 space-y-1 shadow-xs">
          <span className="text-[10.5px] font-mono text-[#f54e00] uppercase block">Concluídas & Validadas</span>
          <strong className="text-2xl font-bold text-[#f54e00]">{isLoading ? '...' : metricas?.concluidas ?? 0}</strong>
          <span className="text-[10px] text-[#807d72] block">Liberadas para os alunos</span>
        </div>
      </div>

      {/* Alerta de Redações Paradas */}
      {metricas?.travadas2h > 0 && (
        <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs">
          <div className="flex items-center gap-2.5 text-amber-950">
            <AlertTriangle className="w-5 h-5 text-[#c08532] shrink-0" />
            <div>
              <p className="font-bold">Atenção: {metricas.travadas2h} redação(ões) sem movimentação há mais de 2 horas.</p>
              <p className="text-[11px] text-amber-800 mt-0.5">
                Caso algum professor tenha pausado a atividade sem finalizar, você pode devolver essas redações para a fila geral para que outro corretor dê continuidade.
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={isCleaning}
            onClick={handleCleanupLeases}
            className="px-3.5 py-2 bg-[#c08532] hover:bg-amber-700 text-white rounded-lg font-mono text-xs font-bold cursor-pointer transition-colors shrink-0 disabled:opacity-50"
          >
            {isCleaning ? 'Liberando...' : 'Devolver Redações para a Fila'}
          </button>
        </div>
      )}

      {/* Painéis de Fluxo Pedagógico */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[#ffffff] border border-[#e6e5e0] rounded-xl p-5 space-y-3 shadow-xs">
          <h3 className="font-bold text-sm text-[#26251e] flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#f54e00]" />
            <span>Garantia de Fluxo & Devolução Automática</span>
          </h3>
          <p className="text-xs text-[#807d72] leading-relaxed">
            O sistema monitora continuamente as avaliações reservadas. Se um corretor fechar o navegador sem validar a nota, a redação é devolvida automaticamente para a lista geral para assegurar que nenhum estudante fique sem correção.
          </p>
          <button
            type="button"
            disabled={isCleaning}
            onClick={handleCleanupLeases}
            className="py-2 px-3 bg-[#fafaf7] hover:bg-[#e6e5e0] border border-[#e6e5e0] rounded-lg text-xs font-mono font-medium flex items-center gap-2 cursor-pointer transition-colors"
          >
            {isCleaning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            <span>Verificar e Liberar Pendências Agora</span>
          </button>
        </div>

        <div className="bg-[#ffffff] border border-[#e6e5e0] rounded-xl p-5 space-y-3 shadow-xs">
          <h3 className="font-bold text-sm text-[#26251e] flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#f54e00]" />
            <span>Fila de Leitura e Pré-correção com IA</span>
          </h3>
          <p className="text-xs text-[#807d72] leading-relaxed">
            As redações manuscritas passam por leitura e análise prévia em segundo plano, adiantando a transcrição e os critérios de avaliação oficial do ENEM para agilizar o trabalho da banca docente.
          </p>
          <button
            type="button"
            disabled={isProcessingJobs}
            onClick={handleRunJobsWorker}
            className="py-2 px-3 bg-[#fafaf7] hover:bg-[#e6e5e0] border border-[#e6e5e0] rounded-lg text-xs font-mono font-medium flex items-center gap-2 cursor-pointer transition-colors"
          >
            {isProcessingJobs ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            <span>Acelerar Pré-correção em Segundo Plano</span>
          </button>
        </div>
      </div>
    </div>
  );
}
