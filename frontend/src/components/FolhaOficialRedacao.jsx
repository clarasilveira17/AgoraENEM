import React from 'react';

/**
 * Robust text sanitizer for official documents (Unicode NFKC + control chars removal)
 */
export const cleanPrintText = (str) => {
  if (str === null || str === undefined) return '';
  return String(str)
    .normalize('NFKC')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
    .trim();
};

/**
 * Componente da Folha Oficial de Avaliação e Redação (Documento Oficial Projeto Ágora Escolar).
 * Design Editorial Monocromático de Alta Fidelidade (Padrão Ouro Ink-Saving),
 * idêntico ao modelo consolidado no index.html.
 */
export default function FolhaOficialRedacao({
  redacao,
  manualName,
  manualTurma,
  notaEnemCalculada,
  enem = {},
  siseduDescritores = {},
  sisedu = {},
  fullTextContent = '',
  customEscola = 'PROJETO ÁGORA ESCOLAR • SISTEMA PREDITIVO DE AVALIAÇÃO TEXTUAL (ENEM X SISEDU)',
  customProfessor = 'Prof. Avaliador Responsável • Banca Examinadora',
  customRecado = '',
  showSisedu = true,
  showWatermark = false,
  showSignature = true,
  showPage2 = true,
  pdfPageMode = 'both', // 'single' | 'both'
  idPrefix = 'pdf-export'
}) {
  if (!redacao) return null;

  const rawExtracted = redacao.extracted_data;
  let data = {};
  if (typeof rawExtracted === 'string') {
    try { data = JSON.parse(rawExtracted); } catch (e) { data = {}; }
  } else {
    data = rawExtracted || {};
  }

  const clean = cleanPrintText;

  const studentNameDisplay = clean(manualName || redacao.nome_aluno || data.aluno || 'Estudante Não Identificado');
  const turmaDisplay = clean(manualTurma || redacao.turma_aluno || data.turma || 'Geral');
  
  // Safe score clamp (0 - 1000)
  const rawScore = Number(notaEnemCalculada ?? redacao.nota_final ?? 0);
  const notaTotal = Math.min(1000, Math.max(0, isNaN(rawScore) ? 0 : rawScore));
  
  const temaRedacao = clean(redacao.tema || data.tema || data.titulo_tema || 'Tema Oficial do Exame Nacional do Ensino Médio');

  const printDateStr = new Date().toLocaleDateString('pt-BR');
  
  // Safe Date parsing
  let dataLancamentoStr = printDateStr;
  if (redacao.data_captura) {
    const parsedDate = new Date(redacao.data_captura);
    if (!isNaN(parsedDate.getTime()) && parsedDate.getFullYear() >= 2000 && parsedDate.getFullYear() <= 2100) {
      dataLancamentoStr = parsedDate.toLocaleDateString('pt-BR');
    }
  }

  const rawIdNum = redacao.id ? String(redacao.id).padStart(4, '0') : '0000';
  const codigoRedacao = `#AG-${rawIdNum}-2026`;

  const enemCompetenciasMap = [
    { key: 'competencia_1', code: 'C1', title: 'Norma Padrão', name: 'Domínio da modalidade escrita formal' },
    { key: 'competencia_2', code: 'C2', title: 'Tema e Repertório', name: 'Compreensão da proposta e repertório' },
    { key: 'competencia_3', code: 'C3', title: 'Projeto de Texto', name: 'Seleção e organização de argumentos' },
    { key: 'competencia_4', code: 'C4', title: 'Coesão Textual', name: 'Mecanismos linguísticos de coesão' },
    { key: 'competencia_5', code: 'C5', title: 'Proposta de Intervenção', name: 'Elaboração de proposta cidadã' }
  ];

  // Helper de cálculo de porcentagem para barra de progresso
  const getPercentFromNivel = (nivel, defaultPct = 85) => {
    const n = String(nivel || '').toLowerCase();
    if (n.includes('excelente') || n.includes('pleno') || n.includes('avançado') || n.includes('avancado')) return 100;
    if (n.includes('proficiente') || n.includes('adequado') || n.includes('bom')) return 85;
    if (n.includes('intermediário') || n.includes('intermediario') || n.includes('médio') || n.includes('medio')) return 70;
    if (n.includes('básico') || n.includes('basico') || n.includes('regular')) return 50;
    if (n.includes('inicial') || n.includes('insuficiente')) return 30;
    return defaultPct;
  };

  // Rubricas Qualitativas (Dimensão Discursiva e Dimensão Ético-Moral)
  const nivelTese = siseduDescritores['D06']?.nivel || siseduDescritores['D13']?.nivel || (notaTotal >= 800 ? 'Avançado' : 'Adequado');
  const nivelArg = siseduDescritores['D16']?.nivel || siseduDescritores['D14']?.nivel || (enem.competencia_3?.nota >= 160 ? 'Avançado' : 'Adequado');
  const nivelRep = siseduDescritores['D05']?.nivel || (enem.competencia_2?.nota >= 160 ? 'Excelente' : 'Adequado');

  const rubricasDiscursiva = [
    {
      title: 'Clareza e Fluência Textual',
      nivel: `${nivelTese} (${getPercentFromNivel(nivelTese, 90)}%)`,
      percent: getPercentFromNivel(nivelTese, 90)
    },
    {
      title: 'Consistência e Progressão',
      nivel: `${nivelArg} (${getPercentFromNivel(nivelArg, 85)}%)`,
      percent: getPercentFromNivel(nivelArg, 85)
    },
    {
      title: 'Produtividade de Repertório',
      nivel: `${nivelRep} (${getPercentFromNivel(nivelRep, 100)}%)`,
      percent: getPercentFromNivel(nivelRep, 100)
    }
  ];

  const nivelDH = siseduDescritores['D15']?.nivel || (enem.competencia_5?.nota >= 160 ? 'Pleno' : 'Adequado');
  const nivelJust = siseduDescritores['D18']?.nivel || (enem.competencia_5?.nota >= 160 ? 'Avançado' : 'Adequado');
  const nivelConc = (enem.competencia_5?.nota >= 160 ? 'Excelente' : enem.competencia_5?.nota >= 120 ? 'Proficiente' : 'Inicial');

  const rubricasEticoMoral = [
    {
      title: 'Respeito aos Direitos Humanos',
      nivel: `${nivelDH} (${getPercentFromNivel(nivelDH, 100)}%)`,
      percent: getPercentFromNivel(nivelDH, 100)
    },
    {
      title: 'Justificação Axiológica',
      nivel: `${nivelJust} (${getPercentFromNivel(nivelJust, 90)}%)`,
      percent: getPercentFromNivel(nivelJust, 90)
    },
    {
      title: 'Eficácia da Proposta',
      nivel: `${nivelConc} (${getPercentFromNivel(nivelConc, 95)}%)`,
      percent: getPercentFromNivel(nivelConc, 95)
    }
  ];

  const sanitizedFullText = clean(fullTextContent || data.texto_transcrito || redacao.texto_digitado || 'Texto da redação indisponível.');

  // Fontes editoriais carregadas
  const fontSans = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
  const fontSerif = "'Merriweather', Georgia, Cambria, 'Times New Roman', serif";

  const isPage2Visible = showPage2 || pdfPageMode === 'both';

  return (
    <div className="folha-oficial-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '30px', alignItems: 'center' }}>

      {/* ========================================================================= */}
      {/* PÁGINA 1: BOLETIM DIAGNÓSTICO DE REDAÇÃO (DESIGN EDITORIAL PADRÃO OURO)    */}
      {/* ========================================================================= */}
      <div
        id={`${idPrefix}-page-1`}
        className="folha-pagina folha-pagina-1"
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          width: '760px',
          maxWidth: '760px',
          minHeight: '1080px',
          backgroundColor: '#ffffff',
          color: '#1c1c1c',
          padding: '24px 28px',
          boxSizing: 'border-box',
          position: 'relative',
          fontFamily: fontSans,
          fontSize: '10px',
          lineHeight: '1.4',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)'
        }}
      >
        {/* CABEÇALHO INSTITUCIONAL & NOTA FINAL */}
        <header style={{ borderBottom: '2px solid #000000', paddingBottom: '8px', marginBottom: '10px', width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px', width: '100%' }}>
            <div>
              <h1 style={{ fontSize: '15px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.4px', color: '#000000', margin: 0, lineHeight: '1.1' }}>
                PROJETO ÁGORA ESCOLAR
              </h1>
              <p style={{ fontSize: '9.5px', fontWeight: '500', color: '#555555', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '2px 0 0 0' }}>
                {customEscola ? clean(customEscola) : 'Boletim Diagnóstico de Redação • Matriz ENEM'}
              </p>
            </div>

            {/* Score Badge */}
            <div style={{
              border: '1.5px solid #000000',
              padding: '4px 12px',
              textAlign: 'center',
              minWidth: '110px',
              flexShrink: 0
            }}>
              <span style={{ fontSize: '7.5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'block', color: '#333333' }}>
                NOTA FINAL
              </span>
              <div style={{ fontSize: '21px', fontWeight: '800', lineHeight: '1.05', color: '#000000', margin: '1px 0' }}>
                {notaTotal}
              </div>
              <span style={{ fontSize: '7.5px', fontWeight: '600', color: '#555555' }}>
                / 1000 PONTOS
              </span>
            </div>
          </div>

          {/* Grid de Metadados com Alinhamento Rígido de Linha de Base */}
          <div style={{
            width: '100%',
            borderTop: '1px solid #000000',
            paddingTop: '6px',
            display: 'grid',
            gridTemplateColumns: '2.5fr 1.2fr 1.2fr 1fr',
            gap: '12px',
            alignItems: 'flex-start'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '7.5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.4px', color: '#555555', marginBottom: '2px', lineHeight: '1' }}>
                ESTUDANTE
              </span>
              <strong style={{ fontSize: '10.5px', fontWeight: '800', color: '#000000', lineHeight: '1.2', margin: 0 }}>
                {studentNameDisplay}
              </strong>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '7.5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.4px', color: '#555555', marginBottom: '2px', lineHeight: '1' }}>
                TURMA
              </span>
              <strong style={{ fontSize: '10px', fontWeight: '700', color: '#000000', lineHeight: '1.2', margin: 0 }}>
                {turmaDisplay}
              </strong>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '7.5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.4px', color: '#555555', marginBottom: '2px', lineHeight: '1' }}>
                IDENTIFICADOR
              </span>
              <strong style={{ fontSize: '10px', fontWeight: '700', color: '#000000', lineHeight: '1.2', margin: 0 }}>
                {codigoRedacao}
              </strong>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '7.5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.4px', color: '#555555', marginBottom: '2px', lineHeight: '1' }}>
                DATA
              </span>
              <strong style={{ fontSize: '10px', fontWeight: '700', color: '#000000', lineHeight: '1.2', margin: 0 }}>
                {dataLancamentoStr}
              </strong>
            </div>
          </div>
        </header>

        {/* SEÇÃO 1: MATRIZ DE COMPETÊNCIAS ENEM (ESTILO BOOKTABS ALINHADO) */}
        <section style={{ marginBottom: '10px', width: '100%' }}>
          <div style={{
            borderBottom: '1px solid #000000',
            paddingBottom: '2px',
            margin: '10px 0 6px 0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            width: '100%'
          }}>
            <h2 style={{ fontSize: '10.5px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.4px', color: '#000000', margin: 0 }}>
              1. Matriz de Competências ENEM
            </h2>
            <span style={{ fontSize: '8px', color: '#555555', textTransform: 'uppercase', letterSpacing: '0.3px', whiteSpace: 'nowrap' }}>
              Grade Oficial INEP
            </span>
          </div>

          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '9px',
            marginBottom: '8px'
          }}>
            <thead>
              <tr style={{ borderTop: '1.5px solid #000000', borderBottom: '1px solid #000000' }}>
                <th style={{ width: '18%', padding: '5px 6px', fontWeight: '700', textTransform: 'uppercase', fontSize: '8px', letterSpacing: '0.4px', color: '#000000', textAlign: 'left' }}>
                  Competência
                </th>
                <th style={{ width: '9%', padding: '5px 6px', fontWeight: '700', textTransform: 'uppercase', fontSize: '8px', letterSpacing: '0.4px', color: '#000000', textAlign: 'center' }}>
                  Pontos
                </th>
                <th style={{ width: '36%', padding: '5px 6px', fontWeight: '700', textTransform: 'uppercase', fontSize: '8px', letterSpacing: '0.4px', color: '#000000', textAlign: 'left' }}>
                  Evidência Textual (Citação)
                </th>
                <th style={{ width: '37%', padding: '5px 6px', fontWeight: '700', textTransform: 'uppercase', fontSize: '8px', letterSpacing: '0.4px', color: '#000000', textAlign: 'left' }}>
                  Parecer Avaliativo
                </th>
              </tr>
            </thead>
            <tbody>
              {enemCompetenciasMap.map(({ key, code, title }, idx) => {
                const comp = enem[key] || { nota: 0, citacao_texto: '', justificativa: 'Não avaliado' };
                const cleanCitacao = clean(comp.citacao_texto);
                const cleanParecer = clean(comp.justificativa || comp.comentario || 'Avaliação formal de proficiência textual.');
                const isLast = idx === enemCompetenciasMap.length - 1;

                return (
                  <tr key={key} style={{ borderBottom: isLast ? '1.5px solid #000000' : '0.5px solid #d1d5db' }}>
                    <td style={{ padding: '6px 6px', verticalAlign: 'top', lineHeight: '1.35', color: '#1c1c1c' }}>
                      <span style={{ fontWeight: '800', fontSize: '9.5px', color: '#000000', display: 'block' }}>
                        {code}
                      </span>
                      <span style={{ fontSize: '8.5px', color: '#333333', display: 'block' }}>
                        {title}
                      </span>
                    </td>

                    <td style={{ padding: '6px 6px', verticalAlign: 'top', textAlign: 'center' }}>
                      <span style={{ fontWeight: '800', fontSize: '11px', color: '#000000', display: 'inline-block', lineHeight: '1.2' }}>
                        {Math.min(200, Math.max(0, Number(comp.nota ?? 0)))}
                      </span>
                    </td>

                    <td style={{ padding: '6px 6px', verticalAlign: 'top', lineHeight: '1.35' }}>
                      {cleanCitacao ? (
                        <div style={{
                          fontStyle: 'italic',
                          fontSize: '8.5px',
                          lineHeight: '1.35',
                          color: '#262626',
                          backgroundColor: '#f8f8f8',
                          padding: '3px 6px',
                          border: '0.5px solid #d1d5db',
                          borderRadius: '2px',
                          wordBreak: 'normal',
                          overflowWrap: 'normal'
                        }}>
                          “{cleanCitacao}”
                        </div>
                      ) : (
                        <span style={{ color: '#9ca3af', fontSize: '8.5px' }}>—</span>
                      )}
                    </td>

                    <td style={{ padding: '6px 6px', verticalAlign: 'top', lineHeight: '1.35', color: '#1c1c1c', fontSize: '8.5px', wordBreak: 'normal', overflowWrap: 'normal' }}>
                      {cleanParecer}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        {/* SEÇÃO 2: RUBRICAS ANALÍTICAS (GRID FLEXBOX SEM BORDAS QUE CORTAM) */}
        {showSisedu && (
          <section style={{ marginBottom: '10px', width: '100%' }}>
            <div style={{
              borderBottom: '1px solid #000000',
              paddingBottom: '2px',
              margin: '10px 0 6px 0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              width: '100%'
            }}>
              <h2 style={{ fontSize: '10.5px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.4px', color: '#000000', margin: 0 }}>
                2. Rubricas Formativas & Critérios Transversais
              </h2>
              <span style={{ fontSize: '8px', color: '#555555', textTransform: 'uppercase', letterSpacing: '0.3px', whiteSpace: 'nowrap' }}>
                Diagnóstico Qualitativo
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '8px', width: '100%' }}>
              {/* Dimensão Discursiva */}
              <div style={{ border: '1px solid #000000', padding: '8px 12px', width: '100%', boxSizing: 'border-box' }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid #000000',
                  paddingBottom: '3px',
                  marginBottom: '5px'
                }}>
                  <span style={{ textAlign: 'left', fontWeight: '800', textTransform: 'uppercase', fontSize: '8px', color: '#000000' }}>
                    Dimensão Discursiva
                  </span>
                  <span style={{ textAlign: 'right', fontWeight: '800', textTransform: 'uppercase', fontSize: '8px', color: '#000000' }}>
                    Nível
                  </span>
                </div>
                {rubricasDiscursiva.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '4px 0',
                      borderBottom: idx === rubricasDiscursiva.length - 1 ? 'none' : '0.5px solid #e5e7eb'
                    }}
                  >
                    <span style={{ fontSize: '8.5px', color: '#1c1c1c', fontWeight: '600' }}>
                      {item.title}
                    </span>
                    <span style={{
                      display: 'inline-block',
                      border: '1px solid #000000',
                      borderRadius: '2px',
                      padding: '1px 6px',
                      fontSize: '8px',
                      fontWeight: '700',
                      backgroundColor: '#fafafa',
                      color: '#000000',
                      lineHeight: '1.2'
                    }}>
                      {item.nivel}
                    </span>
                  </div>
                ))}
              </div>

              {/* Dimensão Ético-Moral */}
              <div style={{ border: '1px solid #000000', padding: '8px 12px', width: '100%', boxSizing: 'border-box' }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid #000000',
                  paddingBottom: '3px',
                  marginBottom: '5px'
                }}>
                  <span style={{ textAlign: 'left', fontWeight: '800', textTransform: 'uppercase', fontSize: '8px', color: '#000000' }}>
                    Dimensão Ético-Moral
                  </span>
                  <span style={{ textAlign: 'right', fontWeight: '800', textTransform: 'uppercase', fontSize: '8px', color: '#000000' }}>
                    Nível
                  </span>
                </div>
                {rubricasEticoMoral.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '4px 0',
                      borderBottom: idx === rubricasEticoMoral.length - 1 ? 'none' : '0.5px solid #e5e7eb'
                    }}
                  >
                    <span style={{ fontSize: '8.5px', color: '#1c1c1c', fontWeight: '600' }}>
                      {item.title}
                    </span>
                    <span style={{
                      display: 'inline-block',
                      border: '1px solid #000000',
                      borderRadius: '2px',
                      padding: '1px 6px',
                      fontSize: '8px',
                      fontWeight: '700',
                      backgroundColor: '#fafafa',
                      color: '#000000',
                      lineHeight: '1.2'
                    }}>
                      {item.nivel}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* RODAPÉ DA PÁGINA 1 COM AVISO DE CONTINUAÇÃO */}
        <footer style={{
          borderTop: '1.5px solid #000000',
          marginTop: 'auto',
          paddingTop: '10px',
          width: '100%'
        }}>
          <div style={{
            fontSize: '8px',
            color: '#444444',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: '100%'
          }}>
            <span>© 2026 Projeto Ágora Escolar • Boletim Diagnóstico de Redação (ENEM x SISEDU)</span>
            <span style={{ fontWeight: '700', color: '#000000' }}>Página 1 de 2 • Continua no verso (Produção Original do Estudante) ➔</span>
          </div>
        </footer>
      </div>

      {/* ========================================================================= */}
      {/* PÁGINA 2: PRODUÇÃO ORIGINAL DO ESTUDANTE & VALIDAÇÃO PEDAGÓGICA          */}
      {/* ========================================================================= */}
      <div
        id={`${idPrefix}-page-2`}
        className="folha-pagina folha-pagina-2 anexo-container"
        style={{
          display: isPage2Visible ? 'flex' : 'none',
          flexDirection: 'column',
          justifyContent: 'space-between',
          width: '760px',
          maxWidth: '760px',
          minHeight: '1080px',
          backgroundColor: '#ffffff',
          color: '#1c1c1c',
          padding: '24px 28px',
          boxSizing: 'border-box',
          position: 'relative',
          fontFamily: fontSans,
          fontSize: '10px',
          lineHeight: '1.4',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)'
        }}
      >
        <div>
          {/* CABEÇALHO DA PÁGINA 2 */}
          <header style={{ borderBottom: '2px solid #000000', paddingBottom: '8px', marginBottom: '14px', width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
              <div>
                <h1 style={{ fontSize: '14px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.4px', color: '#000000', margin: 0, lineHeight: '1.1' }}>
                  PROJETO ÁGORA ESCOLAR
                </h1>
                <p style={{ fontSize: '9px', fontWeight: '600', color: '#555555', textTransform: 'uppercase', letterSpacing: '0.4px', margin: '2px 0 0 0' }}>
                  Folha Oficial de Transcrição & Produção Textual do Estudante
                </p>
              </div>

              <div style={{
                border: '1.5px solid #000000',
                padding: '3px 10px',
                textAlign: 'center',
                flexShrink: 0
              }}>
                <span style={{ fontSize: '8px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.6px', color: '#000000' }}>
                  PÁGINA 2 DE 2
                </span>
              </div>
            </div>

            {/* Metadados resumidos da Página 2 com Grid Alinhado */}
            <div style={{
              width: '100%',
              borderTop: '1px solid #000000',
              marginTop: '6px',
              paddingTop: '6px',
              display: 'grid',
              gridTemplateColumns: '2.5fr 1.2fr 1.2fr 1fr',
              gap: '12px',
              alignItems: 'flex-start'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '7.5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.4px', color: '#555555', marginBottom: '2px', lineHeight: '1' }}>
                  ESTUDANTE
                </span>
                <strong style={{ color: '#000000', fontSize: '9.5px', fontWeight: '800', lineHeight: '1.2' }}>{studentNameDisplay}</strong>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '7.5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.4px', color: '#555555', marginBottom: '2px', lineHeight: '1' }}>
                  TURMA
                </span>
                <strong style={{ color: '#000000', fontSize: '9.5px', fontWeight: '700', lineHeight: '1.2' }}>{turmaDisplay}</strong>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '7.5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.4px', color: '#555555', marginBottom: '2px', lineHeight: '1' }}>
                  IDENTIFICADOR
                </span>
                <strong style={{ color: '#000000', fontSize: '9.5px', fontWeight: '700', lineHeight: '1.2' }}>{codigoRedacao}</strong>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '7.5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.4px', color: '#555555', marginBottom: '2px', lineHeight: '1' }}>
                  DATA
                </span>
                <strong style={{ color: '#000000', fontSize: '9.5px', fontWeight: '700', lineHeight: '1.2' }}>{dataLancamentoStr}</strong>
              </div>
            </div>
          </header>

          {/* SEÇÃO 3: TRANSCRIÇÃO INTEGRAL DO TEXTO */}
          <section style={{ marginBottom: '14px', width: '100%' }}>
            <div style={{
              borderBottom: '1.5px solid #000000',
              paddingBottom: '3px',
              marginBottom: '10px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              width: '100%'
            }}>
              <h2 style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.4px', color: '#000000', margin: 0 }}>
                3. Transcrição Integral do Texto
              </h2>
              <span style={{ fontSize: '8.5px', color: '#555555', textTransform: 'uppercase', letterSpacing: '0.3px', whiteSpace: 'nowrap' }}>
                Produção Original do Estudante
              </span>
            </div>

            <div className="essay-box" style={{
              border: '1px solid #000000',
              padding: '14px 18px',
              marginBottom: '12px',
              width: '100%',
              maxWidth: '100%',
              boxSizing: 'border-box',
              backgroundColor: '#ffffff'
            }}>
              <div style={{ borderBottom: '1px solid #000000', paddingBottom: '6px', marginBottom: '12px' }}>
                <span style={{ fontSize: '8px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px', color: '#555555', display: 'block' }}>
                  Tema Proposto
                </span>
                <div style={{ fontSize: '10.5px', fontWeight: '700', color: '#000000', marginTop: '1px' }}>
                  "{temaRedacao}"
                </div>
              </div>

              <div className="essay-body" style={{
                fontFamily: fontSerif,
                fontSize: '10pt',
                lineHeight: '1.7',
                color: '#1c1c1c',
                textAlign: 'left',
                hyphens: 'none',
                WebkitHyphens: 'none',
                msHyphens: 'none',
                width: '100%',
                maxWidth: '100%',
                boxSizing: 'border-box',
                wordBreak: 'normal',
                overflowWrap: 'normal'
              }}>
                {sanitizedFullText.split('\n\n').filter(Boolean).length > 1 ? (
                  sanitizedFullText.split('\n\n').filter(Boolean).map((paragrafo, pIdx) => (
                    <p
                      key={pIdx}
                      style={{
                        textIndent: '2em',
                        marginBottom: '10px',
                        wordBreak: 'normal',
                        overflowWrap: 'normal',
                        hyphens: 'none',
                        textAlign: 'left'
                      }}
                    >
                      {paragrafo.trim()}
                    </p>
                  ))
                ) : (
                  <p
                    style={{
                      textIndent: '2em',
                      marginBottom: '10px',
                      wordBreak: 'normal',
                      overflowWrap: 'normal',
                      hyphens: 'none',
                      textAlign: 'left'
                    }}
                  >
                    {sanitizedFullText}
                  </p>
                )}
              </div>
            </div>

            {/* Orientações Pedagógicas / Observações do Professor */}
            {customRecado && (
              <div style={{
                border: '1px solid #000000',
                padding: '10px 14px',
                backgroundColor: '#fafafa',
                boxSizing: 'border-box',
                marginBottom: '12px'
              }}>
                <strong style={{ fontSize: '9px', textTransform: 'uppercase', display: 'block', marginBottom: '3px', color: '#000000' }}>
                  Orientações Pedagógicas do Avaliador:
                </strong>
                <p style={{ fontSize: '9px', lineHeight: '1.4', color: '#333333', margin: 0, wordBreak: 'normal', overflowWrap: 'break-word' }}>
                  {clean(customRecado)}
                </p>
              </div>
            )}
          </section>
        </div>

        {/* RODAPÉ DA PÁGINA 2 COM AMPLO ESPAÇO FÍSICO PARA ASSINATURA & NOTAS LEGAIS */}
        <footer style={{
          borderTop: '1.5px solid #000000',
          marginTop: 'auto',
          paddingTop: '10px',
          width: '100%'
        }}>
          {showSignature && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              marginTop: '10px',
              marginBottom: '12px'
            }}>
              {/* Espaço em branco confortável (48px) para assinatura física do professor com caneta */}
              <div style={{ height: '48px', width: '100%' }}></div>
              <div style={{
                width: '320px',
                height: '1px',
                backgroundColor: '#000000',
                marginBottom: '6px'
              }}></div>
              <div style={{ fontSize: '10px', fontWeight: '700', color: '#000000' }}>
                {customProfessor || 'Prof. Avaliador Responsável • Banca Examinadora'}
              </div>
              <div style={{ fontSize: '8px', color: '#555555', textTransform: 'uppercase', letterSpacing: '0.4px', marginTop: '1px' }}>
                Projeto Ágora Escolar • Visto de Validação Pedagógica
              </div>
            </div>
          )}

          <div style={{
            fontSize: '7.5px',
            color: '#555555',
            borderTop: '0.5px solid #d1d5db',
            paddingTop: '4px',
            display: 'flex',
            justifyContent: 'space-between',
            width: '100%'
          }}>
            <span>© 2026 Projeto Ágora Escolar. Todos os direitos reservados. Uso pedagógico restrito.</span>
            <span>Página 2 de 2 • Avaliação baseada na Matriz Oficial de Referência do ENEM (INEP).</span>
          </div>
        </footer>
      </div>

    </div>
  );
}
