import React, { useState, useRef } from 'react';
import { 
  Upload, FileText, CheckCircle2, AlertCircle, Loader2, Image as ImageIcon, 
  Trash2, Edit3, User, GraduationCap, Sparkles, RefreshCw, ShieldCheck, Clock, AlertTriangle 
} from 'lucide-react';
import { processRedacoesCloud, reprocessarRedacao } from '../services/cloudCorrectionService';

export default function UploaderView({ onRedacaoSaved }) {
  const [mode, setMode] = useState('imagem');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [typedText, setTypedText] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualTurma, setManualTurma] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressState, setProgressState] = useState(null);
  const [fileStatuses, setFileStatuses] = useState({});
  const [feedback, setFeedback] = useState(null);
  const fileInputRef = useRef(null);

  // Live line and word counting
  const wordCount = typedText.trim() ? typedText.trim().split(/\s+/).length : 0;
  const lineCount = typedText.trim() ? typedText.split('\n').length : 0;

  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const filePromises = files.map((file, idx) => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const fileId = `file_${Date.now()}_${idx}_${Math.random().toString(36).substring(7)}`;
          resolve({
            id: fileId,
            name: file.name,
            size: (file.size / 1024).toFixed(1) + ' KB',
            base64: e.target?.result,
            status: 'IDLE' // IDLE | PROCESSING | WAITING_RETRY | SUCCESS | ERROR
          });
        };
        reader.readAsDataURL(file);
      });
    });

    Promise.all(filePromises).then((newFiles) => {
      setSelectedFiles((prev) => [...prev, ...newFiles]);
    });
  };

  const handleRemoveFile = (id) => {
    setSelectedFiles((prev) => prev.filter((f) => f.id !== id));
    setFileStatuses((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleSaveImages = async () => {
    if (selectedFiles.length === 0) return;
    setIsProcessing(true);
    setFeedback(null);
    setProgressState({
      current: 0,
      total: selectedFiles.length,
      statusText: 'Iniciando fila com rate-limiting seguro...'
    });

    try {
      const itemsToSave = selectedFiles.map((f) => ({
        id: f.id,
        name: f.name,
        imagem_base64: f.base64,
        tipo_input: 'imagem',
        nome_manual: manualName.trim() || null,
        turma_manual: manualTurma.trim() || null
      }));

      const res = await processRedacoesCloud(itemsToSave, (cur, tot, progressObj) => {
        const data = (typeof cur === 'object' && cur !== null)
          ? cur
          : (progressObj || { currentIndex: cur, total: tot, status: `Avaliando foto ${cur} de ${tot}...` });
        const { currentIndex, total, currentItem, status, attempt, maxAttempts, allResults } = data;
        
        setProgressState({
          current: currentIndex || cur || 1,
          total: total || tot || selectedFiles.length,
          statusText: status || `Avaliando foto ${cur} de ${tot}...`,
          attempt: attempt || 1,
          maxAttempts: maxAttempts || 1
        });

        if (currentItem && currentItem.id) {
          setFileStatuses((prev) => ({
            ...prev,
            [currentItem.id]: {
              status: status.includes('Aguardando') || status.includes('Repetindo') ? 'WAITING_RETRY' : 'PROCESSING',
              statusText: status,
              attempt
            }
          }));
        }

        // Atualiza status dos que já finalizaram
        if (Array.isArray(allResults)) {
          allResults.forEach((r) => {
            if (r.id) {
              setFileStatuses((prev) => ({
                ...prev,
                [r.id]: {
                  status: r.status === 'success' ? 'SUCCESS' : 'ERROR',
                  nota: r.extracted?.nota_final,
                  aluno: r.extracted?.aluno,
                  error: r.error
                }
              }));
            }
          });
        }
      });

      setFeedback({
        type: res.errorCount === 0 ? 'success' : 'warning',
        message: res.message
      });

      if (onRedacaoSaved) onRedacaoSaved();
    } catch (error) {
      setFeedback({
        type: 'error',
        message: `Erro no processamento: ${error.message || 'Falha ao avaliar redações.'}`
      });
    } finally {
      setIsProcessing(false);
      setProgressState(null);
    }
  };

  const handleRetrySingle = async (file) => {
    setFileStatuses((prev) => ({
      ...prev,
      [file.id]: { status: 'PROCESSING', statusText: 'Reavaliando com Gemini...' }
    }));

    try {
      const res = await processRedacoesCloud([{
        id: file.id,
        name: file.name,
        imagem_base64: file.base64,
        tipo_input: 'imagem',
        nome_manual: manualName.trim() || null,
        turma_manual: manualTurma.trim() || null
      }]);

      const result = res.results?.[0];
      if (result && result.status === 'success') {
        setFileStatuses((prev) => ({
          ...prev,
          [file.id]: {
            status: 'SUCCESS',
            nota: result.extracted?.nota_final,
            aluno: result.extracted?.aluno
          }
        }));
      } else {
        setFileStatuses((prev) => ({
          ...prev,
          [file.id]: {
            status: 'ERROR',
            error: result?.error || 'Erro na reavaliação'
          }
        }));
      }

      if (onRedacaoSaved) onRedacaoSaved();
    } catch (err) {
      setFileStatuses((prev) => ({
        ...prev,
        [file.id]: { status: 'ERROR', error: err.message }
      }));
    }
  };

  const handleSaveTypedText = async () => {
    if (!typedText.trim()) return;
    setIsProcessing(true);
    setFeedback(null);
    setProgressState({ current: 1, total: 1, statusText: 'Avaliando texto com IA...' });

    try {
      const res = await processRedacoesCloud([{
        texto_digitado: typedText.trim(),
        tipo_input: 'texto',
        nome_manual: manualName.trim() || null,
        turma_manual: manualTurma.trim() || null
      }]);

      setFeedback({
        type: 'success',
        message: res.message || 'Redação digitada avaliada e salva na nuvem com sucesso!'
      });

      setTypedText('');
      setManualName('');
      setManualTurma('');
      if (onRedacaoSaved) onRedacaoSaved();
    } catch (error) {
      setFeedback({
        type: 'error',
        message: `Erro na correção: ${error.message || 'Falha ao processar redação.'}`
      });
    } finally {
      setIsProcessing(false);
      setProgressState(null);
    }
  };

  const hasFailedItems = selectedFiles.some(f => fileStatuses[f.id]?.status === 'ERROR');

  const handleRetryAllFailed = async () => {
    const failedFiles = selectedFiles.filter(f => fileStatuses[f.id]?.status === 'ERROR');
    if (failedFiles.length === 0) return;

    setIsProcessing(true);
    setProgressState({
      current: 0,
      total: failedFiles.length,
      statusText: 'Reprocessando redações com falha...'
    });

    try {
      const itemsToSave = failedFiles.map((f) => ({
        id: f.id,
        name: f.name,
        imagem_base64: f.base64,
        tipo_input: 'imagem',
        nome_manual: manualName.trim() || null,
        turma_manual: manualTurma.trim() || null
      }));

      await processRedacoesCloud(itemsToSave, (cur, tot, progressObj) => {
        const data = (typeof cur === 'object' && cur !== null)
          ? cur
          : (progressObj || { currentIndex: cur, total: tot, status: `Avaliando foto ${cur} de ${tot}...` });
        const { currentIndex, total, currentItem, status, allResults } = data;
        setProgressState({ current: currentIndex || cur || 1, total: total || tot || failedFiles.length, statusText: status || `Avaliando foto ${cur} de ${tot}...` });

        if (currentItem && currentItem.id) {
          setFileStatuses((prev) => ({
            ...prev,
            [currentItem.id]: {
              status: status.includes('Aguardando') ? 'WAITING_RETRY' : 'PROCESSING',
              statusText: status
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
                  nota: r.extracted?.nota_final,
                  aluno: r.extracted?.aluno,
                  error: r.error
                }
              }));
            }
          });
        }
      });

      if (onRedacaoSaved) onRedacaoSaved();
    } finally {
      setIsProcessing(false);
      setProgressState(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 text-[#26251e]">
      
      {/* Module Title Header */}
      <div className="bg-[#ffffff] border border-[#e6e5e0] rounded-xl p-6 shadow-none flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-normal text-[#26251e] tracking-tight flex items-center gap-2">
            <Upload className="w-5 h-5 text-[#f54e00]" />
            Módulo de Envio & Lançamento de Redações
          </h2>
          <p className="text-xs text-[#5a5852] mt-1">
            Fila inteligente com controle de cota (RPM) e recuperação automática contra sobrecargas
          </p>
        </div>

        <div className="flex items-center gap-2 bg-[#fafaf7] border border-[#e6e5e0] px-3 py-1.5 rounded-lg text-xs text-[#5a5852]">
          <ShieldCheck className="w-4 h-4 text-[#9fc9a2]" />
          <span>Controle de cota: <strong>~12 req/min</strong></span>
        </div>
      </div>

      {/* Input Form Box */}
      <div className="bg-[#ffffff] border border-[#e6e5e0] rounded-xl p-6 shadow-none space-y-5">
        
        {/* Input Mode Selector */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setMode('imagem')}
            className={`py-3 px-4 rounded-md text-xs font-semibold flex items-center justify-center gap-2 border transition-all cursor-pointer ${
              mode === 'imagem'
                ? 'bg-[#26251e] text-white border-[#26251e]'
                : 'bg-[#fafaf7] border-[#e6e5e0] text-[#5a5852] hover:text-[#26251e]'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            Fotos / Imagens (Envio em Lote)
          </button>

          <button
            type="button"
            onClick={() => setMode('texto')}
            className={`py-3 px-4 rounded-md text-xs font-semibold flex items-center justify-center gap-2 border transition-all cursor-pointer ${
              mode === 'texto'
                ? 'bg-[#26251e] text-white border-[#26251e]'
                : 'bg-[#fafaf7] border-[#e6e5e0] text-[#5a5852] hover:text-[#26251e]'
            }`}
          >
            <Edit3 className="w-4 h-4" />
            Digitar / Colar Texto
          </button>
        </div>

        {/* Student Metadata Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="uploader-manual-name" className="block text-xs font-semibold text-[#5a5852] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-[#807d72]" aria-hidden="true" />
              Nome do Aluno (Opcional)
            </label>
            <input
              id="uploader-manual-name"
              name="nomeAluno"
              type="text"
              autoComplete="name"
              placeholder="IA extrai se houver no cabeçalho..."
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              className="w-full bg-[#fafaf7] border border-[#e6e5e0] rounded-md px-3.5 py-2.5 text-xs text-[#26251e] placeholder-[#807d72] focus:outline-none focus:ring-2 focus:ring-[#26251e] transition-colors"
            />
          </div>

          <div>
            <label htmlFor="uploader-manual-turma" className="block text-xs font-semibold text-[#5a5852] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <GraduationCap className="w-3.5 h-3.5 text-[#807d72]" aria-hidden="true" />
              Turma (Opcional)
            </label>
            <input
              id="uploader-manual-turma"
              name="turmaAluno"
              type="text"
              placeholder="ex: 3º Ano A - Ensino Médio..."
              value={manualTurma}
              onChange={(e) => setManualTurma(e.target.value)}
              className="w-full bg-[#fafaf7] border border-[#e6e5e0] rounded-md px-3.5 py-2.5 text-xs text-[#26251e] placeholder-[#807d72] focus:outline-none focus:ring-2 focus:ring-[#26251e] transition-colors"
            />
          </div>
        </div>

        {/* Mode 1: Image Batch Upload with Interactive Queue Cards */}
        {mode === 'imagem' && (
          <div className="space-y-4">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept="image/*"
              multiple
              aria-label="Selecionar arquivos de fotos de redação"
              className="hidden"
            />

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-[#cfcdc4] hover:border-[#26251e] bg-[#fafaf7] rounded-xl p-8 text-center cursor-pointer transition-all group"
            >
              <ImageIcon className="w-10 h-10 mx-auto text-[#807d72] group-hover:text-[#f54e00] transition-colors mb-3" aria-hidden="true" />
              <p className="text-sm font-semibold text-[#26251e]">
                Clique para selecionar uma ou <span className="text-[#f54e00]">múltiplas fotos de redação</span>
              </p>
              <p className="text-xs text-[#807d72] mt-1">
                Suporta PNG, JPG, JPEG e WEBP (Envio individual ou em lote)
              </p>
            </div>

            {/* Live Progress Bar during Batch Processing */}
            {progressState && (
              <div className="bg-[#fafaf7] border border-[#e6e5e0] rounded-lg p-4 space-y-2">
                <div className="flex justify-between items-center text-xs font-medium">
                  <span className="flex items-center gap-2 text-[#26251e]">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#f54e00]" />
                    {progressState.statusText || 'Processando lote...'}
                  </span>
                  <span className="font-mono text-[#5a5852]">
                    {progressState.current} de {progressState.total} ({Math.round((progressState.current / progressState.total) * 100)}%)
                  </span>
                </div>
                <div className="w-full bg-[#e6e5e0] rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-[#f54e00] h-full transition-all duration-300"
                    style={{ width: `${Math.round((progressState.current / progressState.total) * 100)}%` }}
                  />
                </div>
              </div>
            )}

            {/* Selected Files Queue Cards */}
            {selectedFiles.length > 0 && (
              <div className="space-y-3">
                <div className="text-xs font-semibold text-[#807d72] uppercase tracking-wider flex justify-between items-center">
                  <span>Fila de Fotos ({selectedFiles.length})</span>
                  <div className="flex items-center gap-3">
                    {hasFailedItems && !isProcessing && (
                      <button
                        type="button"
                        onClick={handleRetryAllFailed}
                        className="text-[#f54e00] hover:underline text-xs font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Reprocessar Falhas
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => { setSelectedFiles([]); setFileStatuses({}); }}
                      className="text-[#cf2d56] hover:underline text-xs font-normal cursor-pointer disabled:opacity-50"
                    >
                      Limpar tudo
                    </button>
                  </div>
                </div>

                <div className="max-h-72 overflow-y-auto space-y-2 custom-scrollbar pr-1">
                  {selectedFiles.map((file) => {
                    const statusInfo = fileStatuses[file.id] || { status: 'IDLE' };
                    const isItemProcessing = statusInfo.status === 'PROCESSING';
                    const isItemWaiting = statusInfo.status === 'WAITING_RETRY';
                    const isItemSuccess = statusInfo.status === 'SUCCESS';
                    const isItemError = statusInfo.status === 'ERROR';

                    return (
                      <div
                        key={file.id}
                        className={`flex items-center justify-between border rounded-lg p-3 text-xs transition-all ${
                          isItemSuccess
                            ? 'bg-[#f4f9f4] border-[#9fc9a2]'
                            : isItemError
                            ? 'bg-[#fff5f5] border-[#dfa88f]'
                            : isItemProcessing || isItemWaiting
                            ? 'bg-[#fffbf5] border-[#f54e00]'
                            : 'bg-[#fafaf7] border-[#e6e5e0]'
                        }`}
                      >
                        <div className="flex items-center gap-3 truncate">
                          {file.base64 ? (
                            <img
                              src={file.base64}
                              alt={file.name}
                              className="w-10 h-10 object-cover rounded border border-[#cfcdc4] shrink-0"
                            />
                          ) : (
                            <ImageIcon className="w-5 h-5 text-[#807d72] shrink-0" aria-hidden="true" />
                          )}
                          <div className="truncate">
                            <p className="truncate text-[#26251e] font-mono font-medium">{file.name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[11px] font-mono text-[#807d72]">{file.size}</span>
                              
                              {/* Status Badges */}
                              {isItemProcessing && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#f54e00]">
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  Avaliando com IA...
                                </span>
                              )}
                              {isItemWaiting && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#d04200]">
                                  <Clock className="w-3 h-3 animate-pulse" />
                                  {statusInfo.statusText || 'Aguardando cota...'}
                                </span>
                              )}
                              {isItemSuccess && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#2d7a32]">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Nota: <strong>{statusInfo.nota ?? 0} pts</strong> {statusInfo.aluno ? `(${statusInfo.aluno})` : ''}
                                </span>
                              )}
                              {isItemError && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#cf2d56]" title={statusInfo.error}>
                                  <AlertTriangle className="w-3 h-3" />
                                  Erro na avaliação
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {isItemError && !isProcessing && (
                            <button
                              type="button"
                              onClick={() => handleRetrySingle(file)}
                              className="px-2.5 py-1 bg-[#26251e] text-white rounded text-[11px] font-medium flex items-center gap-1 hover:bg-black cursor-pointer"
                              title="Tentar avaliar novamente esta foto"
                            >
                              <RefreshCw className="w-3 h-3" />
                              Repetir
                            </button>
                          )}
                          {!isProcessing && (
                            <button
                              type="button"
                              onClick={() => handleRemoveFile(file.id)}
                              aria-label={`Remover arquivo ${file.name}`}
                              className="text-[#807d72] hover:text-[#cf2d56] transition-colors p-1.5 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <button
              type="button"
              disabled={isProcessing || selectedFiles.length === 0}
              onClick={handleSaveImages}
              className="w-full h-11 bg-[#f54e00] hover:bg-[#d04200] text-white font-medium text-xs uppercase tracking-wider rounded-md transition-all shadow-none flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  <span>Processando Fila de Redações...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-white" aria-hidden="true" />
                  <span>Enviar & Corrigir {selectedFiles.length > 0 ? `${selectedFiles.length} ` : ''}Redação(ões) com IA</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Mode 2: Typed Text Input */}
        {mode === 'texto' && (
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="uploader-typed-text" className="block text-xs font-semibold text-[#5a5852] uppercase tracking-wider">
                  Texto Integral da Redação
                </label>
                <div className="text-[11px] font-mono text-[#807d72] flex items-center gap-3">
                  <span>Palavras: <strong className="text-[#26251e]">{wordCount}</strong></span>
                  <span>Linhas: <strong className="text-[#26251e]">{lineCount}</strong></span>
                </div>
              </div>

              <textarea
                id="uploader-typed-text"
                name="textoDigitado"
                rows={10}
                placeholder="Cole ou digite aqui o texto completo da redação do aluno para avaliação..."
                value={typedText}
                onChange={(e) => setTypedText(e.target.value)}
                className="w-full bg-[#fafaf7] border border-[#e6e5e0] rounded-md p-4 text-xs font-mono text-[#26251e] placeholder-[#807d72] focus:outline-none focus:ring-2 focus:ring-[#26251e] transition-colors custom-scrollbar"
              />
            </div>

            <button
              type="button"
              disabled={isProcessing || !typedText.trim()}
              onClick={handleSaveTypedText}
              className="w-full h-11 bg-[#f54e00] hover:bg-[#d04200] text-white font-medium text-xs uppercase tracking-wider rounded-md transition-all shadow-none flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  <span>Corrigindo com Inteligência Artificial...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-white" aria-hidden="true" />
                  <span>Enviar & Corrigir Redação Digitada com IA</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Feedback Banner */}
        {feedback && (
          <div
            role="status"
            aria-live="polite"
            className={`p-4 rounded-md border text-xs flex items-center gap-2.5 animate-fadeIn ${
              feedback.type === 'success'
                ? 'bg-[#9fc9a2] border-[#9fc9a2] text-[#26251e]'
                : feedback.type === 'warning'
                ? 'bg-[#fff3cd] border-[#ffeeba] text-[#856404]'
                : 'bg-[#dfa88f] border-[#dfa88f] text-[#26251e]'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

      </div>

    </div>
  );
}

