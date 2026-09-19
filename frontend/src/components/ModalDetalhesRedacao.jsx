import React, { useState } from 'react';
import { 
  X, Award, UserCheck, UserX, Image as ImageIcon, Save, Sparkles, 
  BookOpen, Quote, ShieldCheck, Compass, Copy, Check, Printer, 
  FileText, Download, Loader2, Edit3, Search, GraduationCap, 
  Link, Unlink, AlertTriangle, Sliders, Eye, RefreshCw, CheckCircle2 
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { updateNomeAluno } from '../db/db';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/authService';
import FolhaOficialRedacao from './FolhaOficialRedacao';

export default function ModalDetalhesRedacao({ redacao, onClose, onUpdated }) {
  const { isAdmin } = useAuth();
  const [manualName, setManualName] = useState(redacao?.nome_aluno || '');
  const [manualTurma, setManualTurma] = useState(redacao?.turma_aluno || '');
  const [isSavingName, setIsSavingName] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [activeTab, setActiveTab] = useState('enem'); // 'enem' | 'sisedu' | 'texto' | 'pdf_preview'
  const [copiedText, setCopiedText] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [statusValidacao, setStatusValidacao] = useState(redacao?.status_validacao || 'VALIDADA');

  // Customization state for PDF layout & organization
  const [customEscola, setCustomEscola] = useState('Projeto Ágora Escolar • Ensino Médio');
  const [customProfessor, setCustomProfessor] = useState('Professor(a) Avaliador(a)');
  const [customRecado, setCustomRecado] = useState('');
  const [showSisedu, setShowSisedu] = useState(true);
  const [showWatermark, setShowWatermark] = useState(true);
  const [showSignature, setShowSignature] = useState(true);
  const [pdfPreviewPage, setPdfPreviewPage] = useState('both'); // 'page1' | 'page2' | 'both'
  const [isCustomizingPdf, setIsCustomizingPdf] = useState(false);

  const [estudantesList, setEstudantesList] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState(redacao?.user_id || '');
  const [isLinkingStudent, setIsLinkingStudent] = useState(false);
  const [isStudentPickerOpen, setIsStudentPickerOpen] = useState(false);
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [studentTurmaFilter, setStudentTurmaFilter] = useState('todas');
  const [pickerTab, setPickerTab] = useState('search'); // 'search' | 'create'
  const [novoNome, setNovoNome] = useState('');
  const [novoEmail, setNovoEmail] = useState('');
  const [novoTurma, setNovoTurma] = useState('3° G - TARDE');
  const [isCreatingStudent, setIsCreatingStudent] = useState(false);

  // Carregamento sob demanda da imagem original (economiza megabytes de tráfego inicial)
  const [imagemBase64, setImagemBase64] = useState(redacao?.imagem_base64 || null);
  const [isLoadingImage, setIsLoadingImage] = useState(false);

  React.useEffect(() => {
    if (!imagemBase64 && redacao?.id && (redacao?.tipo_input === 'imagem' || !redacao?.tipo_input)) {
      setIsLoadingImage(true);
      authService.fetchRedacaoById(redacao.id)
        .then(full => {
          if (full?.imagem_base64) {
            setImagemBase64(full.imagem_base64);
          }
        })
        .catch(err => console.warn('Erro ao carregar imagem sob demanda:', err))
        .finally(() => setIsLoadingImage(false));
    }
  }, [redacao?.id, redacao?.tipo_input]);

  React.useEffect(() => {
    if (isAdmin) {
      authService.getEstudantes().then(list => setEstudantesList(list)).catch(() => {});
    }
  }, [isAdmin]);

  const handleValidarRedacao = async () => {
    setIsValidating(true);
    try {
      await authService.validarRedacao(redacao.id);
      setStatusValidacao('VALIDADA');
      if (onUpdated) onUpdated();
    } catch (err) {
      alert(err.message || 'Erro ao validar redação.');
    } finally {
      setIsValidating(false);
    }
  };

  const handleVincularAluno = async (studentId) => {
    setIsLinkingStudent(true);
    try {
      const selectedEstudante = estudantesList.find(s => String(s.id) === String(studentId));
      await authService.vincularAluno(redacao.id, {
        user_id: studentId ? Number(studentId) : null,
        nome_aluno: selectedEstudante ? selectedEstudante.nome : manualName
      });
      setSelectedStudentId(studentId);
      if (selectedEstudante) {
        setManualName(selectedEstudante.nome);
        if (selectedEstudante.turma) setManualTurma(selectedEstudante.turma);
      }
      if (onUpdated) onUpdated();
    } catch (err) {
      alert(err.message || 'Erro ao vincular aluno.');
    } finally {
      setIsLinkingStudent(false);
    }
  };

  const handleCreateAndLinkStudent = async (e) => {
    e.preventDefault();
    if (!novoNome.trim() || !novoEmail.trim()) {
      alert('Por favor, preencha o nome e o e-mail do estudante.');
      return;
    }
    setIsCreatingStudent(true);
    try {
      const newStudent = await authService.createEstudante({
        nome: novoNome.trim(),
        email: novoEmail.trim().toLowerCase(),
        turma: novoTurma
      });
      
      // Atualiza a lista local
      setEstudantesList(prev => [...prev, newStudent]);
      
      // Vincula à redação atual
      await handleVincularAluno(newStudent.id);
      setIsStudentPickerOpen(false);
      setPickerTab('search');
      setNovoNome('');
      setNovoEmail('');
      alert(`Aluno ${newStudent.nome} cadastrado e vinculado com sucesso!`);
    } catch (err) {
      alert(err.message || 'Erro ao cadastrar novo estudante.');
    } finally {
      setIsCreatingStudent(false);
    }
  };

  if (!redacao) return null;

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
  const devolutivaInicial = data.devolutiva_nivel_inicial || avaliacoes.devolutiva_nivel_inicial || sisedu.devolutiva_nivel_inicial;
  const isIdentified = redacao.nome_detectado && redacao.nome_aluno;

  // Cálculo matemático consistente da soma das 5 competências do ENEM
  const c1Val = Number(enem.competencia_1?.nota ?? 0);
  const c2Val = Number(enem.competencia_2?.nota ?? 0);
  const c3Val = Number(enem.competencia_3?.nota ?? 0);
  const c4Val = Number(enem.competencia_4?.nota ?? 0);
  const c5Val = Number(enem.competencia_5?.nota ?? 0);
  const sumCompetencias = c1Val + c2Val + c3Val + c4Val + c5Val;
  const notaEnemCalculada = (enem.competencia_1 || enem.competencia_2) ? sumCompetencias : (enem.nota_total_enem ?? redacao.nota_final ?? 0);

  const fullTextContent = redacao.texto_digitado || data.texto_transcrito || 'Transcrição indisponível.';

  const handleCopyText = () => {
    navigator.clipboard.writeText(fullTextContent);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  const handleSaveName = async (e) => {
    e.preventDefault();
    if (!manualName.trim()) return;
    setIsSavingName(true);
    try {
      // 1. Atualiza no servidor (Supabase Cloud)
      if (authService.getToken()) {
        await authService.vincularAluno(redacao.id, {
          nome_aluno: manualName.trim(),
          turma_aluno: manualTurma.trim() || null
        }).catch(err => console.warn('Aviso ao sincronizar na nuvem:', err));
      }
      // 2. Atualiza no IndexedDB local se existir
      await updateNomeAluno(redacao.id, manualName.trim(), manualTurma.trim() || null);
      if (onUpdated) onUpdated();
      setIsEditingName(false);
    } catch (err) {
      console.error('Erro ao salvar nome:', err);
    } finally {
      setIsSavingName(false);
    }
  };

  const sanitizeFilename = (str) => {
    if (!str) return 'Estudante';
    return String(str).replace(/[^a-zA-Z0-9_]/g, '_');
  };

  // ROBUST 2-PAGE STRICT PDF GENERATION VIA JSPDF + HTML2CANVAS (100% fiel ao HTML)
  const handleDownloadPDF = async () => {
    const page1El = document.getElementById('pdf-export-page-1');
    const page2El = document.getElementById('pdf-export-page-2');
    if (!page1El || !page2El) {
      alert('Aguarde o carregamento do documento para exportar.');
      return;
    }

    setIsGeneratingPDF(true);
    try {
      const studentNameClean = sanitizeFilename(manualName || redacao.nome_aluno || data.aluno || 'Estudante');
      const filename = `Boletim_Redacao_${studentNameClean}_ID${redacao.id}.pdf`;

      const canvasOptions = {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        scrollX: 0,
        scrollY: 0
      };

      // 1. Capture Page 1
      const canvas1 = await html2canvas(page1El, canvasOptions);
      const imgData1 = canvas1.toDataURL('image/jpeg', 0.98);

      // 2. Initialize jsPDF in A4 portrait (210mm x 297mm)
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      // Add Page 1 (Frente)
      pdf.addImage(imgData1, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');

      // 3. Capture Page 2 (Verso)
      const canvas2 = await html2canvas(page2El, canvasOptions);
      const imgData2 = canvas2.toDataURL('image/jpeg', 0.98);

      // Add Page 2
      pdf.addPage('a4', 'portrait');
      pdf.addImage(imgData2, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');

      // Save exact 2-page PDF
      pdf.save(filename);
    } catch (err) {
      console.error('Erro ao gerar PDF com jsPDF:', err);
      alert('Não foi possível gerar o arquivo PDF automaticamente. Por favor, tente novamente.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const getNivelBadgeClass = (nivel) => {
    if (nivel === 'Adequado' || nivel === 'Avançado') return 'bg-emerald-500/15 text-emerald-700 border-emerald-400';
    if (nivel === 'Intermediário' || nivel === 'Em Desenvolvimento') return 'bg-amber-500/15 text-amber-700 border-amber-400';
    return 'bg-rose-500/20 text-rose-700 border-rose-400 font-bold';
  };

  const enemCompetenciasMap = [
    { key: 'competencia_1', title: 'Competência 1 - Norma Culta', desc: 'Domínio da modalidade escrita formal da língua portuguesa' },
    { key: 'competencia_2', title: 'Competência 2 - Tema e Repertório', desc: 'Compreensão do tema e aplicação das áreas do conhecimento' },
    { key: 'competencia_3', title: 'Competência 3 - Argumentação', desc: 'Projeto de texto, organização e interpretação de fatos e opiniões' },
    { key: 'competencia_4', title: 'Competência 4 - Coesão e Coerência', desc: 'Conhecimento dos mecanismos linguísticos para a argumentação' },
    { key: 'competencia_5', title: 'Competência 5 - Proposta de Intervenção', desc: 'Elaboração de proposta respeitando os Direitos Humanos' }
  ];

  const siseduDescritoresMap = [
    { code: 'D05', title: 'D05 — Interpretação Gráfica/Textual', desc: 'Interpretar texto com auxílio de material gráfico diverso' },
    { code: 'D06', title: 'D06 — Identificação do Tema/Tese', desc: 'Identificar o tema ou a tese de um texto dissertativo' },
    { code: 'D12', title: 'D12 — Coesão e Substituição Lexical', desc: 'Relações de coesão, repetições e substituições textuais' },
    { code: 'D13', title: 'D13 — Tese Principal e Central', desc: 'Localizar a tese principal ou argumento central' },
    { code: 'D14', title: 'D14 — Distinção de Partes do Texto', desc: 'Distinguir as partes principais das secundárias' },
    { code: 'D15', title: 'D15 — Reconhecimento de Posições Distintas', desc: 'Reconhecer posições distintas entre duas ou mais opiniões' },
    { code: 'D16', title: 'D16 — Articulação Tese e Argumentos', desc: 'Identificar a tese e os argumentos que a sustentam' },
    { code: 'D17', title: 'D17 — Escolha Vocabular e Sentido', desc: 'Efeito de sentido decorrente da escolha vocabular' },
    { code: 'D18', title: 'D18 — Pontuação e Recursos Expressivos', desc: 'Efeito de sentido decorrente do uso da pontuação' }
  ];

  const siseduDiscursivaMap = [
    { key: 'clareza_tese', title: 'Clareza da Tese' },
    { key: 'argumentacao', title: 'Argumentação' },
    { key: 'repertorio', title: 'Repertório' }
  ];

  // Props compartilhadas para a Folha Oficial
  const folhaProps = {
    redacao,
    manualName,
    manualTurma,
    notaEnemCalculada,
    enem,
    siseduDescritores,
    sisedu,
    fullTextContent,
    customEscola,
    customProfessor,
    customRecado,
    showSisedu,
    showWatermark,
    showSignature
  };

  return (
    <>
      {/* FIXED-SIZE CLEAN MODAL VIEW */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs animate-fadeIn no-print">
        <div className="bg-[#ffffff] border border-[#e6e5e0] rounded-xl w-full max-w-4xl h-[660px] max-h-[94vh] flex flex-col shadow-2xl overflow-hidden text-[#26251e]">

          {/* Header Bar */}
          <div className="bg-[#fafaf7] border-b border-[#e6e5e0] px-4 sm:px-5 py-3 space-y-2 shrink-0">
            {/* Top Row: Name, Status & Close Button */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-wrap">
                <div className="w-7 h-7 rounded-full bg-[#ffffff] border border-[#e6e5e0] flex items-center justify-center shrink-0 text-[#f54e00]">
                  <GraduationCap className="w-3.5 h-3.5" />
                </div>
                <h3 className="text-sm sm:text-base font-semibold text-[#26251e] tracking-tight truncate max-w-[200px] xs:max-w-[300px] sm:max-w-none">
                  {manualName || data.aluno || redacao.nome_aluno || 'Estudante Não Identificado'}
                </h3>
                {isIdentified ? (
                  <div className="flex items-center gap-1">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#e6e5e0] text-[#26251e]">
                      <UserCheck className="w-3.5 h-3.5 text-[#1f8a65]" />
                      {redacao.nome_aluno || data.aluno}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsEditingName(true)}
                      className="p-1 hover:bg-[#e6e5e0] rounded text-[#807d72] hover:text-[#26251e] transition-colors cursor-pointer"
                      title="Editar nome do aluno"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#e6e5e0] text-[#26251e]">
                    <UserX className="w-3.5 h-3.5 text-[#c08532]" />
                    Pendente
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-1 rounded-full text-[11px] font-mono font-medium border ${
                  statusValidacao === 'VALIDADA'
                    ? 'bg-[#1f8a65]/10 text-[#1f8a65] border-[#1f8a65]/30'
                    : 'bg-[#c08532]/10 text-[#c08532] border-[#c08532]/30'
                }`}>
                  {statusValidacao === 'VALIDADA' ? 'Validada' : 'Em Revisão'}
                </span>
                
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-[#807d72] hover:text-[#26251e] hover:bg-[#e6e5e0] transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Edit Name Banner */}
            {(!isIdentified || isEditingName) && (
              <div className="bg-[#ffffff] border border-[#e6e5e0] p-3 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-2 text-[#26251e] text-xs">
                  {!isIdentified ? (
                    <UserX className="w-4 h-4 text-[#c08532] shrink-0" />
                  ) : (
                    <Edit3 className="w-4 h-4 text-[#f54e00] shrink-0" />
                  )}
                  <span>
                    {!isIdentified 
                      ? <strong>Aluno/Turma não identificados automaticamente:</strong> 
                      : <strong>Editando dados do Aluno:</strong>} Atribua os dados para vincular ao repositório:
                  </span>
                </div>
                <form onSubmit={handleSaveName} className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto">
                  <input
                    type="text"
                    placeholder="Nome do aluno..."
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    className="bg-[#ffffff] border border-[#e6e5e0] rounded-md px-3 py-1.5 text-xs text-[#26251e] placeholder-[#a09c92] focus:outline-none focus:border-[#26251e] w-full sm:w-48"
                  />
                  <input
                    type="text"
                    placeholder="Turma (ex: 3º Ano A)..."
                    value={manualTurma}
                    onChange={(e) => setManualTurma(e.target.value)}
                    className="bg-[#ffffff] border border-[#e6e5e0] rounded-md px-3 py-1.5 text-xs text-[#26251e] placeholder-[#a09c92] focus:outline-none focus:border-[#26251e] w-full sm:w-36"
                  />
                  <button
                    type="submit"
                    disabled={isSavingName || !manualName.trim()}
                    className="px-3 py-1.5 bg-[#f54e00] hover:bg-[#d04200] text-white font-medium text-xs rounded-md transition-colors flex items-center gap-1 shrink-0 disabled:opacity-50 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Salvar
                  </button>
                  {isIdentified && isEditingName && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingName(false);
                        setManualName(redacao.nome_aluno || '');
                        setManualTurma(redacao.turma_aluno || '');
                      }}
                      className="px-3 py-1.5 bg-[#ffffff] border border-[#e6e5e0] hover:bg-[#e6e5e0] text-[#26251e] font-medium text-xs rounded-md transition-colors flex items-center shrink-0 cursor-pointer"
                    >
                      Cancelar
                    </button>
                  )}
                </form>
              </div>
            )}

            <div className="flex items-center justify-between gap-2 flex-wrap text-xs font-mono text-[#807d72]">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="bg-[#ffffff] px-2 py-0.5 rounded border border-[#e6e5e0]">ID #{String(redacao.id).padStart(4, '0')}</span>
                <span>•</span>
                <span className="bg-[#ffffff] px-2 py-0.5 rounded border border-[#e6e5e0]">{manualTurma || data.turma || redacao.turma_aluno || 'Geral'}</span>
                <span>•</span>
                <span>{new Date(redacao.data_captura).toLocaleDateString('pt-BR')}</span>
              </div>

              {notaEnemCalculada !== undefined && (
                <div className="px-2.5 py-0.5 rounded border border-[#dfa88f] bg-[#dfa88f]/20 font-mono text-xs flex items-baseline gap-1 shrink-0">
                  <span className="text-[10px] font-bold text-[#807d72]">NOTA ENEM:</span>
                  <span className="text-sm font-bold text-[#f54e00]">{notaEnemCalculada}</span>
                  <span className="text-[10px] text-[#807d72]">/1000</span>
                </div>
              )}
            </div>
          </div>

          {/* Navigation Tabs (4 Tabs) */}
          <div className="px-5 bg-[#fafaf7] border-b border-[#e6e5e0] flex items-center gap-2 shrink-0 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('enem')}
              className={`px-3.5 py-2.5 text-xs font-medium border-b-2 flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                activeTab === 'enem'
                  ? 'border-[#f54e00] text-[#f54e00] font-semibold bg-[#ffffff] rounded-t-md'
                  : 'border-transparent text-[#807d72] hover:text-[#26251e]'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>Matriz ENEM</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('sisedu')}
              className={`px-3.5 py-2.5 text-xs font-medium border-b-2 flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                activeTab === 'sisedu'
                  ? 'border-[#f54e00] text-[#f54e00] font-semibold bg-[#ffffff] rounded-t-md'
                  : 'border-transparent text-[#807d72] hover:text-[#26251e]'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Rubricas Sisedu</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('texto')}
              className={`px-3.5 py-2.5 text-xs font-medium border-b-2 flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                activeTab === 'texto'
                  ? 'border-[#f54e00] text-[#f54e00] font-semibold bg-[#ffffff] rounded-t-md'
                  : 'border-transparent text-[#807d72] hover:text-[#26251e]'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Texto & Imagem</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('pdf_preview')}
              className={`px-3.5 py-2.5 text-xs font-medium border-b-2 flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                activeTab === 'pdf_preview'
                  ? 'border-[#f54e00] text-[#f54e00] font-semibold bg-[#ffffff] rounded-t-md'
                  : 'border-transparent text-[#807d72] hover:text-[#26251e]'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-[#f54e00]" />
              <span>Folha Oficial (PDF 2 Págs)</span>
            </button>
          </div>

          {/* Scrollable Modal Content */}
          <div className="flex-1 p-5 overflow-y-auto custom-scrollbar bg-[#ffffff] space-y-4">

            {/* TAB 1: ENEM MATRIX */}
            {activeTab === 'enem' && (
              <div className="space-y-3.5">
                <div className="flex items-center justify-between pb-2 border-b border-[#e6e5e0]">
                  <h4 className="text-xs font-semibold text-[#807d72] uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#f54e00]" />
                    Avaliação Oficial ENEM (0 a 200 pontos por Competência)
                  </h4>
                  <span className="text-[11px] font-mono text-[#807d72]">5 Competências</span>
                </div>

                <div className="space-y-3">
                  {enemCompetenciasMap.map(({ key, title, desc }) => {
                    const comp = enem[key] || { nota: 0, citacao_texto: 'Elemento ausente no texto', justificativa: 'Não avaliado' };
                    const percent = Math.min(100, Math.max(0, (comp.nota / 200) * 100));

                    return (
                      <div key={key} className="bg-[#fafaf7] border border-[#e6e5e0] rounded-lg p-4 space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-semibold text-xs sm:text-sm text-[#26251e]">{title}</div>
                            <div className="text-[11px] text-[#807d72]">{desc}</div>
                          </div>
                          <div className="text-right shrink-0 bg-[#ffffff] px-2.5 py-1 rounded-md border border-[#e6e5e0] font-mono">
                            <span className="font-bold text-sm text-[#26251e]">{comp.nota}</span>
                            <span className="text-[10px] text-[#807d72]"> / 200</span>
                          </div>
                        </div>

                        <div className="w-full bg-[#e6e5e0] h-1.5 rounded-full overflow-hidden">
                          <div
                            className="h-full transition-all duration-500 rounded-full bg-[#f54e00]"
                            style={{ width: `${percent}%` }}
                          />
                        </div>

                        <p className="text-xs text-[#5a5852] leading-relaxed">
                          <strong className="text-[#26251e]">Parecer:</strong> {comp.justificativa}
                        </p>

                        {comp.citacao_texto && (
                          <div className="bg-[#ffffff] border-l-2 border-[#f54e00] p-2.5 rounded-r-md text-xs text-[#26251e] flex items-start gap-2 font-mono">
                            <Quote className="w-3.5 h-3.5 text-[#f54e00] shrink-0 mt-0.5" />
                            <div className="text-[11px]">
                              <span className="text-[9px] uppercase font-bold text-[#807d72] block font-sans">Trecho Citado:</span>
                              <span className="italic">"{comp.citacao_texto}"</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 2: SISEDU MATRIX */}
            {activeTab === 'sisedu' && (
              <div className="space-y-4">
                {(devolutivaInicial || Object.values(siseduDescritores).some(d => d?.nivel === 'Inicial')) && (
                  <div className="bg-rose-500/10 border-2 border-rose-500/40 rounded-xl p-4 space-y-2 shadow-sm animate-fadeIn">
                    <div className="flex items-center gap-2 text-rose-700 font-bold text-xs uppercase tracking-wider">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>Devolutiva de Intervenção Pedagógica — Nível Inicial (SISEDU)</span>
                    </div>
                    <p className="text-xs text-rose-900 leading-relaxed whitespace-pre-wrap font-sans">
                      {devolutivaInicial || "Atenção: O estudante apresentou descritores em Nível Inicial. Recomenda-se aplicar atividade direcionada de reescrita com suporte em conectores argumentativos e substituição lexical antes do próximo ciclo de avaliação."}
                    </p>
                  </div>
                )}

                <div className="space-y-2.5">
                  <div className="flex items-center justify-between pb-1.5 border-b border-[#e6e5e0]">
                    <h4 className="text-xs font-semibold text-[#807d72] uppercase tracking-wider flex items-center gap-1.5">
                      <Compass className="w-3.5 h-3.5 text-[#f54e00]" />
                      Matriz de Descritores SISEDU / SPAECE (CE)
                    </h4>
                    <span className="text-[11px] font-mono text-[#807d72]">9 Descritores Chave</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {siseduDescritoresMap.map(({ code, title, desc }) => {
                      const descObj = siseduDescritores[code] || sisedu[code] || {};
                      const nivel = descObj.nivel || (code === 'D15' ? 'Inicial' : 'Intermediário');
                      const justificativa = descObj.justificativa || descObj.parecer || 'Avaliação pedagógica em conformidade com a rubrica regional.';
                      const citacao = descObj.citacao_texto;

                      return (
                        <div key={code} className="bg-[#fafaf7] border border-[#e6e5e0] rounded-lg p-3.5 space-y-2 flex flex-col justify-between">
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <h5 className="font-semibold text-xs text-[#26251e]">{title}</h5>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${getNivelBadgeClass(nivel)}`}>
                                {nivel}
                              </span>
                            </div>

                            <div className="text-[10.5px] text-[#807d72] mb-1 italic">{desc}</div>

                            <p className="text-xs text-[#5a5852] leading-relaxed my-1.5">
                              {justificativa}
                            </p>

                            {citacao && (
                              <div className="bg-[#ffffff] border-l-2 border-[#f54e00] p-2 text-[10px] text-[#26251e] rounded-r-md font-mono mt-2">
                                <span className="italic">"{citacao}"</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {sisedu.dimensao_discursiva && (
                  <div className="space-y-2.5 pt-3 border-t border-[#e6e5e0]">
                    <div className="flex items-center justify-between pb-1.5 border-b border-[#e6e5e0]">
                      <h4 className="text-xs font-semibold text-[#807d72] uppercase tracking-wider flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-[#807d72]" />
                        Dimensões Discursiva e Ético-Moral (Projeto Ágora)
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {siseduDiscursivaMap.map(({ key, title }) => {
                        const item = sisedu.dimensao_discursiva?.[key] || { nivel: 'Intermediário', justificativa: '—' };
                        return (
                          <div key={key} className="bg-[#fafaf7] border border-[#e6e5e0] rounded-lg p-3 space-y-1">
                            <div className="flex justify-between items-center">
                              <span className="font-semibold text-xs text-[#26251e]">{title}:</span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${getNivelBadgeClass(item.nivel)}`}>{item.nivel}</span>
                            </div>
                            <p className="text-[11px] text-[#5a5852]">{item.justificativa}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: TRANSCRIPTION & IMAGE */}
            {activeTab === 'texto' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#fafaf7] border border-[#e6e5e0] rounded-lg p-3.5 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#807d72] uppercase tracking-wider">
                    <ImageIcon className="w-4 h-4 text-[#26251e]" />
                    Imagem Original Enviada
                  </div>
                  {isLoadingImage ? (
                    <div className="p-8 text-center text-[#807d72] text-xs flex flex-col items-center justify-center gap-2 bg-[#ffffff] rounded-md border border-[#e6e5e0] min-h-[160px]">
                      <Loader2 className="w-5 h-5 animate-spin text-[#26251e]" />
                      <span>Carregando imagem original em alta definição...</span>
                    </div>
                  ) : imagemBase64 ? (
                    <div className="rounded-md overflow-hidden border border-[#e6e5e0] bg-[#ffffff] flex items-center justify-center max-h-[380px]">
                      <img
                        src={imagemBase64}
                        alt="Folha da Redação"
                        className="w-full h-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="p-8 text-center text-[#807d72] text-xs italic bg-[#ffffff] rounded-md border border-[#e6e5e0]">
                      Redação enviada em texto digitado (sem imagem binária).
                    </div>
                  )}
                </div>

                <div className="bg-[#fafaf7] border border-[#e6e5e0] rounded-lg p-3.5 space-y-2 flex flex-col">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#807d72] uppercase tracking-wider">
                      <BookOpen className="w-4 h-4 text-[#26251e]" />
                      Texto Integral Transcrito
                    </div>

                    <button
                      type="button"
                      onClick={handleCopyText}
                      className="px-2.5 py-1 rounded bg-[#ffffff] border border-[#e6e5e0] hover:bg-[#e6e5e0] text-[11px] text-[#26251e] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      {copiedText ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-[#1f8a65]" />
                          <span>Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-[#807d72]" />
                          <span>Copiar</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="p-3.5 rounded-md bg-[#ffffff] border border-[#e6e5e0] text-[#26251e] text-xs font-mono leading-relaxed whitespace-pre-wrap flex-1 max-h-[380px] overflow-y-auto custom-scrollbar select-text">
                    {fullTextContent}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: PDF PREVIEW & MANUAL ORGANIZATION */}
            {activeTab === 'pdf_preview' && (
              <div className="space-y-4">
                
                {/* PDF CONTROL & CUSTOMIZATION TOP BAR */}
                <div className="bg-[#fafaf7] border border-[#e6e5e0] p-3 rounded-lg flex flex-wrap items-center justify-between gap-3 shadow-xs">
                  {/* Page View Selector */}
                  <div className="flex items-center gap-1 bg-[#ffffff] border border-[#e6e5e0] p-0.5 rounded-md text-xs">
                    <button
                      type="button"
                      onClick={() => setPdfPreviewPage('page1')}
                      className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                        pdfPreviewPage === 'page1' ? 'bg-[#26251e] text-white font-medium' : 'text-[#807d72] hover:text-[#26251e]'
                      }`}
                    >
                      Frente (Pág 1)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPdfPreviewPage('page2')}
                      className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                        pdfPreviewPage === 'page2' ? 'bg-[#26251e] text-white font-medium' : 'text-[#807d72] hover:text-[#26251e]'
                      }`}
                    >
                      Verso (Pág 2)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPdfPreviewPage('both')}
                      className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                        pdfPreviewPage === 'both' ? 'bg-[#26251e] text-white font-medium' : 'text-[#807d72] hover:text-[#26251e]'
                      }`}
                    >
                      Ambas (Lado a Lado)
                    </button>
                  </div>

                  {/* Actions & Settings Toggle */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsCustomizingPdf(!isCustomizingPdf)}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium border flex items-center gap-1.5 transition-colors cursor-pointer ${
                        isCustomizingPdf 
                          ? 'bg-[#f54e00] text-white border-[#f54e00]' 
                          : 'bg-[#ffffff] text-[#26251e] border-[#e6e5e0] hover:bg-[#e6e5e0]'
                      }`}
                    >
                      <Sliders className="w-3.5 h-3.5" />
                      <span>{isCustomizingPdf ? 'Ocultar Ajustes' : 'Personalizar Layout & Dados'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handlePrint}
                      className="px-3 py-1.5 bg-[#ffffff] border border-[#e6e5e0] hover:bg-[#e6e5e0] text-[#26251e] font-medium text-xs rounded-md transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                      title="Imprimir ou Salvar como PDF nativo do navegador com máxima fidelidade vetorial"
                    >
                      <Printer className="w-3.5 h-3.5 text-[#807d72]" />
                      <span>Imprimir / PDF Nativo</span>
                    </button>

                    <button
                      type="button"
                      disabled={isGeneratingPDF}
                      onClick={handleDownloadPDF}
                      className="px-3.5 py-1.5 bg-[#f54e00] hover:bg-[#d04200] text-white font-medium text-xs rounded-md transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
                    >
                      {isGeneratingPDF ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <>
                          <Download className="w-3.5 h-3.5" />
                          <span>Baixar PDF (2 Págs Exatas)</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* EXPANDABLE MANUAL CUSTOMIZATION & ORGANIZATION PANEL */}
                {isCustomizingPdf && (
                  <div className="bg-[#fafaf7] border border-[#f54e00]/30 rounded-xl p-4 space-y-3 animate-fadeIn">
                    <div className="flex items-center justify-between pb-2 border-b border-[#e6e5e0]">
                      <h5 className="text-xs font-semibold text-[#26251e] flex items-center gap-2 uppercase tracking-wide">
                        <Sliders className="w-4 h-4 text-[#f54e00]" />
                        Organização & Ajustes Manuais da Folha
                      </h5>
                      <span className="text-[11px] text-[#807d72] font-mono">Prévia em tempo real</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                      {/* Escola / Instituição */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-[#807d72] block">Nome da Instituição / Escola:</label>
                        <input
                          type="text"
                          value={customEscola}
                          onChange={(e) => setCustomEscola(e.target.value)}
                          placeholder="Ex: Projeto Ágora Escolar • EEMTI"
                          className="w-full bg-[#ffffff] border border-[#e6e5e0] rounded px-2.5 py-1.5 text-xs text-[#26251e] focus:outline-none focus:border-[#26251e]"
                        />
                      </div>

                      {/* Professor / Avaliador */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-[#807d72] block">Professor(a) / Avaliador(a):</label>
                        <input
                          type="text"
                          value={customProfessor}
                          onChange={(e) => setCustomProfessor(e.target.value)}
                          placeholder="Ex: Prof. Francisco Silva"
                          className="w-full bg-[#ffffff] border border-[#e6e5e0] rounded px-2.5 py-1.5 text-xs text-[#26251e] focus:outline-none focus:border-[#26251e]"
                        />
                      </div>

                      {/* Toggles */}
                      <div className="space-y-2 flex flex-col justify-center">
                        <label className="text-[11px] font-medium text-[#807d72] block">Exibição de Elementos:</label>
                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                            <input
                              type="checkbox"
                              checked={showSisedu}
                              onChange={(e) => setShowSisedu(e.target.checked)}
                              className="rounded text-[#f54e00] focus:ring-0"
                            />
                            <span>Grade SISEDU</span>
                          </label>

                          <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                            <input
                              type="checkbox"
                              checked={showWatermark}
                              onChange={(e) => setShowWatermark(e.target.checked)}
                              className="rounded text-[#f54e00] focus:ring-0"
                            />
                            <span>Marca d'água</span>
                          </label>

                          <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                            <input
                              type="checkbox"
                              checked={showSignature}
                              onChange={(e) => setShowSignature(e.target.checked)}
                              className="rounded text-[#f54e00] focus:ring-0"
                            />
                            <span>Assinatura</span>
                          </label>
                        </div>
                      </div>

                      {/* Observação / Recado do Professor (Opcional) */}
                      <div className="sm:col-span-2 lg:col-span-3 space-y-1">
                        <label className="text-[11px] font-medium text-[#807d72] block">
                          Recado / Orientação Pedagógica Personalizada (Aparece na Pág 1 caso desmarque a grade SISEDU):
                        </label>
                        <textarea
                          rows={2}
                          value={customRecado}
                          onChange={(e) => setCustomRecado(e.target.value)}
                          placeholder="Escreva uma orientação direta para o estudante..."
                          className="w-full bg-[#ffffff] border border-[#e6e5e0] rounded px-2.5 py-1.5 text-xs text-[#26251e] focus:outline-none focus:border-[#26251e]"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* LIVE WYSIWYG PREVIEW CONTAINER */}
                <div className="bg-[#334155] p-4 sm:p-6 rounded-xl overflow-x-auto flex justify-center items-start min-h-[500px]">
                  <div className="flex flex-col lg:flex-row gap-6 items-center justify-center">
                    
                    {/* PAGE 1 PREVIEW */}
                    {(pdfPreviewPage === 'page1' || pdfPreviewPage === 'both') && (
                      <div className="flex flex-col items-center gap-2">
                        <span className="text-[11px] font-mono text-slate-300 font-bold uppercase tracking-wider">
                          Página 1 (Frente - Avaliação Pedagógica)
                        </span>
                        <div 
                          className="bg-white rounded shadow-2xl overflow-hidden border border-slate-700"
                          style={{
                            width: '794px',
                            height: '1123px',
                            transform: 'scale(0.62)',
                            transformOrigin: 'top center',
                            marginBottom: '-420px'
                          }}
                        >
                          <FolhaOficialRedacao {...folhaProps} idPrefix="pdf-live-preview" />
                        </div>
                      </div>
                    )}

                    {/* PAGE 2 PREVIEW */}
                    {(pdfPreviewPage === 'page2' || pdfPreviewPage === 'both') && (
                      <div className="flex flex-col items-center gap-2">
                        <span className="text-[11px] font-mono text-slate-300 font-bold uppercase tracking-wider">
                          Página 2 (Verso - Transcrição Verbatim)
                        </span>
                        <div 
                          className="bg-white rounded shadow-2xl overflow-hidden border border-slate-700"
                          style={{
                            width: '794px',
                            height: '1123px',
                            transform: 'scale(0.62)',
                            transformOrigin: 'top center',
                            marginBottom: '-420px'
                          }}
                        >
                          {/* Render Page 2 in preview */}
                          <div style={{ marginTop: '-1147px' }}>
                            <FolhaOficialRedacao {...folhaProps} idPrefix="pdf-live-preview-p2" />
                          </div>
                        </div>
                      </div>
                    )}

                  </div>
                </div>

              </div>
            )}

          </div>

          {/* Clean Footer Bar */}
          <div className="p-3.5 px-5 border-t border-[#e6e5e0] bg-[#fafaf7] flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
            {/* Quick Actions (Admin) */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {!isIdentified ? (
                <form onSubmit={handleSaveName} className="flex items-center gap-1.5 w-full sm:w-auto">
                  <input
                    type="text"
                    placeholder="Nome do Aluno..."
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    className="bg-[#ffffff] border border-[#e6e5e0] rounded px-2 py-1 text-xs text-[#26251e] w-36"
                  />
                  <input
                    type="text"
                    placeholder="Turma..."
                    value={manualTurma}
                    onChange={(e) => setManualTurma(e.target.value)}
                    className="bg-[#ffffff] border border-[#e6e5e0] rounded px-2 py-1 text-xs text-[#26251e] w-24"
                  />
                  <button
                    type="submit"
                    disabled={isSavingName || !manualName.trim()}
                    className="px-2.5 py-1 bg-[#f54e00] hover:bg-[#d04200] text-white font-medium text-xs rounded transition-colors cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    Salvar
                  </button>
                </form>
              ) : (
                isAdmin && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsStudentPickerOpen(true)}
                      className="text-xs font-mono text-[#f54e00] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <GraduationCap className="w-3.5 h-3.5" />
                      <span>{selectedStudentId ? 'Aluno Vinculado (Alterar)' : 'Vincular a Aluno'}</span>
                    </button>

                    {statusValidacao !== 'VALIDADA' && (
                      <button
                        type="button"
                        onClick={handleValidarRedacao}
                        disabled={isValidating}
                        className="px-3 py-1 bg-[#1f8a65] hover:bg-[#176d50] text-white font-medium text-xs rounded-md flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>{isValidating ? 'Validando...' : 'Validar & Liberar'}</span>
                      </button>
                    )}
                  </div>
                )
              )}
            </div>

            {/* Standard Footer Actions */}
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => setActiveTab('pdf_preview')}
                className={`px-3 py-1.5 border border-[#e6e5e0] font-medium text-xs rounded-md transition-colors flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'pdf_preview' ? 'bg-[#f54e00]/10 text-[#f54e00] border-[#f54e00]/40' : 'bg-[#ffffff] text-[#26251e] hover:bg-[#e6e5e0]'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Organizar & Visualizar</span>
              </button>

              <button
                type="button"
                disabled={isGeneratingPDF}
                onClick={handleDownloadPDF}
                className="px-3.5 py-1.5 bg-[#26251e] hover:bg-[#000000] text-white font-medium text-xs rounded-md transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isGeneratingPDF ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5 text-[#f54e00]" />
                    <span>Baixar PDF Oficial</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 bg-[#ffffff] border border-[#e6e5e0] hover:bg-[#e6e5e0] text-[#26251e] font-medium text-xs rounded-md transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* HIDDEN 2-PAGE EXPORT TEMPLATE & NATIVE PRINT CONTAINER */}
      <div id="pdf-print-container" style={{ position: 'fixed', top: 0, left: '-99999px', width: '794px', pointerEvents: 'none', zIndex: -9999 }}>
        <FolhaOficialRedacao {...folhaProps} idPrefix="pdf-export" />
      </div>

      {/* STUDENT PICKER MODAL FOR PROFESSORS */}
      {isStudentPickerOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[#26251e]/40 backdrop-blur-xs animate-fadeIn no-print">
          <div className="bg-[#ffffff] border border-[#e6e5e0] rounded-xl w-full max-w-lg p-5 shadow-2xl space-y-4 text-[#26251e]">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#e6e5e0] pb-3">
              <div>
                <h4 className="text-base font-semibold tracking-tight text-[#26251e] flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-[#f54e00]" />
                  Central de Vínculo de Alunos
                </h4>
                <p className="text-xs text-[#807d72] mt-0.5">
                  Atribua esta avaliação para o portal do aluno correspondente ou cadastre um novo.
                </p>
              </div>
              <button
                onClick={() => setIsStudentPickerOpen(false)}
                className="p-1 rounded-md text-[#807d72] hover:text-[#26251e] bg-[#fafaf7] border border-[#e6e5e0] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Sub-Tabs: Buscar vs Cadastrar Novo */}
            <div className="flex items-center gap-1 p-1 bg-[#fafaf7] border border-[#e6e5e0] rounded-lg text-xs font-medium">
              <button
                type="button"
                onClick={() => setPickerTab('search')}
                className={`flex-1 py-1.5 px-3 rounded-md transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  pickerTab === 'search'
                    ? 'bg-[#ffffff] text-[#26251e] shadow-xs font-semibold'
                    : 'text-[#807d72] hover:text-[#26251e]'
                }`}
              >
                <Search className="w-3.5 h-3.5" />
                <span>Buscar Aluno Cadastrado ({estudantesList.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setPickerTab('create')}
                className={`flex-1 py-1.5 px-3 rounded-md transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  pickerTab === 'create'
                    ? 'bg-[#ffffff] text-[#f54e00] shadow-xs font-semibold'
                    : 'text-[#807d72] hover:text-[#26251e]'
                }`}
              >
                <span className="text-base leading-none font-bold">+</span>
                <span>Cadastrar Novo Aluno</span>
              </button>
            </div>

            {pickerTab === 'create' ? (
              /* FORM: CADASTRAR NOVO ALUNO */
              <form onSubmit={handleCreateAndLinkStudent} className="space-y-3.5 bg-[#fafaf7] border border-[#e6e5e0] p-4 rounded-xl">
                <div className="text-xs font-semibold text-[#26251e] flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#f54e00]" />
                  <span>Cadastrar estudante fora da lista e vincular agora:</span>
                </div>

                <div className="space-y-2.5">
                  <div>
                    <label className="text-[11px] font-mono text-[#807d72] block mb-1">Nome Completo do Aluno:</label>
                    <input
                      type="text"
                      placeholder="Ex: GUILHERME RIBAS DE SOUSA"
                      value={novoNome}
                      onChange={(e) => {
                        setNovoNome(e.target.value);
                        if (!novoEmail && e.target.value.trim()) {
                          const simple = e.target.value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '.');
                          setNovoEmail(`${simple}@aluno.ce.gov.br`);
                        }
                      }}
                      className="w-full px-3 py-2 bg-[#ffffff] border border-[#e6e5e0] rounded-md text-xs text-[#26251e] placeholder-[#a09c92] focus:outline-none focus:border-[#26251e]"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-mono text-[#807d72] block mb-1">E-mail Institucional:</label>
                      <input
                        type="email"
                        placeholder="nome.sobrenome@aluno.ce.gov.br"
                        value={novoEmail}
                        onChange={(e) => setNovoEmail(e.target.value)}
                        className="w-full px-3 py-2 bg-[#ffffff] border border-[#e6e5e0] rounded-md text-xs text-[#26251e] placeholder-[#a09c92] focus:outline-none focus:border-[#26251e]"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-mono text-[#807d72] block mb-1">Turma / Sala:</label>
                      <select
                        value={novoTurma}
                        onChange={(e) => setNovoTurma(e.target.value)}
                        className="w-full px-3 py-2 bg-[#ffffff] border border-[#e6e5e0] rounded-md text-xs text-[#26251e] focus:outline-none focus:border-[#26251e] cursor-pointer"
                      >
                        {[
                          '1° A - INTEGRAL', '1° B - INTEGRAL', '1° C - INTEGRAL', '1° D - INTEGRAL', '1° E - INTEGRAL', '1° F - INTEGRAL',
                          '2° A - MANHÃ', '2° B - MANHÃ', '2° C - MANHÃ', '2° D - TARDE', '2° E - TARDE', '2° F - TARDE',
                          '3° A - MANHÃ', '3° B - MANHÃ', '3° C - MANHÃ', '3° D - MANHÃ', '3° E - TARDE', '3° F - TARDE', '3° G - TARDE'
                        ].map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="text-[10px] text-[#807d72] font-mono bg-[#ffffff] p-2.5 rounded border border-[#e6e5e0]">
                    O estudante receberá a senha padrão inicial <strong>Agora@2026</strong> para entrar em seu portal e consultar a nota desta redação.
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setPickerTab('search')}
                    className="px-3 py-1.5 bg-[#ffffff] border border-[#e6e5e0] text-[#26251e] text-xs font-medium rounded-md hover:bg-[#e6e5e0] cursor-pointer"
                  >
                    Voltar para Busca
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingStudent || !novoNome.trim() || !novoEmail.trim()}
                    className="px-4 py-1.5 bg-[#f54e00] hover:bg-[#d04200] text-white text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isCreatingStudent ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    <span>Cadastrar & Vincular Agora</span>
                  </button>
                </div>
              </form>
            ) : (
              /* SEARCH & SELECT EXISTING STUDENT */
              <>
                {/* Search & Turma Filter Controls */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-[#807d72] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Pesquisar por nome ou e-mail..."
                      value={studentSearchQuery}
                      onChange={(e) => setStudentSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-[#ffffff] border border-[#e6e5e0] rounded-md text-xs text-[#26251e] placeholder-[#a09c92] focus:outline-none focus:border-[#26251e] transition-colors"
                    />
                  </div>

                  {/* Turma Filter Select */}
                  <div className="sm:w-44 shrink-0">
                    <select
                      value={studentTurmaFilter}
                      onChange={(e) => setStudentTurmaFilter(e.target.value)}
                      className="w-full py-2 px-2.5 bg-[#ffffff] border border-[#e6e5e0] rounded-md text-xs text-[#26251e] focus:outline-none focus:border-[#26251e] cursor-pointer"
                    >
                      <option value="todas">Todas as Salas</option>
                      {Array.from(new Set(estudantesList.map(e => e.turma).filter(Boolean))).sort().map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Options List */}
                <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar pr-1">
                  <div
                    onClick={() => { handleVincularAluno(''); setIsStudentPickerOpen(false); }}
                    className={`p-3 rounded-lg border border-[#e6e5e0] transition-all cursor-pointer flex items-center justify-between ${
                      !selectedStudentId ? 'bg-[#f7f7f4] border-[#cfcdc4]' : 'bg-[#ffffff] hover:bg-[#fafaf7]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Unlink className="w-4 h-4 text-[#807d72]" />
                      <div>
                        <span className="text-xs font-medium text-[#26251e] block">Não Vincular a Conta</span>
                        <span className="text-[10px] font-mono text-[#807d72]">Manter com nome manual e sem envio para portal de aluno</span>
                      </div>
                    </div>
                    {!selectedStudentId && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#e6e5e0] text-[#26251e]">
                        SELECIONADO
                      </span>
                    )}
                  </div>

                  {(() => {
                    const filteredEstudantes = estudantesList.filter(est => {
                      if (studentTurmaFilter !== 'todas' && (est.turma || '').toLowerCase() !== studentTurmaFilter.toLowerCase()) {
                        return false;
                      }
                      const query = studentSearchQuery.toLowerCase().trim();
                      if (!query) return true;
                      return (
                        (est.nome || '').toLowerCase().includes(query) ||
                        (est.email || '').toLowerCase().includes(query) ||
                        (est.turma || '').toLowerCase().includes(query)
                      );
                    });

                    if (filteredEstudantes.length === 0) {
                      return (
                        <div className="p-4 text-center text-xs text-[#807d72] font-mono bg-[#fafaf7] rounded-md border border-[#e6e5e0] space-y-2">
                          <p>Nenhum estudante encontrado com este filtro.</p>
                          <button
                            type="button"
                            onClick={() => {
                              setPickerTab('create');
                              setNovoNome(studentSearchQuery);
                            }}
                            className="text-xs font-semibold text-[#f54e00] hover:underline"
                          >
                            + Cadastrar "{studentSearchQuery || 'Novo Aluno'}" agora
                          </button>
                        </div>
                      );
                    }

                    return filteredEstudantes.map((est) => {
                      const isSelected = String(selectedStudentId) === String(est.id);
                      return (
                        <div
                          key={est.id}
                          onClick={() => { handleVincularAluno(est.id); setIsStudentPickerOpen(false); }}
                          className={`p-3 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
                            isSelected
                              ? 'bg-[#9fc9a2]/20 border-[#9fc9a2]'
                              : 'bg-[#ffffff] border-[#e6e5e0] hover:bg-[#fafaf7]'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-[#e6e5e0] flex items-center justify-center shrink-0">
                              <GraduationCap className="w-4 h-4 text-[#26251e]" />
                            </div>
                            <div>
                              <div className="text-xs font-semibold text-[#26251e]">{est.nome}</div>
                              <div className="text-[10px] font-mono text-[#807d72]">{est.email} • {est.turma || 'Sem Turma'}</div>
                            </div>
                          </div>

                          {isSelected ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-[#9fc9a2] text-[#26251e]">
                              VINCULADO
                            </span>
                          ) : (
                            <button
                              type="button"
                              className="px-2.5 py-1 bg-[#f54e00] hover:bg-[#d04200] text-white text-[10px] font-medium uppercase tracking-wider rounded-md transition-colors cursor-pointer"
                            >
                              Vincular
                            </button>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
              </>
            )}

            {/* Modal Footer */}
            <div className="pt-2 border-t border-[#e6e5e0] flex justify-end">
              <button
                type="button"
                onClick={() => setIsStudentPickerOpen(false)}
                className="px-4 py-1.5 bg-[#ffffff] border border-[#e6e5e0] text-[#26251e] font-medium text-xs rounded-md hover:bg-[#fafaf7] cursor-pointer"
              >
                Concluído
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
