import React, { useState, useRef } from 'react';
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2, Image as ImageIcon, Plus, Trash2, Edit3, User, GraduationCap, Sparkles } from 'lucide-react';
import { processRedacoesCloud } from '../services/cloudCorrectionService';

export default function UploaderView({ onRedacaoSaved }) {
  const [mode, setMode] = useState('imagem');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [typedText, setTypedText] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualTurma, setManualTurma] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [feedback, setFeedback] = useState(null);
  const fileInputRef = useRef(null);

  // Live line and word counting
  const wordCount = typedText.trim() ? typedText.trim().split(/\s+/).length : 0;
  const lineCount = typedText.trim() ? typedText.split('\n').length : 0;

  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const filePromises = files.map((file) => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          resolve({
            name: file.name,
            size: (file.size / 1024).toFixed(1) + ' KB',
            base64: e.target?.result
          });
        };
        reader.readAsDataURL(file);
      });
    });

    Promise.all(filePromises).then((newFiles) => {
      setSelectedFiles((prev) => [...prev, ...newFiles]);
    });
  };

  const handleRemoveFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveImages = async () => {
    if (selectedFiles.length === 0) return;
    setIsProcessing(true);
    setFeedback(null);
    setProgressText('Iniciando avaliação...');

    try {
      const itemsToSave = selectedFiles.map((f) => ({
        imagem_base64: f.base64,
        tipo_input: 'imagem',
        nome_manual: manualName.trim() || null,
        turma_manual: manualTurma.trim() || null
      }));

      const res = await processRedacoesCloud(itemsToSave, (cur, total) => {
        setProgressText(`Avaliando Lote ${cur} de ${total}...`);
      });

      setFeedback({
        type: 'success',
        message: res.message || `${selectedFiles.length} redação(ões) avaliada(s) e salvas na nuvem com sucesso!`
      });

      setSelectedFiles([]);
      setManualName('');
      setManualTurma('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (onRedacaoSaved) onRedacaoSaved();
    } catch (error) {
      setFeedback({
        type: 'error',
        message: `Erro na correção: ${error.message || 'Falha ao processar redação.'}`
      });
    } finally {
      setIsProcessing(false);
      setProgressText('');
    }
  };

  const handleSaveTypedText = async () => {
    if (!typedText.trim()) return;
    setIsProcessing(true);
    setFeedback(null);
    setProgressText('Avaliando texto...');

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
      setProgressText('');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 text-[#26251e]">
      
      {/* Module Title Header */}
      <div className="bg-[#ffffff] border border-[#e6e5e0] rounded-xl p-6 shadow-none">
        <h2 className="text-2xl font-normal text-[#26251e] tracking-tight flex items-center gap-2">
          <Upload className="w-5 h-5 text-[#f54e00]" />
          Módulo de Envio & Lançamento de Redações
        </h2>
        <p className="text-xs text-[#5a5852] mt-1">
          Suporte a fotos/imagens de redações manuscritas (Lote) ou entrada por texto digitado
        </p>
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

        {/* Mode 1: Image Batch Upload */}
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

            {/* Selected Files List */}
            {selectedFiles.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-[#807d72] uppercase tracking-wider flex justify-between items-center">
                  <span>Imagens Selecionadas ({selectedFiles.length})</span>
                  <button
                    type="button"
                    onClick={() => setSelectedFiles([])}
                    className="text-[#cf2d56] hover:underline text-xs font-normal cursor-pointer"
                  >
                    Limpar tudo
                  </button>
                </div>

                <div className="max-h-48 overflow-y-auto space-y-2 custom-scrollbar pr-1">
                  {selectedFiles.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between bg-[#fafaf7] border border-[#e6e5e0] rounded-md p-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <ImageIcon className="w-4 h-4 text-[#807d72] shrink-0" aria-hidden="true" />
                        <span className="truncate text-[#26251e] font-mono">{file.name}</span>
                        <span className="text-xs font-mono text-[#807d72]">({file.size})</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(idx)}
                        aria-label={`Remover arquivo ${file.name}`}
                        className="text-[#807d72] hover:text-[#cf2d56] transition-colors p-1 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </div>
                  ))}
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
                  <span>Corrigindo com Inteligência Artificial...</span>
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
