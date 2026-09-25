import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ArrowLeft, ChevronLeft, ChevronRight, Award, UserCheck, 
  UserX, Image as ImageIcon, Save, Sparkles, BookOpen, 
  Quote, ShieldCheck, Compass, Copy, Check, Printer, 
  FileText, Download, Loader2, Edit3, Search, GraduationCap, 
  Link as LinkIcon, Unlink, AlertTriangle, Sliders, Eye, 
  RefreshCw, CheckCircle2, Clock, Share2, CheckCircle, ExternalLink,
  ZoomIn, ZoomOut, RotateCw, X
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { updateNomeAluno } from '../db/db';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/authService';
import FolhaOficialRedacao from './FolhaOficialRedacao';
import { TURMAS_ESCOLA, normalizeTurma } from '../constants/turmas';

const SISEDU_DESCRITORES_MAP = [
  { code: 'D05', title: 'D05: Interpretação Gráfica/Textual', desc: 'Compreensão da proposta e interpretação dos textos motivadores.' },
  { code: 'D06', title: 'D06: Identificação do Tema/Tese', desc: 'Identificação do tema e formulação de ponto de vista claro.' },
  { code: 'D12', title: 'D12: Coesão e Substituição Lexical', desc: 'Emprego de conectivos e pronomes para progressão textual.' },
  { code: 'D13', title: 'D13: Localização da Tese Central', desc: 'Posicionamento explícito e defesa de tese nos parágrafos.' },
  { code: 'D14', title: 'D14: Partes Principais e Secundárias', desc: 'Hierarquia de ideias e estruturação dos eixos argumentativos.' },
  { code: 'D15', title: 'D15: Posições Distintas / Contraposição', desc: 'Articulação de contra-argumentos e diferentes pontos de vista.' },
  { code: 'D16', title: 'D16: Articulação de Tese e Argumentos', desc: 'Relação lógica de causa, efeito e justificativa argumentativa.' },
  { code: 'D17', title: 'D17: Escolha Vocabular e Norma Culta', desc: 'Precisão lexical, registro formal e domínio gramatical.' },
  { code: 'D18', title: 'D18: Pontuação e Recursos Expressivos', desc: 'Uso adequado da pontuação e estruturação dos períodos sintáticos.' }
];

function getNivelBadgeClass(nivel) {
  const n = String(nivel || '').toLowerCase();
  if (n.includes('adequado') || n.includes('avançado') || n.includes('avancado')) {
    return 'bg-[#9fc9a2]/25 text-[#1f8a65] border-[#9fc9a2]';
  }
  if (n.includes('intermediário') || n.includes('intermediario') || n.includes('desenvolvimento') || n.includes('médio')) {
    return 'bg-[#c08532]/15 text-[#c08532] border-[#c08532]/30';
  }
  return 'bg-[#f54e00]/15 text-[#f54e00] border-[#f54e00]/30';
}

function renderInlineMarkdown(str) {
  if (!str) return '';
  const parts = str.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-bold text-[#26251e]">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

function FormattedFeedbackText({ text }) {
  if (!text) return null;

  let str = String(text).trim();

  // Se o texto for um bloco único sem quebras de linha, insere quebras de parágrafo naturais
  if (!str.includes('\n')) {
    str = str.replace(/\.\s+(Na Competência \d|A Competência \d|Por fim, a Competência \d|Sugere-se|Recomenda-se|No entanto, há fragilidades|Fragilidades Prioritárias|Diagnóstico Curricular)/g, '.\n\n$1');
  }

  const paragraphs = str
    .split(/\n{2,}|\r\n\r\n/)
    .map(p => p.trim())
    .filter(Boolean);

  const linesToRender = paragraphs.length > 0 ? paragraphs : str.split(/\n+/).map(p => p.trim()).filter(Boolean);

  return (
    <div className="space-y-3 text-xs sm:text-[13px] leading-relaxed text-[#26251e] font-sans">
      {linesToRender.map((para, idx) => (
        <p key={idx} className="leading-relaxed">
          {renderInlineMarkdown(para)}
        </p>
      ))}
    </div>
  );
}

function getParsedLines(text) {
  if (!text || text === 'Transcrição indisponível.') {
    return ['Transcrição indisponível.'];
  }
  const rawLines = text.split('\n');
  if (rawLines.length >= 4) {
    return rawLines;
  }
  const lines = [];
  rawLines.forEach(paragraph => {
    const trimmed = paragraph.trim();
    if (!trimmed) return;
    const sentences = trimmed.split(/(?<=[.!?])\s+/);
    sentences.forEach(s => {
      if (s.trim()) lines.push(s.trim());
    });
  });
  return lines.length ? lines : rawLines;
}

export default function CorrecaoDetalheView({ 
  redacao, 
  redacoes = [], 
  onBack, 
  onNavigateToRedacao, 
  onRedacaoUpdated 
}) {
  const { user, isAdmin, isEstudante } = useAuth();
  
  const [activeTab, setActiveTab] = useState('enem'); // 'enem' | 'texto_folha' | 'sisedu' | 'pdf_preview'
  const [manualName, setManualName] = useState(redacao?.nome_aluno || '');
  const [manualTurma, setManualTurma] = useState(redacao?.turma_aluno || '');
  const [isEditingName, setIsEditingName] = useState(false);
  const [isSavingName, setIsSavingName] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [statusValidacao, setStatusValidacao] = useState(redacao?.status_validacao || 'VALIDADA');

  // Customização do PDF Oficial
  const [customEscola, setCustomEscola] = useState('Projeto Ágora Escolar • Ensino Médio');
  const [customProfessor, setCustomProfessor] = useState('Professor(a) Avaliador(a)');
  const [customRecado, setCustomRecado] = useState('');
  const [showSisedu, setShowSisedu] = useState(true);
  const [showWatermark, setShowWatermark] = useState(true);
  const [showSignature, setShowSignature] = useState(true);
  const [pdfPageMode, setPdfPageMode] = useState('both'); // 'single' | 'both'
  const [isCustomizingPdf, setIsCustomizingPdf] = useState(false);

  // Seleção e vinculação de estudante
  const [estudantesList, setEstudantesList] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState(redacao?.user_id || '');
  const [isStudentPickerOpen, setIsStudentPickerOpen] = useState(false);
  const [studentSearchQuery, setStudentSearchQuery] = useState('');

  // Imagem em alta definição
  const [imagemBase64, setImagemBase64] = useState(redacao?.imagem_base64 || null);
  const [isLoadingImage, setIsLoadingImage] = useState(false);
  const [imageZoom, setImageZoom] = useState(1);
  const [imageRotation, setImageRotation] = useState(0);

  // Sincroniza estado quando a redação muda
  useEffect(() => {
    if (redacao) {
      setManualName(redacao.nome_aluno || redacao.extracted_data?.aluno || '');
      setManualTurma(redacao.turma_aluno || redacao.extracted_data?.turma || 'Sem Turma');
      setSelectedStudentId(redacao.user_id || '');
      setStatusValidacao(redacao.status_validacao || 'VALIDADA');
      setImageZoom(1);
      setImageRotation(0);

      // Carrega imagem em alta definição se não estiver presente
      if (!redacao.imagem_base64 && redacao.id && (redacao.tipo_input === 'imagem' || !redacao.tipo_input)) {
        setIsLoadingImage(true);
        authService.fetchRedacaoById(redacao.id)
          .then(full => {
            if (full?.imagem_base64) {
              setImagemBase64(full.imagem_base64);
            }
          })
          .catch(err => console.warn('Erro ao carregar imagem em alta definição:', err))
          .finally(() => setIsLoadingImage(false));
      } else {
        setImagemBase64(redacao.imagem_base64 || null);
      }
    }
  }, [redacao]);

  // Carrega lista de estudantes para o professor
  useEffect(() => {
    let isMounted = true;
    if (isAdmin) {
      const fetchFn = authService.fetchEstudantes ? authService.fetchEstudantes.bind(authService) : authService.getEstudantes.bind(authService);
      fetchFn().then(list => {
        if (isMounted && Array.isArray(list)) setEstudantesList(list);
      }).catch(() => {});
    }
    return () => { isMounted = false; };
  }, [isAdmin]);

  // Navegação sequencial (Próxima / Anterior)
  const currentIndex = useMemo(() => {
    if (!redacao || !redacoes.length) return -1;
    return redacoes.findIndex(r => String(r.id) === String(redacao.id));
  }, [redacao, redacoes]);

  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < redacoes.length - 1;

  const handleGoPrevious = () => {
    if (hasPrevious && onNavigateToRedacao) {
      onNavigateToRedacao(redacoes[currentIndex - 1]);
    }
  };

  const handleGoNext = () => {
    if (hasNext && onNavigateToRedacao) {
      onNavigateToRedacao(redacoes[currentIndex + 1]);
    }
  };

  // Atalhos de teclado (Setas para navegar e Esc para voltar)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;

      if (e.key === 'ArrowLeft' && hasPrevious) {
        handleGoPrevious();
      } else if (e.key === 'ArrowRight' && hasNext) {
        handleGoNext();
      } else if (e.key === 'Escape' && onBack) {
        onBack();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, hasPrevious, hasNext, redacoes]);

  if (!redacao) {
    return (
      <div className="p-12 text-center bg-[#ffffff] border border-[#e6e5e0] rounded-xl space-y-3">
        <AlertTriangle className="w-8 h-8 text-[#f54e00] mx-auto" />
        <h3 className="text-base font-semibold text-[#26251e]">Redação não encontrada</h3>
        <p className="text-xs text-[#807d72]">Esta redação não existe ou você não possui permissão para visualizá-la.</p>
        <button
          type="button"
          onClick={onBack}
          className="mt-2 px-4 py-2 bg-[#26251e] text-white text-xs font-mono rounded-lg cursor-pointer"
        >
          Voltar para a Lista
        </button>
      </div>
    );
  }

  // Extração e sanitização dos dados pedagógicos
  const rawExtracted = redacao.extracted_data;
  let data = {};
  if (typeof rawExtracted === 'string') {
    try { data = JSON.parse(rawExtracted); } catch (e) { data = {}; }
  } else {
    data = rawExtracted || {};
  }

  const avaliacoes = data.avaliacoes || {};
  const enem = avaliacoes.enem || {};
  const sisedu = avaliacoes.sisedu || avaliacoes.sisedu_agora || {};
  const siseduDescritores = sisedu.descritores || sisedu || {};
  const isConferida = Boolean(redacao.data_validacao || redacao.validado_por);

  // Cálculo rigoroso das 5 competências ENEM
  const c1Val = Number(enem.competencia_1?.nota ?? 0);
  const c2Val = Number(enem.competencia_2?.nota ?? 0);
  const c3Val = Number(enem.competencia_3?.nota ?? 0);
  const c4Val = Number(enem.competencia_4?.nota ?? 0);
  const c5Val = Number(enem.competencia_5?.nota ?? 0);
  const sumCompetencias = c1Val + c2Val + c3Val + c4Val + c5Val;
  const notaEnemCalculada = (enem.competencia_1 || enem.competencia_2) ? sumCompetencias : Number(enem.nota_total_enem ?? redacao.nota_final ?? 0);
  const devolutivaEnem = data.devolutiva_enem || (data.devolutiva_nivel_inicial && data.devolutiva_nivel_inicial.includes('Competência') ? data.devolutiva_nivel_inicial : null);
  const devolutivaSisedu = data.devolutiva_sisedu || (data.devolutiva_nivel_inicial && !data.devolutiva_nivel_inicial.includes('Competência') ? data.devolutiva_nivel_inicial : null) || data.devolutiva_nivel_inicial;

  const fullTextContent = redacao.texto_digitado || data.texto_transcrito || 'Transcrição indisponível.';

  const parsedLines = getParsedLines(fullTextContent);

  const handleCopyText = () => {
    navigator.clipboard.writeText(fullTextContent);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2500);
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/#correcao/${redacao.id}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // Salvar edição do nome e turma
  const handleSaveName = async (e) => {
    if (e) e.preventDefault();
    if (!manualName.trim()) return;
    setIsSavingName(true);
    try {
      const payload = {
        nome_aluno: manualName.trim(),
        turma_aluno: manualTurma.trim() || 'Sem Turma',
        user_id: selectedStudentId ? Number(selectedStudentId) : null
      };

      await authService.vincularAluno(redacao.id, payload);
      await updateNomeAluno(redacao.id, payload.nome_aluno, payload.turma_aluno);

      if (onRedacaoUpdated) {
        onRedacaoUpdated({
          ...redacao,
          ...payload,
          nome_detectado: true
        });
      }
      setIsEditingName(false);
    } catch (err) {
      console.error('Erro ao salvar nome:', err);
      alert('Erro ao salvar alterações: ' + err.message);
    } finally {
      setIsSavingName(false);
    }
  };

  // Validar redação pelo professor
  const handleValidarRedacao = async () => {
    setIsValidating(true);
    try {
      await authService.validarRedacao(redacao.id);
      setStatusValidacao('VALIDADA');
      if (onRedacaoUpdated) {
        onRedacaoUpdated({
          ...redacao,
          status_validacao: 'VALIDADA',
          data_validacao: new Date().toISOString(),
          validado_por: 1
        });
      }
    } catch (err) {
      alert(err.message || 'Erro ao validar redação.');
    } finally {
      setIsValidating(false);
    }
  };

  // Download do PDF Oficial (1 Página A4 Estrita)
  const handleDownloadPDF = async () => {
    const page1El = document.getElementById('pdf-export-page-1');
    const page2El = document.getElementById('pdf-export-page-2');
    if (!page1El) {
      setActiveTab('pdf_preview');
      alert('Carregando prévia do documento para exportação. Clique novamente em Baixar PDF.');
      return;
    }

    setIsGeneratingPDF(true);
    try {
      if (document.fonts) {
        await document.fonts.ready;
      }

      const studentNameClean = String(manualName || redacao.nome_aluno || 'Estudante').replace(/[^a-zA-Z0-9_]/g, '_');
      const filename = `Boletim_Redacao_${studentNameClean}_ID${redacao.id}.pdf`;

      const canvasOptions = {
        scale: 3,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        scrollX: 0,
        scrollY: 0,
        onclone: (clonedDoc) => {
          if (document.fonts && clonedDoc.fonts) {
            document.fonts.forEach(font => {
              try { clonedDoc.fonts.add(font); } catch (e) {}
            });
          }
        }
      };

      const canvas1 = await html2canvas(page1El, canvasOptions);
      const imgData1 = canvas1.toDataURL('image/png');

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      pdf.addImage(imgData1, 'PNG', 0, 0, 210, 297, undefined, 'FAST');

      if (page2El && page2El.style.display !== 'none' && window.getComputedStyle(page2El).display !== 'none') {
        const canvas2 = await html2canvas(page2El, canvasOptions);
        const imgData2 = canvas2.toDataURL('image/png');
        pdf.addPage('a4', 'portrait');
        pdf.addImage(imgData2, 'PNG', 0, 0, 210, 297, undefined, 'FAST');
      }

      pdf.save(filename);
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      alert('Falha ao gerar o arquivo PDF: ' + error.message);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  // Cor do Score Hero
  let scoreTheme = {
    bg: 'bg-[#f54e00]/10',
    border: 'border-[#f54e00]/25',
    text: 'text-[#f54e00]',
    label: 'Atenção / Regular'
  };
  if (notaEnemCalculada >= 800) {
    scoreTheme = {
      bg: 'bg-[#1f8a65]/10',
      border: 'border-[#1f8a65]/30',
      text: 'text-[#1f8a65]',
      label: 'Excelente / Top Desempenho'
    };
  } else if (notaEnemCalculada >= 600) {
    scoreTheme = {
      bg: 'bg-[#c08532]/10',
      border: 'border-[#c08532]/30',
      text: 'text-[#c08532]',
      label: 'Bom / Em Evolução'
    };
  }

  const competenciasList = [
    { key: 'competencia_1', num: 1, title: 'Domínio da Norma Culta', score: c1Val, data: enem.competencia_1 },
    { key: 'competencia_2', num: 2, title: 'Compreensão do Tema & Repertório', score: c2Val, data: enem.competencia_2 },
    { key: 'competencia_3', num: 3, title: 'Projeto de Texto & Argumentação', score: c3Val, data: enem.competencia_3 },
    { key: 'competencia_4', num: 4, title: 'Coesão & Recursos Coesivos', score: c4Val, data: enem.competencia_4 },
    { key: 'competencia_5', num: 5, title: 'Proposta de Intervenção Social', score: c5Val, data: enem.competencia_5 },
  ];

  return (
    <div className="space-y-5 animate-fadeIn pb-12">
      
      {/* ======================================================== */}
      {/* 1. TOP BAR: BREADCRUMBS, VOLTAR & ESTEIRA SEQUENCIAL     */}
      {/* ======================================================== */}
      <div className="bg-[#ffffff] border border-[#e6e5e0] rounded-xl p-3.5 sm:p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3.5">
        
        {/* Lado Esquerdo: Botão Voltar & Breadcrumb */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="px-3 py-1.5 bg-[#fafaf7] hover:bg-[#e6e5e0] border border-[#e6e5e0] text-[#26251e] text-xs font-mono font-medium rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
            title="Voltar para a página anterior (Esc)"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar</span>
          </button>

          <div className="h-5 w-px bg-[#e6e5e0]" />

          <div className="flex items-center gap-1.5 text-xs font-mono text-[#807d72] truncate">
            <span>Redações</span>
            <span>/</span>
            <strong className="text-[#26251e] font-mono">#{String(redacao.id).padStart(4, '0')}</strong>
            <span>-</span>
            <span className="truncate max-w-[200px] text-[#26251e] font-sans font-medium">
              {manualName || redacao.nome_aluno || 'Estudante'}
            </span>
          </div>
        </div>

        {/* Lado Direito: Navegação Anterior / Próxima & Botões de Ação */}
        <div className="flex items-center gap-2 flex-wrap justify-between md:justify-end">
          
          {/* Navegador Sequencial */}
          {redacoes.length > 0 && currentIndex >= 0 && (
            <div className="flex items-center gap-1 bg-[#fafaf7] border border-[#e6e5e0] p-1 rounded-lg text-xs font-mono">
              <button
                type="button"
                disabled={!hasPrevious}
                onClick={handleGoPrevious}
                className="p-1 text-[#26251e] hover:bg-[#e6e5e0] rounded disabled:opacity-30 cursor-pointer"
                title="Redação Anterior (Seta Esquerda)"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 font-medium text-[#807d72]">
                {currentIndex + 1} de {redacoes.length}
              </span>
              <button
                type="button"
                disabled={!hasNext}
                onClick={handleGoNext}
                className="p-1 text-[#26251e] hover:bg-[#e6e5e0] rounded disabled:opacity-30 cursor-pointer"
                title="Próxima Redação (Seta Direita)"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Copiar Link Rápido */}
          <button
            type="button"
            onClick={handleCopyLink}
            className="px-3 py-1.5 bg-[#ffffff] hover:bg-[#fafaf7] border border-[#e6e5e0] text-[#26251e] text-xs font-mono rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
            title="Copiar Link Direto para Compartilhar"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-[#1f8a65]" /> : <Share2 className="w-3.5 h-3.5 text-[#807d72]" />}
            <span>{copiedLink ? 'Link Copiado!' : 'Copiar Link'}</span>
          </button>

          {/* Imprimir / PDF Vetorial */}
          <button
            type="button"
            onClick={() => window.print()}
            className="px-3 py-1.5 bg-[#ffffff] hover:bg-[#fafaf7] border border-[#e6e5e0] text-[#26251e] text-xs font-mono rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
            title="Imprimir direto ou salvar como PDF nativo do navegador"
          >
            <Printer className="w-3.5 h-3.5 text-[#807d72]" />
            <span>Imprimir</span>
          </button>

          {/* Baixar PDF Oficial */}
          <button
            type="button"
            disabled={isGeneratingPDF}
            onClick={handleDownloadPDF}
            className="px-3.5 py-1.5 bg-[#f54e00] hover:bg-[#d04200] text-white text-xs font-mono font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-50"
          >
            {isGeneratingPDF ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Gerando PDF...</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>Baixar PDF Oficial</span>
              </>
            )}
          </button>

        </div>

      </div>

      {/* ======================================================== */}
      {/* 2. HERO CARD: DADOS DO ALUNO & NOTA HERO                 */}
      {/* ======================================================== */}
      <div className="bg-[#ffffff] border border-[#e6e5e0] rounded-xl p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          
          {/* Dados do Estudante & Edição */}
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-[#26251e] text-white">
                ID #{String(redacao.id).padStart(4, '0')}
              </span>

              {isConferida ? (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-[#9fc9a2]/25 text-[#1f8a65] border border-[#9fc9a2] inline-flex items-center gap-1">
                  <Check className="w-3 h-3" /> Conferida pelo Professor
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-[#f54e00]/15 text-[#f54e00] border border-[#f54e00]/30 inline-flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Pendente de Conferência
                </span>
              )}

              {redacao.tipo_input === 'imagem' && (
                <span className="px-2 py-0.5 rounded text-[11px] font-mono text-[#807d72] bg-[#fafaf7] border border-[#e6e5e0]">
                  Folha Escaneada (OCR)
                </span>
              )}
            </div>

            {/* Nome do Aluno */}
            {isEditingName && isAdmin ? (
              <form onSubmit={handleSaveName} className="flex flex-wrap items-center gap-2 pt-1">
                <input
                  type="text"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="Nome do aluno..."
                  className="px-3 py-1.5 bg-[#fafaf7] border border-[#26251e] rounded-md text-sm font-semibold text-[#26251e] focus:outline-none"
                />
                <select
                  value={manualTurma}
                  onChange={(e) => setManualTurma(e.target.value)}
                  className="px-2.5 py-1.5 bg-[#fafaf7] border border-[#e6e5e0] rounded-md text-xs font-mono cursor-pointer"
                >
                  {TURMAS_ESCOLA.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={isSavingName}
                  className="px-3 py-1.5 bg-[#1f8a65] text-white text-xs font-mono font-semibold rounded-md hover:bg-[#187052] cursor-pointer"
                >
                  {isSavingName ? 'Salvando...' : 'Salvar'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingName(false)}
                  className="px-2.5 py-1.5 bg-[#fafaf7] text-[#807d72] hover:text-[#26251e] text-xs font-mono rounded-md cursor-pointer"
                >
                  Cancelar
                </button>
              </form>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold text-[#26251e] tracking-tight">
                  {manualName || redacao.nome_aluno || 'Estudante Não Identificado'}
                </h1>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setIsEditingName(true)}
                    className="p-1 text-[#807d72] hover:text-[#26251e] rounded hover:bg-[#fafaf7] cursor-pointer"
                    title="Editar Nome e Turma"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}

            <div className="flex items-center gap-3 text-xs font-mono text-[#807d72] flex-wrap">
              <span>Turma: <strong className="text-[#26251e] font-sans">{manualTurma || redacao.turma_aluno || 'Sem Turma'}</strong></span>
              <span>•</span>
              <span>Data: {redacao.data_captura ? new Date(redacao.data_captura).toLocaleDateString('pt-BR') : 'Hoje'}</span>
              {redacao.user_id && (
                <>
                  <span>•</span>
                  <span className="text-[#1f8a65]">ID Usuário: #{redacao.user_id}</span>
                </>
              )}
            </div>
          </div>

          {/* Hero Score Badge */}
          <div className={`p-4 rounded-xl border flex items-center gap-4 shrink-0 ${scoreTheme.bg} ${scoreTheme.border}`}>
            <div>
              <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-[#807d72] block">
                Nota Total ENEM
              </span>
              <div className="flex items-baseline gap-1">
                <span className={`text-3xl sm:text-4xl font-black font-mono tracking-tight ${scoreTheme.text}`}>
                  {notaEnemCalculada}
                </span>
                <span className="text-xs font-mono text-[#807d72]">/ 1000 pts</span>
              </div>
              <span className={`text-[11px] font-medium block mt-0.5 ${scoreTheme.text}`}>
                {scoreTheme.label}
              </span>
            </div>

            {/* Quick Circular Indicator */}
            <div className="w-14 h-14 rounded-full border-4 border-current flex items-center justify-center font-mono font-bold text-xs shrink-0 opacity-80" style={{ color: notaEnemCalculada >= 800 ? '#1f8a65' : notaEnemCalculada >= 600 ? '#c08532' : '#f54e00' }}>
              {Math.round((notaEnemCalculada / 1000) * 100)}%
            </div>
          </div>

        </div>
      </div>

      {/* ======================================================== */}
      {/* 3. ABAS DE NAVEGAÇÃO DO BOLETIM                          */}
      {/* ======================================================== */}
      <div className="bg-[#fafaf7] border border-[#e6e5e0] p-1.5 rounded-xl flex items-center gap-1 overflow-x-auto custom-scrollbar shadow-xs">
        <button
          type="button"
          onClick={() => setActiveTab('enem')}
          className={`px-4 py-2 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'enem'
              ? 'bg-[#26251e] text-white shadow-xs'
              : 'text-[#807d72] hover:text-[#26251e]'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>1. Matriz ENEM (C1 a C5)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('texto_folha')}
          className={`px-4 py-2 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'texto_folha'
              ? 'bg-[#26251e] text-white shadow-xs'
              : 'text-[#807d72] hover:text-[#26251e]'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>2. Folha Original & Transcrição</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('sisedu')}
          className={`px-4 py-2 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'sisedu'
              ? 'bg-[#26251e] text-white shadow-xs'
              : 'text-[#807d72] hover:text-[#26251e]'
          }`}
        >
          <Compass className="w-4 h-4" />
          <span>3. Matriz Sisedu & Diagnóstico</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('pdf_preview')}
          className={`px-4 py-2 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'pdf_preview'
              ? 'bg-[#26251e] text-white shadow-xs'
              : 'text-[#807d72] hover:text-[#26251e]'
          }`}
        >
          <Printer className="w-4 h-4" />
          <span>4. Documento Oficial / PDF</span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* ABA 1: MATRIZ ENEM (COMPETÊNCIAS 1 A 5)                  */}
      {/* ======================================================== */}
      {activeTab === 'enem' && (
        <div className="space-y-4 animate-fadeIn">

          {/* Devolutiva Pedagógica ENEM */}
          {devolutivaEnem && (
            <div className="bg-[#1f8a65]/10 border border-[#1f8a65]/30 rounded-xl p-4 sm:p-5 space-y-2.5 shadow-xs animate-fadeIn">
              <div className="flex items-center gap-2 text-[#1f8a65] font-bold text-xs font-mono uppercase tracking-wider pb-1 border-b border-[#1f8a65]/20">
                <Award className="w-4 h-4 shrink-0" />
                <span>Parecer & Diretrizes Pedagógicas — Matriz ENEM</span>
              </div>
              <FormattedFeedbackText text={devolutivaEnem} />
            </div>
          )}

          {/* Grid de Competências */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {competenciasList.map((comp) => {
              const compScore = Number(comp.score || 0);
              const pct = Math.round((compScore / 200) * 100);
              return (
                <div key={comp.key} className="bg-[#ffffff] border border-[#e6e5e0] rounded-xl p-4 space-y-2 shadow-xs">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="font-bold text-[#f54e00]">C{comp.num}</span>
                    <span className="font-bold text-[#26251e]">{compScore} / 200</span>
                  </div>
                  <div className="text-xs font-semibold text-[#26251e] line-clamp-1">
                    {comp.title}
                  </div>
                  <div className="w-full bg-[#e6e5e0] h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-500"
                      style={{ 
                        width: `${pct}%`,
                        backgroundColor: compScore >= 160 ? '#1f8a65' : compScore >= 120 ? '#c08532' : '#f54e00' 
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Cards Detalhados de Cada Competência */}
          <div className="space-y-3">
            {competenciasList.map((comp) => {
              const compScore = Number(comp.score || 0);
              const cData = comp.data || {};
              return (
                <div key={comp.key} className="bg-[#ffffff] border border-[#e6e5e0] rounded-xl p-5 space-y-3 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#e6e5e0] pb-3">
                    <div className="space-y-0.5">
                      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#fafaf7] border border-[#e6e5e0] text-xs font-mono font-bold text-[#f54e00]">
                        Competência {comp.num}
                      </div>
                      <h3 className="text-base font-semibold text-[#26251e]">
                        {comp.title}
                      </h3>
                    </div>
                    <div className="px-3 py-1 rounded-lg bg-[#fafaf7] border border-[#e6e5e0] font-mono font-bold text-sm text-[#26251e]">
                      {compScore} <span className="text-xs font-normal text-[#807d72]">/ 200 pts</span>
                    </div>
                  </div>

                  {/* Justificativa Pedagógica */}
                  <div className="text-xs text-[#5a5852] leading-relaxed">
                    <strong className="text-[#26251e] block mb-1 font-mono uppercase text-[11px]">Justificativa da Avaliação:</strong>
                    <p>{cData.justificativa || cData.comentario || 'Critério avaliado com base na matriz oficial do ENEM.'}</p>
                  </div>

                  {/* Detalhamento Especial para C5 (Proposta de Intervenção) */}
                  {comp.num === 5 && cData.elementos && (
                    <div className="pt-2 border-t border-[#f1f5f9] grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs font-mono">
                      {Object.entries(cData.elementos).map(([elemKey, elemVal]) => (
                        <div key={elemKey} className="p-2 rounded bg-[#fafaf7] border border-[#e6e5e0] text-center">
                          <span className="text-[10px] uppercase text-[#807d72] block">{elemKey}</span>
                          <strong className={elemVal ? 'text-[#1f8a65]' : 'text-[#f54e00]'}>
                            {elemVal ? 'Presente' : 'Ausente'}
                          </strong>
                        </div>
                      ))}
                    </div>
                  )}

                </div>
              );
            })}
          </div>

        </div>
      )}

      {/* ======================================================== */}
      {/* ABA 2: FOLHA MANUSCRITA & TRANSCRIÇÃO PAUTADA            */}
      {/* ======================================================== */}
      {activeTab === 'texto_folha' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start animate-fadeIn">
          
          {/* Coluna Esquerda: Transcrição Pautada (Linhas 01 a 30) */}
          <div className="lg:col-span-6 bg-[#ffffff] border border-[#e6e5e0] rounded-xl p-5 space-y-3 shadow-xs">
            <div className="flex items-center justify-between border-b border-[#e6e5e0] pb-3">
              <h3 className="text-sm font-semibold text-[#26251e] flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#f54e00]" />
                <span>Transcrição Pautada Oficial</span>
              </h3>
              <button
                type="button"
                onClick={handleCopyText}
                className="px-2.5 py-1 bg-[#fafaf7] hover:bg-[#e6e5e0] border border-[#e6e5e0] text-[#26251e] text-[11px] font-mono rounded transition-colors cursor-pointer flex items-center gap-1"
              >
                {copiedText ? <Check className="w-3 h-3 text-[#1f8a65]" /> : <Copy className="w-3 h-3 text-[#807d72]" />}
                <span>{copiedText ? 'Copiado!' : 'Copiar Texto'}</span>
              </button>
            </div>

            <div className="bg-[#fafaf7] border border-[#e6e5e0] rounded-lg p-4 font-mono text-xs text-[#26251e] leading-relaxed max-h-[600px] overflow-y-auto custom-scrollbar whitespace-pre-wrap divide-y divide-[#e6e5e0]/40">
              {parsedLines.map((line, idx) => (
                <div key={idx} className="py-1 flex items-start gap-3">
                  <span className="text-[#5a5852] select-none font-mono font-medium text-[11px] w-6 shrink-0 text-right">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <span className="flex-1 font-serif text-sm text-[#26251e] leading-relaxed">
                    {line || <span className="opacity-0">—</span>}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Coluna Direita: Foto Escaneada em Alta Resolução */}
          <div className="lg:col-span-6 bg-[#ffffff] border border-[#e6e5e0] rounded-xl p-5 space-y-3 shadow-xs">
            <div className="flex items-center justify-between border-b border-[#e6e5e0] pb-3">
              <h3 className="text-sm font-semibold text-[#26251e] flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-[#1f8a65]" />
                <span>Folha Escaneada Original</span>
              </h3>

              {imagemBase64 && (
                <div className="flex items-center gap-1 bg-[#fafaf7] border border-[#e6e5e0] p-1 rounded-md text-xs font-mono">
                  <button
                    type="button"
                    onClick={() => setImageZoom(prev => Math.min(prev + 0.25, 2.5))}
                    className="p-1 text-[#807d72] hover:text-[#26251e] rounded hover:bg-[#e6e5e0] cursor-pointer"
                    title="Aumentar Zoom"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageZoom(prev => Math.max(prev - 0.25, 0.75))}
                    className="p-1 text-[#807d72] hover:text-[#26251e] rounded hover:bg-[#e6e5e0] cursor-pointer"
                    title="Diminuir Zoom"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageRotation(prev => (prev + 90) % 360)}
                    className="p-1 text-[#807d72] hover:text-[#26251e] rounded hover:bg-[#e6e5e0] cursor-pointer"
                    title="Girar 90°"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => { setImageZoom(1); setImageRotation(0); }}
                    className="px-1.5 py-0.5 text-[10px] text-[#807d72] hover:text-[#26251e] rounded hover:bg-[#e6e5e0] cursor-pointer"
                  >
                    Reset
                  </button>
                </div>
              )}
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 max-h-[600px] overflow-y-auto custom-scrollbar flex flex-col items-center">
              {isLoadingImage ? (
                <div className="h-64 flex flex-col items-center justify-center gap-2 text-slate-300 text-xs font-mono">
                  <Loader2 className="w-6 h-6 animate-spin text-[#f54e00]" />
                  <span>Carregando folha original...</span>
                </div>
              ) : imagemBase64 ? (
                <div 
                  className="w-full transition-transform duration-200 origin-top flex flex-col items-center"
                  style={{
                    transform: `scale(${imageZoom}) rotate(${imageRotation}deg)`,
                    transformOrigin: 'top center'
                  }}
                >
                  <img
                    src={imagemBase64}
                    alt={`Folha #${redacao.id}`}
                    className="w-full h-auto rounded shadow-2xl bg-white select-none"
                  />
                </div>
              ) : (
                <div className="h-64 w-full flex flex-col items-center justify-center p-6 text-center text-slate-400 space-y-2">
                  <FileText className="w-8 h-8 text-slate-600" />
                  <p className="text-xs font-mono">Esta redação foi submetida em texto digitado (sem folha física escaneada).</p>
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* ======================================================== */}
      {/* ABA 3: MATRIZ SISEDU & DIAGNÓSTICO                       */}
      {/* ======================================================== */}
      {activeTab === 'sisedu' && (
        <div className="space-y-4 animate-fadeIn">
          
          {/* Alerta de Devolutiva Pedagógica SISEDU se houver */}
          {(devolutivaSisedu || Object.values(siseduDescritores).some(d => String(d?.nivel || '').toLowerCase().includes('inicial'))) && (
            <div className="bg-[#f54e00]/10 border border-[#f54e00]/30 rounded-xl p-4 sm:p-5 space-y-2.5 shadow-xs animate-fadeIn">
              <div className="flex items-center gap-2 text-[#f54e00] font-bold text-xs font-mono uppercase tracking-wider pb-1 border-b border-[#f54e00]/20">
                <Compass className="w-4 h-4 shrink-0" />
                <span>Plano de Intervenção Pedagógica — Matriz SISEDU / SPAECE</span>
              </div>
              <FormattedFeedbackText 
                text={devolutivaSisedu || "Atenção: O estudante apresentou descritores em Nível Inicial. Recomenda-se aplicar atividade direcionada de reescrita com suporte em conectores argumentativos e substituição lexical antes do próximo ciclo de avaliação."} 
              />
            </div>
          )}

          <div className="bg-[#ffffff] border border-[#e6e5e0] rounded-xl p-5 space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#e6e5e0] pb-3">
              <div>
                <h3 className="text-sm font-semibold text-[#26251e] flex items-center gap-2">
                  <Compass className="w-4 h-4 text-[#f54e00]" />
                  <span>Matriz de Descritores Regionais (Sisedu / SPAECE)</span>
                </h3>
                <p className="text-xs text-[#807d72] mt-0.5">
                  Mapeamento curricular de habilidades e competências avaliadas na produção textual.
                </p>
              </div>

              {sisedu.nivel_global && (
                <div className="flex items-center gap-1.5 font-mono text-xs">
                  <span className="text-[#807d72]">Nível Global:</span>
                  <span className={`px-2.5 py-0.5 rounded-full font-bold border ${getNivelBadgeClass(sisedu.nivel_global)}`}>
                    {sisedu.nivel_global}
                  </span>
                </div>
              )}
            </div>

            {/* Grid dos 9 Descritores (D05 a D18) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {SISEDU_DESCRITORES_MAP.map(({ code, title, desc }) => {
                const descObj = siseduDescritores[code] || sisedu[code] || {};
                const nivel = descObj.nivel || (code === 'D15' ? 'Inicial' : 'Intermediário');
                const justificativa = descObj.justificativa || descObj.parecer || descObj.descricao || desc;
                const citacao = descObj.citacao_texto;

                return (
                  <div key={code} className="bg-[#fafaf7] border border-[#e6e5e0] rounded-lg p-3.5 space-y-2 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="font-semibold text-xs text-[#26251e] leading-snug">
                          {descObj.nome ? `${code}: ${descObj.nome}` : title}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border shrink-0 ${getNivelBadgeClass(nivel)}`}>
                          {nivel}
                        </span>
                      </div>

                      <p className="text-[11px] text-[#5a5852] font-sans leading-relaxed">
                        {justificativa}
                      </p>
                    </div>

                    {citacao && (
                      <div className="mt-2 pt-2 border-t border-[#e6e5e0]/60 bg-[#ffffff] p-2 rounded border border-[#e6e5e0] text-[10px] text-[#26251e] flex items-start gap-1.5 font-mono">
                        <Quote className="w-3 h-3 text-[#f54e00] shrink-0 mt-0.5" />
                        <span className="italic truncate line-clamp-2">"{citacao}"</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* SEÇÃO QUALITATIVA FORMATIVA: DIMENSÃO DISCURSIVA & DIMENSÃO ÉTICO-CRÍTICA (ÁGORA ESCOLAR) */}
          {/* SEÇÃO QUALITATIVA FORMATIVA: DIMENSÃO DISCURSIVA & DIMENSÃO ÉTICO-CRÍTICA (ÁGORA ESCOLAR) */}
          {(() => {
            const dClarezaNivel = sisedu.dimensao_discursiva?.clareza_tese?.nivel || (c3Val >= 160 && c2Val >= 160 ? 'Avançado' : (c3Val >= 120 ? 'Adequado' : 'Inicial'));
            const dClarezaJust = sisedu.dimensao_discursiva?.clareza_tese?.justificativa || (
              dClarezaNivel === 'Avançado'
                ? 'Apresenta tese explícita e claramente articulada no parágrafo introdutório, estabelecendo direcionamento argumentativo seguro e objetivo.'
                : dClarezaNivel === 'Adequado'
                ? 'Apresenta posicionamento discernível no texto, delimitando os pontos centrais a serem defendidos.'
                : 'Tese pouco nítida ou difusa na introdução, demandando maior clareza no posicionamento do autor.'
            );

            const dProgNivel = sisedu.dimensao_discursiva?.argumentacao?.nivel || (c3Val >= 160 ? 'Avançado' : (c3Val >= 120 ? 'Adequado' : 'Inicial'));
            const dProgJust = sisedu.dimensao_discursiva?.argumentacao?.justificativa || (
              dProgNivel === 'Avançado'
                ? 'Desenvolve tópicos frasais estruturados com progressão lógica entre as causas e os efeitos abordados ao longo do texto.'
                : dProgNivel === 'Adequado'
                ? 'Estrutura argumentos coerentes com a proposta, apresentando encadeamento funcional entre os parágrafos.'
                : 'Apresenta lacunas na progressão temática ou argumentos com fragilidade de fundamentação.'
            );

            const dRepNivel = sisedu.dimensao_discursiva?.repertorio?.nivel || (c2Val >= 160 ? 'Avançado' : (c2Val >= 120 ? 'Adequado' : 'Inicial'));
            const dRepJust = sisedu.dimensao_discursiva?.repertorio?.justificativa || (
              dRepNivel === 'Avançado'
                ? 'Mobiliza referências das ciências humanas com vínculo produtivo e autoral ao cerne da tese apresentada.'
                : dRepNivel === 'Adequado'
                ? 'Utiliza repertório legítimo e pertinente à discussão temática proposta.'
                : 'Repertório restrito aos textos motivadores ou com articulação mecânica/insuficiente.'
            );

            const rawEmpatia = sisedu.dimensao_etico_critica?.empatia_alteridade || sisedu.dimensao_etico_moral?.empatia_alteridade || sisedu.dimensao_etico_critica?.direitos_humanos;
            const eEmpatiaNivel = rawEmpatia?.nivel || (c5Val >= 160 ? 'Avançado' : (c5Val >= 120 ? 'Adequado' : 'Inicial'));
            const eEmpatiaJust = rawEmpatia?.justificativa || (
              eEmpatiaNivel === 'Avançado'
                ? 'Demonstra forte sensibilidade em relação ao sofrimento alheio e à superação de preconceitos estruturais contra a população vulnerável.'
                : eEmpatiaNivel === 'Adequado'
                ? 'Reconhece a condição dos grupos sociais afetados pela temática, mantendo postura respeitosa e alinhada aos direitos humanos.'
                : 'Apresenta abordagem incipiente da alteridade, necessitando de maior aprofundamento sobre a empatia com os grupos vulneráveis.'
            );

            const rawMoral = sisedu.dimensao_etico_critica?.justificacao_moral || sisedu.dimensao_etico_moral?.justificacao_moral || sisedu.dimensao_etico_critica?.justificativa_critica || sisedu.dimensao_etico_moral?.justificacao_axiologica;
            const eMoralNivel = rawMoral?.nivel || ((c3Val >= 160 && c5Val >= 120) ? 'Avançado' : (c3Val >= 120 ? 'Adequado' : 'Inicial'));
            const eMoralJust = rawMoral?.justificativa || (
              eMoralNivel === 'Avançado'
                ? 'Fundamenta a necessidade de justiça social com base em princípios éticos de responsabilidade coletiva e dignidade humana.'
                : eMoralNivel === 'Adequado'
                ? 'Articula valores cívicos e responsabilidade social de forma pertinente ao longo da fundamentação argumentativa.'
                : 'Fundamentação moral e ética básica, demandando articulação mais sólida dos valores de cidadania e bem coletivo.'
            );

            const rawConclusao = sisedu.dimensao_etico_critica?.conclusao_critica || sisedu.dimensao_etico_moral?.conclusao_critica || sisedu.dimensao_etico_critica?.eficacia_proposta || sisedu.dimensao_etico_moral?.eficacia_proposta;
            const eConclusaoNivel = rawConclusao?.nivel || (c5Val >= 160 ? 'Avançado' : (c5Val >= 120 ? 'Adequado' : 'Inicial'));
            const eConclusaoJust = rawConclusao?.justificativa || (
              eConclusaoNivel === 'Avançado'
                ? 'A conclusão vai além da mera burocracia estatal, propondo uma transformação cultural e solidária na mentalidade da sociedade.'
                : eConclusaoNivel === 'Adequado'
                ? 'Apresenta proposta de intervenção consistente e aplicável para o enfrentamento prático da problemática.'
                : 'Proposta de intervenção restrita ou elementar, necessitando de maior detalhamento e visão transformadora.'
            );

            return (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                
                {/* CARD 1: DIMENSÃO DISCURSIVA */}
                <div className="bg-[#ffffff] border border-[#26251e] rounded-xl p-5 shadow-xs space-y-3.5">
                  <h4 className="text-xs font-bold text-[#26251e] uppercase tracking-wider font-mono border-b border-[#e6e5e0] pb-2">
                    DIMENSÃO DISCURSIVA
                  </h4>

                  <div className="space-y-3 divide-y divide-[#e6e5e0]/70">
                    <div className="pt-2 first:pt-0 space-y-1">
                      <div className="flex justify-between items-baseline">
                        <span className="font-bold text-xs text-[#26251e]">Clareza da Tese:</span>
                        <span className="font-bold text-xs text-[#26251e] underline underline-offset-2">
                          {dClarezaNivel}
                        </span>
                      </div>
                      <p className="text-xs text-[#5a5852] leading-relaxed">
                        {dClarezaJust}
                      </p>
                    </div>

                    <div className="pt-3 space-y-1">
                      <div className="flex justify-between items-baseline">
                        <span className="font-bold text-xs text-[#26251e]">Consistência e Progressão:</span>
                        <span className="font-bold text-xs text-[#26251e] underline underline-offset-2">
                          {dProgNivel}
                        </span>
                      </div>
                      <p className="text-xs text-[#5a5852] leading-relaxed">
                        {dProgJust}
                      </p>
                    </div>

                    <div className="pt-3 space-y-1">
                      <div className="flex justify-between items-baseline">
                        <span className="font-bold text-xs text-[#26251e]">Produtividade de Repertório:</span>
                        <span className="font-bold text-xs text-[#26251e] underline underline-offset-2">
                          {dRepNivel}
                        </span>
                      </div>
                      <p className="text-xs text-[#5a5852] leading-relaxed">
                        {dRepJust}
                      </p>
                    </div>
                  </div>
                </div>

                {/* CARD 2: DIMENSÃO ÉTICO-CRÍTICA (IDÊNTICO À IMAGEM DE REFERÊNCIA) */}
                <div className="bg-[#ffffff] border border-[#26251e] rounded-xl p-5 shadow-xs space-y-3.5">
                  <h4 className="text-xs font-bold text-[#26251e] uppercase tracking-wider font-mono border-b border-[#e6e5e0] pb-2">
                    DIMENSÃO ÉTICO-CRÍTICA
                  </h4>

                  <div className="space-y-3 divide-y divide-[#e6e5e0]/70">
                    <div className="pt-2 first:pt-0 space-y-1">
                      <div className="flex justify-between items-baseline">
                        <span className="font-bold text-xs text-[#26251e]">Empatia e Alteridade:</span>
                        <span className="font-bold text-xs text-[#26251e] underline underline-offset-2">
                          {eEmpatiaNivel}
                        </span>
                      </div>
                      <p className="text-xs text-[#5a5852] leading-relaxed">
                        {eEmpatiaJust}
                      </p>
                    </div>

                    <div className="pt-3 space-y-1">
                      <div className="flex justify-between items-baseline">
                        <span className="font-bold text-xs text-[#26251e]">Justificação Moral:</span>
                        <span className="font-bold text-xs text-[#26251e] underline underline-offset-2">
                          {eMoralNivel}
                        </span>
                      </div>
                      <p className="text-xs text-[#5a5852] leading-relaxed">
                        {eMoralJust}
                      </p>
                    </div>

                    <div className="pt-3 space-y-1">
                      <div className="flex justify-between items-baseline">
                        <span className="font-bold text-xs text-[#26251e]">Conclusão Crítica / Propostas:</span>
                        <span className="font-bold text-xs text-[#26251e] underline underline-offset-2">
                          {eConclusaoNivel}
                        </span>
                      </div>
                      <p className="text-xs text-[#5a5852] leading-relaxed">
                        {eConclusaoJust}
                      </p>
                    </div>
                  </div>
                </div>

              </div>
            );
          })()}

          {/* Pontos Fortes e Pontos a Evoluir */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[#ffffff] border border-[#e6e5e0] rounded-xl p-5 space-y-2 shadow-xs">
              <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-[#1f8a65] flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>Pontos Fortes da Redação</span>
              </h4>
              <p className="text-xs text-[#5a5852] leading-relaxed">
                {sisedu.pontos_fortes || enem.pontos_fortes || (
                  notaEnemCalculada >= 800 
                    ? 'Excelente repertório sociocultural produtivo e articulação lógica entre as partes do texto. Domínio consistente da norma culta e proposta de intervenção detalhada com todos os elementos obrigatórios.'
                    : 'Boa estruturação dissertativa-argumentativa, compreensão do tema proposto e uso adequado de recursos coesivos interparágrafos.'
                )}
              </p>
            </div>

            <div className="bg-[#ffffff] border border-[#e6e5e0] rounded-xl p-5 space-y-2 shadow-xs">
              <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-[#f54e00] flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                <span>Recomendações de Melhoria</span>
              </h4>
              <p className="text-xs text-[#5a5852] leading-relaxed">
                {sisedu.pontos_fracos || sisedu.recomendacoes || enem.recomendacoes || (
                  c1Val < 160 
                    ? 'Atenção aos desvios gramaticais, concordância verbal e pontuação sintática. Revisar os períodos longos para garantir maior fluidez e precisão vocabular.'
                    : c5Val < 160
                    ? 'Aprofundar a proposta de intervenção social, certificando-se de apresentar detalhadamente o Agente, a Ação, o Meio/Modo, o Efeito e o Detalhamento expressivo.'
                    : 'Aprofundar a fundamentação dos argumentos com repertórios socioculturais legitimados e fortalecer a contraposição crítica nos parágrafos de desenvolvimento.'
                )}
              </p>
            </div>
          </div>

        </div>
      )}

      {/* ======================================================== */}
      {/* ABA 4: DOCUMENTO OFICIAL / PRÉVIA DO PDF                 */}
      {/* ======================================================== */}
      {activeTab === 'pdf_preview' && (
        <div className="space-y-4 animate-fadeIn">
          
          {/* Painel de Customização da Escola */}
          <div className="bg-[#ffffff] border border-[#e6e5e0] rounded-xl p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-[#26251e] flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#f54e00]" />
                <span>Personalização do Boletim Oficial A4</span>
              </h3>
              <p className="text-xs text-[#807d72]">
                Ajuste os dados da instituição, assinatura do professor e formato de exportação.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Seletor 1 Página vs 2 Páginas */}
              <div className="flex items-center bg-[#fafaf7] p-1 rounded-lg border border-[#e6e5e0]">
                <button
                  type="button"
                  onClick={() => setPdfPageMode('single')}
                  className={`px-3 py-1 text-xs font-mono font-medium rounded-md transition-all cursor-pointer ${
                    pdfPageMode === 'single'
                      ? 'bg-[#26251e] text-white shadow-xs'
                      : 'text-[#807d72] hover:text-[#26251e]'
                  }`}
                >
                  📄 1 Página
                </button>
                <button
                  type="button"
                  onClick={() => setPdfPageMode('both')}
                  className={`px-3 py-1 text-xs font-mono font-medium rounded-md transition-all cursor-pointer ${
                    pdfPageMode === 'both'
                      ? 'bg-[#26251e] text-white shadow-xs'
                      : 'text-[#807d72] hover:text-[#26251e]'
                  }`}
                >
                  📑 2 Páginas
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsCustomizingPdf(!isCustomizingPdf)}
                className="px-3 py-1.5 bg-[#fafaf7] hover:bg-[#e6e5e0] border border-[#e6e5e0] text-[#26251e] text-xs font-mono rounded-lg transition-colors cursor-pointer"
              >
                {isCustomizingPdf ? 'Ocultar Opções' : 'Editar Cabeçalho'}
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="px-3 py-1.5 bg-[#fafaf7] hover:bg-[#e6e5e0] border border-[#e6e5e0] text-[#26251e] text-xs font-mono rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                title="Imprimir direto ou salvar como PDF nativo do navegador"
              >
                <Printer className="w-3.5 h-3.5 text-[#807d72]" />
                <span>Imprimir</span>
              </button>

              <button
                type="button"
                disabled={isGeneratingPDF}
                onClick={handleDownloadPDF}
                className="px-4 py-1.5 bg-[#1f8a65] hover:bg-[#187052] text-white text-xs font-mono font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5"
              >
                {isGeneratingPDF ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                <span>{pdfPageMode === 'both' ? 'Exportar PDF (2 Págs)' : 'Exportar PDF (1 Pág)'}</span>
              </button>
            </div>
          </div>

          {/* Form de Customização Aberto */}
          {isCustomizingPdf && (
            <div className="bg-[#fafaf7] border border-[#e6e5e0] rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs animate-fadeIn font-mono">
              <div>
                <label className="block text-[11px] text-[#807d72] mb-1">Nome da Escola / Instituição:</label>
                <input
                  type="text"
                  value={customEscola}
                  onChange={(e) => setCustomEscola(e.target.value)}
                  className="w-full bg-[#ffffff] border border-[#e6e5e0] rounded p-2 text-xs text-[#26251e]"
                />
              </div>
              <div>
                <label className="block text-[11px] text-[#807d72] mb-1">Nome do Professor Avaliador:</label>
                <input
                  type="text"
                  value={customProfessor}
                  onChange={(e) => setCustomProfessor(e.target.value)}
                  className="w-full bg-[#ffffff] border border-[#e6e5e0] rounded p-2 text-xs text-[#26251e]"
                />
              </div>
            </div>
          )}

          {/* Renderizador do Documento Oficial A4 (FolhaOficialRedacao) */}
          <div className="bg-slate-800 rounded-xl p-4 sm:p-6 overflow-x-auto flex justify-center shadow-inner">
            <div className="scale-90 sm:scale-100 origin-top">
              <FolhaOficialRedacao
                redacao={redacao}
                manualName={manualName}
                manualTurma={manualTurma}
                notaEnemCalculada={notaEnemCalculada}
                enem={enem}
                siseduDescritores={siseduDescritores}
                sisedu={sisedu}
                fullTextContent={fullTextContent}
                customEscola={customEscola}
                customProfessor={customProfessor}
                customRecado={customRecado}
                showSisedu={showSisedu}
                showWatermark={showWatermark}
                showSignature={showSignature}
                pdfPageMode={pdfPageMode}
                showPage2={pdfPageMode === 'both'}
                idPrefix="pdf-live-preview"
              />
            </div>
          </div>

        </div>
      )}

      {/* Off-screen export container for instant 2-page PDF export and print */}
      <div style={{ position: 'fixed', left: '-9999px', top: 0, opacity: 0, pointerEvents: 'none', zIndex: -100 }}>
        <FolhaOficialRedacao
          redacao={redacao}
          manualName={manualName}
          manualTurma={manualTurma}
          notaEnemCalculada={notaEnemCalculada}
          enem={enem}
          siseduDescritores={siseduDescritores}
          sisedu={sisedu}
          fullTextContent={fullTextContent}
          customEscola={customEscola}
          customProfessor={customProfessor}
          customRecado={customRecado}
          showSisedu={showSisedu}
          showWatermark={showWatermark}
          showSignature={showSignature}
          pdfPageMode="both"
          showPage2={true}
          idPrefix="pdf-export"
        />
      </div>

    </div>
  );
}
