import React from 'react';

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

  // Sanitização de texto
  const clean = (str) => {
    if (!str) return '';
    return String(str)
      .replace(/<[^>]*>?/gm, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/[\u0080-\u009F]/g, '')
      .trim();
  };

  const studentNameDisplay = clean(manualName || redacao.nome_aluno || data.aluno || 'ESTUDANTE NÃO IDENTIFICADO');
  const turmaDisplay = clean(manualTurma || redacao.turma_aluno || data.turma || 'Geral');
  const notaTotal = Number(notaEnemCalculada ?? redacao.nota_final ?? 0);
  const temaRedacao = clean(redacao.tema || data.tema || data.titulo_tema || 'Tema Oficial do Exame Nacional do Ensino Médio');

  const printDateStr = new Date().toLocaleDateString('pt-BR');
  const printTimeStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const dataLancamentoStr = redacao.data_captura
    ? new Date(redacao.data_captura).toLocaleDateString('pt-BR')
    : printDateStr;

  const codigoRedacao = `#AG-${String(redacao.id || 54).padStart(4, '0')}-2026`;

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

  // Fontes editoriais consistentes com index.html
  const fontSans = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
  const fontSerif = "'Merriweather', Georgia, Cambria, 'Times New Roman', serif";

  return (
    <div className="folha-oficial-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '30px', alignItems: 'center' }}>

      {/* ========================================================================= */}
      {/* PÁGINA 1: BOLETIM DIAGNÓSTICO DE REDAÇÃO (DESIGN EDITORIAL PADRÃO OURO)    */}
      {/* ========================================================================= */}
      <div
        id={`${idPrefix}-page-1`}
        className="folha-pagina folha-pagina-1"
        style={{
          width: '794px',
          minHeight: '1123px',
          backgroundColor: '#ffffff',
          color: '#1c1c1c',
          padding: '28px 32px',
          boxSizing: 'border-box',
          position: 'relative',
          fontFamily: fontSans,
          fontSize: '11.5px',
          lineHeight: '1.45',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)'
        }}
      >
        {/* CABEÇALHO INSTITUCIONAL & NOTA FINAL */}
        <header style={{ borderBottom: '2px solid #000000', paddingBottom: '12px', marginBottom: '14px', width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px', width: '100%' }}>
            <div>
              <h1 style={{ fontSize: '17px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.4px', color: '#000000', margin: 0, lineHeight: '1.1' }}>
                PROJETO ÁGORA ESCOLAR
              </h1>
              <p style={{ fontSize: '10.5px', fontWeight: '500', color: '#555555', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '3px 0 0 0' }}>
                {customEscola ? clean(customEscola) : 'Boletim Diagnóstico de Redação • Matriz ENEM'}
              </p>
            </div>

            {/* Score Badge */}
            <div style={{
              border: '1.5px solid #000000',
              padding: '5px 14px',
              textAlign: 'center',
              minWidth: '120px',
              flexShrink: 0
            }}>
              <span style={{ fontSize: '8.5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'block', color: '#333333' }}>
                NOTA FINAL
              </span>
              <div style={{ fontSize: '24px', fontWeight: '800', lineHeight: '1.05', color: '#000000', margin: '1px 0' }}>
                {notaTotal}
              </div>
              <span style={{ fontSize: '8.5px', fontWeight: '600', color: '#555555' }}>
                / 1000 PONTOS
              </span>
            </div>
          </div>

          {/* Grid de Metadados */}
          <div style={{
            width: '100%',
            borderTop: '1px solid #000000',
            paddingTop: '8px',
            display: 'grid',
            gridTemplateColumns: '2fr 1.1fr 1fr 0.9fr',
            gap: '10px'
          }}>
            <div>
              <span style={{ fontSize: '8.5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.4px', color: '#555555', display: 'block' }}>
                ESTUDANTE
              </span>
              <strong style={{ fontSize: '11px', color: '#000000', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
                {studentNameDisplay}
              </strong>
            </div>

            <div>
              <span style={{ fontSize: '8.5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.4px', color: '#555555', display: 'block' }}>
                TURMA
              </span>
              <strong style={{ fontSize: '11px', color: '#000000', display: 'block' }}>
                {turmaDisplay}
              </strong>
            </div>

            <div>
              <span style={{ fontSize: '8.5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.4px', color: '#555555', display: 'block' }}>
                IDENTIFICADOR
              </span>
              <strong style={{ fontSize: '11px', color: '#000000', display: 'block' }}>
                {codigoRedacao}
              </strong>
            </div>

            <div>
              <span style={{ fontSize: '8.5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.4px', color: '#555555', display: 'block' }}>
                DATA
              </span>
              <strong style={{ fontSize: '11px', color: '#000000', display: 'block' }}>
                {dataLancamentoStr}
              </strong>
            </div>
          </div>
        </header>

        {/* SEÇÃO 1: MATRIZ DE COMPETÊNCIAS ENEM (ESTILO BOOKTABS) */}
        <section style={{ marginBottom: '14px', width: '100%' }}>
          <div style={{
            borderBottom: '1px solid #000000',
            paddingBottom: '3px',
            margin: '14px 0 8px 0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            width: '100%'
          }}>
            <h2 style={{ fontSize: '12px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.4px', color: '#000000', margin: 0 }}>
              1. Matriz de Competências ENEM
            </h2>
            <span style={{ fontSize: '9px', color: '#555555', textTransform: 'uppercase', letterSpacing: '0.3px', whiteSpace: 'nowrap' }}>
              Grade Oficial INEP
            </span>
          </div>

          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '10px',
            marginBottom: '10px'
          }}>
            <thead>
              <tr style={{ borderTop: '1.5px solid #000000', borderBottom: '1px solid #000000' }}>
                <th style={{ width: '17%', padding: '6px 8px', fontWeight: '700', textTransform: 'uppercase', fontSize: '9px', letterSpacing: '0.4px', color: '#000000', textAlign: 'left' }}>
                  Competência
                </th>
                <th style={{ width: '8%', padding: '6px 8px', fontWeight: '700', textTransform: 'uppercase', fontSize: '9px', letterSpacing: '0.4px', color: '#000000', textAlign: 'center' }}>
                  Pontos
                </th>
                <th style={{ width: '37%', padding: '6px 8px', fontWeight: '700', textTransform: 'uppercase', fontSize: '9px', letterSpacing: '0.4px', color: '#000000', textAlign: 'left' }}>
                  Evidência Textual (Citação)
                </th>
                <th style={{ width: '38%', padding: '6px 8px', fontWeight: '700', textTransform: 'uppercase', fontSize: '9px', letterSpacing: '0.4px', color: '#000000', textAlign: 'left' }}>
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
                    <td style={{ padding: '7px 8px', verticalAlign: 'top', lineHeight: '1.35', color: '#1c1c1c' }}>
                      <span style={{ fontWeight: '800', fontSize: '10.5px', color: '#000000', display: 'block' }}>
                        {code}
                      </span>
                      <span style={{ fontSize: '9.5px', color: '#333333', display: 'block' }}>
                        {title}
                      </span>
                    </td>

                    <td style={{ padding: '7px 8px', verticalAlign: 'top', textAlign: 'center' }}>
                      <span style={{ fontWeight: '800', fontSize: '11.5px', color: '#000000' }}>
                        {comp.nota ?? 0}
                      </span>
                    </td>

                    <td style={{ padding: '7px 8px', verticalAlign: 'top', lineHeight: '1.35' }}>
                      {cleanCitacao ? (
                        <div style={{
                          fontFamily: fontSerif,
                          fontStyle: 'italic',
                          fontSize: '9.5px',
                          lineHeight: '1.35',
                          color: '#333333',
                          paddingLeft: '6px',
                          borderLeft: '1.5px solid #000000'
                        }}>
                          "{cleanCitacao}"
                        </div>
                      ) : (
                        <span style={{ color: '#6b7280', fontSize: '9px' }}>—</span>
                      )}
                    </td>

                    <td style={{ padding: '7px 8px', verticalAlign: 'top', lineHeight: '1.35', color: '#1c1c1c', fontSize: '9.5px' }}>
                      {cleanParecer}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        {/* SEÇÃO 2: RUBRICAS ANALÍTICAS (GRID MINIMALISTA) */}
        {showSisedu && (
          <section style={{ marginBottom: '14px', width: '100%' }}>
            <div style={{
              borderBottom: '1px solid #000000',
              paddingBottom: '3px',
              margin: '14px 0 8px 0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              width: '100%'
            }}>
              <h2 style={{ fontSize: '12px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.4px', color: '#000000', margin: 0 }}>
                2. Rubricas Formativas & Critérios Transversais
              </h2>
              <span style={{ fontSize: '9px', color: '#555555', textTransform: 'uppercase', letterSpacing: '0.3px', whiteSpace: 'nowrap' }}>
                Diagnóstico Qualitativo
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '12px', width: '100%' }}>
              {/* Dimensão Discursiva */}
              <div style={{ border: '1px solid #d1d5db', padding: '8px 12px', width: '100%', boxSizing: 'border-box' }}>
                <div style={{
                  fontSize: '10px',
                  fontWeight: '800',
                  textTransform: 'uppercase',
                  letterSpacing: '0.4px',
                  borderBottom: '1px solid #000000',
                  paddingBottom: '3px',
                  marginBottom: '6px',
                  display: 'flex',
                  justifyContent: 'space-between'
                }}>
                  <span>Dimensão Discursiva</span>
                  <span>Nível</span>
                </div>

                {rubricasDiscursiva.map((item, idx) => (
                  <div key={idx} style={{ marginBottom: idx === rubricasDiscursiva.length - 1 ? 0 : '5px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9.5px', marginBottom: '2px' }}>
                      <span style={{ fontWeight: '600', color: '#000000' }}>{item.title}</span>
                      <span style={{ fontWeight: '700', color: '#1c1c1c' }}>{item.nivel}</span>
                    </div>
                    <div style={{ width: '100%', height: '4px', border: '0.8px solid #000000', background: 'transparent', position: 'relative' }}>
                      <div style={{ height: '100%', backgroundColor: '#000000', width: `${item.percent}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Dimensão Ético-Moral */}
              <div style={{ border: '1px solid #d1d5db', padding: '8px 12px', width: '100%', boxSizing: 'border-box' }}>
                <div style={{
                  fontSize: '10px',
                  fontWeight: '800',
                  textTransform: 'uppercase',
                  letterSpacing: '0.4px',
                  borderBottom: '1px solid #000000',
                  paddingBottom: '3px',
                  marginBottom: '6px',
                  display: 'flex',
                  justifyContent: 'space-between'
                }}>
                  <span>Dimensão Ético-Moral</span>
                  <span>Nível</span>
                </div>

                {rubricasEticoMoral.map((item, idx) => (
                  <div key={idx} style={{ marginBottom: idx === rubricasEticoMoral.length - 1 ? 0 : '5px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9.5px', marginBottom: '2px' }}>
                      <span style={{ fontWeight: '600', color: '#000000' }}>{item.title}</span>
                      <span style={{ fontWeight: '700', color: '#1c1c1c' }}>{item.nivel}</span>
                    </div>
                    <div style={{ width: '100%', height: '4px', border: '0.8px solid #000000', background: 'transparent', position: 'relative' }}>
                      <div style={{ height: '100%', backgroundColor: '#000000', width: `${item.percent}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* SEÇÃO 3: TRANSCRIÇÃO INTEGRAL DA REDAÇÃO (TIPO JORNAL / LIVRO CLÁSSICO) */}
        <section style={{ marginBottom: '14px', width: '100%' }}>
          <div style={{
            borderBottom: '1px solid #000000',
            paddingBottom: '3px',
            margin: '14px 0 8px 0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            width: '100%'
          }}>
            <h2 style={{ fontSize: '12px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.4px', color: '#000000', margin: 0 }}>
              3. Transcrição Integral do Texto
            </h2>
            <span style={{ fontSize: '9px', color: '#555555', textTransform: 'uppercase', letterSpacing: '0.3px', whiteSpace: 'nowrap' }}>
              Produção Original do Estudante
            </span>
          </div>

          <div style={{
            border: '1px solid #000000',
            padding: '12px 16px',
            marginBottom: '12px',
            width: '100%',
            maxWidth: '100%',
            boxSizing: 'border-box',
            overflowWrap: 'break-word',
            wordWrap: 'break-word'
          }}>
            <div style={{ borderBottom: '1px solid #000000', paddingBottom: '5px', marginBottom: '8px' }}>
              <span style={{ fontSize: '8px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px', color: '#555555', display: 'block' }}>
                Tema Proposto
              </span>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#000000' }}>
                "{temaRedacao}"
              </div>
            </div>

            <div style={{
              fontFamily: fontSerif,
              fontSize: '10.5px',
              lineHeight: '1.6',
              color: '#1c1c1c',
              textAlign: 'justify',
              hyphens: 'auto',
              width: '100%',
              maxWidth: '100%',
              boxSizing: 'border-box',
              overflowWrap: 'break-word',
              wordWrap: 'break-word',
              whiteSpace: 'pre-line'
            }}>
              {sanitizedFullText}
            </div>
          </div>
        </section>

        {/* RODAPÉ COM ESPAÇO REAL DE 80PX PARA ASSINATURA MANUAL & NOTAS LEGAIS */}
        <footer style={{
          borderTop: '1.5px solid #000000',
          marginTop: '20px',
          paddingTop: '12px',
          width: '100%'
        }}>
          {showSignature && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              marginBottom: '10px'
            }}>
              <div style={{
                width: '320px',
                borderBottom: '1px solid #000000',
                marginBottom: '6px',
                height: '80px' // Espaço vertical amplo para assinatura manual à caneta
              }}></div>
              <div style={{ fontSize: '10.5px', fontWeight: '700', color: '#000000' }}>
                {customProfessor || 'Prof. Avaliador Responsável • Banca Examinadora'}
              </div>
              <div style={{ fontSize: '9px', color: '#555555', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Projeto Ágora Escolar • Correção Oficial de Redação ENEM
              </div>
            </div>
          )}

          <div style={{
            fontSize: '8px',
            color: '#555555',
            borderTop: '0.5px solid #d1d5db',
            paddingTop: '5px',
            display: 'flex',
            justifyContent: 'space-between',
            width: '100%'
          }}>
            <span>© 2026 Projeto Ágora Escolar. Todos os direitos reservados. Uso pedagógico restrito.</span>
            <span>Avaliação baseada na Matriz Oficial de Referência do ENEM (INEP).</span>
          </div>
        </footer>
      </div>

      {/* ========================================================================= */}
      {/* PÁGINA 2 (ANEXO II): SE NECESSÁRIA PARA TRANSCRIÇÃO EXPANDIDA/RECADO        */}
      {/* ========================================================================= */}
      <div
        id={`${idPrefix}-page-2`}
        className="folha-pagina folha-pagina-2"
        style={{
          width: '794px',
          minHeight: '1123px',
          backgroundColor: '#ffffff',
          color: '#1c1c1c',
          padding: '28px 32px',
          boxSizing: 'border-box',
          position: 'relative',
          fontFamily: fontSans,
          fontSize: '11.5px',
          lineHeight: '1.45',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)'
        }}
      >
        <header style={{ borderBottom: '2px solid #000000', paddingBottom: '10px', marginBottom: '14px', width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <div>
              <h2 style={{ fontSize: '14px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.4px', color: '#000000', margin: 0 }}>
                ANEXO II: TRANSCRIÇÃO COMPLETA & PARECER FINAL
              </h2>
              <p style={{ fontSize: '9.5px', color: '#555555', textTransform: 'uppercase', margin: '2px 0 0 0' }}>
                Registro #{String(redacao.id || 54).padStart(5, '0')} • Estudante: <strong>{studentNameDisplay}</strong>
              </p>
            </div>
            <div style={{ textAlign: 'right', fontSize: '9px', color: '#555555' }}>
              Data: <strong>{dataLancamentoStr}</strong>
            </div>
          </div>
        </header>

        {/* Transcrição Completa Ampliada */}
        <section style={{ marginBottom: '16px', flex: 1 }}>
          <div style={{
            borderBottom: '1px solid #000000',
            paddingBottom: '3px',
            marginBottom: '8px'
          }}>
            <h3 style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.4px', color: '#000000', margin: 0 }}>
              Texto Integral da Redação (Verbatim)
            </h3>
          </div>

          <div style={{
            border: '1px solid #000000',
            padding: '16px 20px',
            backgroundColor: '#ffffff',
            fontFamily: fontSerif,
            fontSize: '11px',
            lineHeight: '1.7',
            color: '#111111',
            textAlign: 'justify',
            whiteSpace: 'pre-line',
            boxSizing: 'border-box',
            marginBottom: '14px'
          }}>
            {sanitizedFullText}
          </div>

          {customRecado && (
            <div style={{
              border: '1px solid #000000',
              padding: '12px 16px',
              backgroundColor: '#fafafa',
              boxSizing: 'border-box'
            }}>
              <strong style={{ fontSize: '10px', textTransform: 'uppercase', display: 'block', marginBottom: '4px', color: '#000000' }}>
                Orientações Pedagógicas do Avaliador:
              </strong>
              <p style={{ fontSize: '10px', lineHeight: '1.45', color: '#333333', margin: 0 }}>
                {clean(customRecado)}
              </p>
            </div>
          )}
        </section>

        {/* Rodapé da Página 2 */}
        <footer style={{
          borderTop: '1.5px solid #000000',
          marginTop: 'auto',
          paddingTop: '12px',
          width: '100%'
        }}>
          {showSignature && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              marginBottom: '10px'
            }}>
              <div style={{
                width: '320px',
                borderBottom: '1px solid #000000',
                marginBottom: '6px',
                height: '60px'
              }}></div>
              <div style={{ fontSize: '10.5px', fontWeight: '700', color: '#000000' }}>
                {customProfessor || 'Prof. Avaliador Responsável • Banca Examinadora'}
              </div>
              <div style={{ fontSize: '9px', color: '#555555', textTransform: 'uppercase' }}>
                Visto de Validação Pedagógica
              </div>
            </div>
          )}

          <div style={{
            fontSize: '8px',
            color: '#555555',
            borderTop: '0.5px solid #d1d5db',
            paddingTop: '5px',
            display: 'flex',
            justifyContent: 'space-between',
            width: '100%'
          }}>
            <span>Documento Oficial • Projeto Ágora Escolar (ENEM x SISEDU)</span>
            <span>Página 2 de 2</span>
          </div>
        </footer>
      </div>

    </div>
  );
}
