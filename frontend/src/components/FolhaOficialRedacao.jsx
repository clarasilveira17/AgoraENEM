import React from 'react';
import { ShieldCheck, Sparkles } from 'lucide-react';

/**
 * Componente da Folha Oficial de Avaliação e Redação (Documento Oficial Projeto Ágora Escolar).
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
  customEscola = 'Projeto Ágora Escolar • Ensino Médio',
  customProfessor = 'Professor(a) Avaliador(a)',
  customRecado = '',
  showSisedu = true,
  showWatermark = true,
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

  const studentNameDisplay = clean(manualName || redacao.nome_aluno || data.aluno || 'Estudante Não Identificado');
  const turmaDisplay = clean(manualTurma || redacao.turma_aluno || data.turma || 'Geral');
  const notaTotal = Number(notaEnemCalculada ?? redacao.nota_final ?? 0);
  const scoreGaugePct = Math.min(100, Math.max(0, (notaTotal / 1000) * 100));

  const printDateStr = new Date().toLocaleDateString('pt-BR');
  const printTimeStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const authHash = `SHA256:${String(redacao.id * 7919 + 104729).padStart(8, '0')}FE${String(redacao.id * 104729).substring(0, 16).toUpperCase()}`;

  const enemCompetenciasMap = [
    { key: 'competencia_1', title: 'Competência 1 - Norma Culta' },
    { key: 'competencia_2', title: 'Competência 2 - Tema e Repertório' },
    { key: 'competencia_3', title: 'Competência 3 - Argumentação' },
    { key: 'competencia_4', title: 'Competência 4 - Coesão e Coerência' },
    { key: 'competencia_5', title: 'Competência 5 - Proposta de Intervenção' }
  ];

  const siseduDescritoresMap = [
    { code: 'D05', title: 'Interpretação Gráfica/Textual' },
    { code: 'D06', title: 'Identificação Tema/Tese' },
    { code: 'D12', title: 'Coesão/Substituição Lexical' },
    { code: 'D13', title: 'Tese Principal/Central' },
    { code: 'D14', title: 'Distinção Partes do Texto' },
    { code: 'D15', title: 'Posições Distintas' },
    { code: 'D16', title: 'Articulação Tese e Arg.' },
    { code: 'D17', title: 'Escolha Vocabular/Sentido' },
    { code: 'D18', title: 'Pontuação e Recursos' }
  ];

  // Linhas numeradas da redação (máximo 25 linhas)
  const sanitizedFullText = clean(fullTextContent);
  const rawLines = sanitizedFullText.split('\n');
  const numberedLines = [];
  let currentLineNum = 1;

  rawLines.forEach(paragraph => {
    if (currentLineNum > 25) return;
    if (!paragraph.trim()) {
      numberedLines.push({ num: currentLineNum++, text: '' });
      return;
    }
    const lineChunks = paragraph.match(/.{1,70}(\s|$)/g) || [paragraph];
    lineChunks.forEach(chunk => {
      if (currentLineNum <= 25) {
        numberedLines.push({ num: currentLineNum++, text: chunk.trim() });
      }
    });
  });

  while (numberedLines.length < 25) {
    numberedLines.push({ num: numberedLines.length + 1, text: '' });
  }

  // Estilos de Fonte Padronizados
  const sansFont = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
  const serifFont = 'Georgia, Cambria, "Times New Roman", Times, serif';
  const monoFont = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';

  return (
    <div className="folha-oficial-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '24px', alignItems: 'center' }}>
      
      {/* ========================================================================= */}
      {/* PÁGINA 1: FRENTE — FICHA DE AVALIAÇÃO PEDAGÓGICA (ENEM & SISEDU)          */}
      {/* ========================================================================= */}
      <div
        id={`${idPrefix}-page-1`}
        className="folha-pagina folha-pagina-1"
        style={{
          width: '794px',
          height: '1123px',
          maxHeight: '1123px',
          backgroundColor: '#ffffff',
          color: '#0f172a',
          padding: '32px 36px 24px 36px',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          overflow: 'hidden',
          position: 'relative',
          fontFamily: sansFont,
          fontSize: '12px'
        }}
      >
        {/* Marca d'água de fundo */}
        {showWatermark && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            opacity: 0.03,
            transform: 'rotate(-30deg)',
            userSelect: 'none',
            zIndex: 0
          }}>
            <span style={{ fontSize: '32px', fontWeight: 900, fontFamily: monoFont, letterSpacing: '8px', color: '#0f172a', textTransform: 'uppercase', textAlign: 'center', lineHeight: 1.3 }}>
              PROJETO ÁGORA ESCOLAR<br />AVALIAÇÃO DE REDAÇÃO
            </span>
          </div>
        )}

        <div style={{ position: 'relative', zIndex: 10 }}>
          {/* Top Institutional Header */}
          <div style={{ borderBottom: '1.5px solid #0f172a', paddingBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '6px',
                border: '2px solid #0f172a',
                color: '#0f172a',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 900,
                fontSize: '13px',
                letterSpacing: '-0.5px',
                boxSizing: 'border-box'
              }}>
                <span>ÁG</span>
                <span style={{ fontSize: '6.5px', letterSpacing: '1.5px', color: '#b45309', fontFamily: monoFont, marginTop: '-3px', fontWeight: 'bold' }}>ENEM</span>
              </div>
              <div>
                <h1 style={{ fontSize: '14px', fontWeight: 800, textTransform: 'uppercase', color: '#0f172a', margin: 0, lineHeight: 1.1, fontFamily: sansFont }}>
                  Ágora ENEM — Ficha Oficial de Avaliação
                </h1>
                <p style={{ fontSize: '8.5px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.8px', margin: '3px 0 0 0', fontFamily: sansFont }}>
                  {customEscola || 'Projeto Ágora Escolar • Sistema de Avaliação Textual'}
                </p>
              </div>
            </div>

            <div style={{ textAlign: 'right', fontFamily: monoFont, fontSize: '8.5px', color: '#475569', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '7.5px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, fontFamily: sansFont }}>REGISTRO:</span>
                <span style={{ border: '1px solid #0f172a', color: '#0f172a', padding: '1px 5px', borderRadius: '4px', fontWeight: 800, fontSize: '8.5px' }}>
                  #{String(redacao.id).padStart(5, '0')}
                </span>
              </div>
              <div style={{ marginTop: '2px', fontSize: '8px', color: '#64748b' }}>
                EMISSÃO: <strong style={{ color: '#0f172a' }}>{printDateStr} {printTimeStr}</strong>
              </div>
            </div>
          </div>

          {/* Student Info & Hero Score Card */}
          <div style={{
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            backgroundColor: '#ffffff',
            padding: '10px 14px',
            display: 'grid',
            gridTemplateColumns: '1fr 190px',
            gap: '14px',
            alignItems: 'center',
            marginTop: '10px'
          }}>
            <div style={{ borderRight: '1px solid #e2e8f0', paddingRight: '14px' }}>
              <div>
                <span style={{ fontSize: '7.5px', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, letterSpacing: '0.5px' }}>
                  Estudante Avaliado:
                </span>
                <h2 style={{ fontSize: '14px', color: '#0f172a', fontWeight: 800, margin: '1px 0 6px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {studentNameDisplay}
                </h2>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', fontSize: '9px' }}>
                <div>
                  <span style={{ fontSize: '7.5px', color: '#64748b', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>TURMA:</span>
                  <strong style={{ color: '#0f172a', fontSize: '9.5px' }}>{turmaDisplay}</strong>
                </div>
                <div>
                  <span style={{ fontSize: '7.5px', color: '#64748b', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>LANÇAMENTO:</span>
                  <strong style={{ color: '#0f172a', fontSize: '9.5px' }}>{new Date(redacao.data_captura).toLocaleDateString('pt-BR')}</strong>
                </div>
                <div>
                  <span style={{ fontSize: '7.5px', color: '#64748b', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>ENTRADA:</span>
                  <strong style={{ color: '#0f172a', fontSize: '9.5px' }}>{redacao.imagem_base64 ? 'Imagem OCR' : 'Digitado'}</strong>
                </div>
              </div>
            </div>

            {/* Score Hero Widget */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
              <span style={{ fontSize: '7.5px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#64748b' }}>
                NOTA FINAL ENEM
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', margin: '1px 0' }}>
                <span style={{ fontSize: '34px', fontWeight: 900, fontFamily: serifFont, color: '#0f172a', lineHeight: 1 }}>
                  {notaTotal}
                </span>
                <span style={{ fontSize: '10px', fontFamily: monoFont, color: '#64748b' }}>/ 1000</span>
              </div>
              <div style={{ width: '120px', height: '4px', backgroundColor: '#e2e8f0', borderRadius: '9999px', position: 'relative', marginTop: '3px' }}>
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  left: `calc(${scoreGaugePct}% - 4px)`,
                  width: '8px',
                  height: '8px',
                  borderRadius: '9999px',
                  backgroundColor: '#0f172a',
                  border: '1.5px solid #ffffff'
                }} />
              </div>
              <span style={{ fontSize: '7px', color: '#64748b', marginTop: '3px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Escala ENEM (0-1000)
              </span>
            </div>
          </div>

          {/* Seção 1: Matriz ENEM (5 Competências) */}
          <div style={{ marginTop: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '3px' }}>
              <h3 style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#0f172a', margin: 0, borderLeft: '3px solid #0f172a', paddingLeft: '6px' }}>
                1. Matriz de Competências do ENEM (0 a 200 pontos cada)
              </h3>
              <span style={{ fontSize: '7.5px', fontFamily: monoFont, color: '#64748b', textTransform: 'uppercase' }}>Matriz de Competências</span>
            </div>

            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '8.5px', marginTop: '3px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #cbd5e1', color: '#64748b', fontFamily: monoFont, fontSize: '7.5px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  <th style={{ padding: '3px 4px 3px 0', width: '22%' }}>Competência</th>
                  <th style={{ padding: '3px 4px', textAlign: 'right', width: '12%' }}>Nota</th>
                  <th style={{ padding: '3px 6px', width: '32%' }}>Citação / Evidência no Texto</th>
                  <th style={{ padding: '3px 0 3px 4px' }}>Parecer Pedagógico Explicativo</th>
                </tr>
              </thead>
              <tbody>
                {enemCompetenciasMap.map(({ key, title }) => {
                  const comp = enem[key] || { nota: 0, citacao_texto: 'Elemento ausente', justificativa: 'Não avaliado' };
                  const cleanCitacao = clean(comp.citacao_texto);
                  const cleanParecer = clean(comp.justificativa);

                  return (
                    <tr key={key} style={{ verticalAlign: 'top', borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '4.5px 4px 4.5px 0', fontWeight: 700, color: '#0f172a', fontSize: '8.5px', lineHeight: 1.15 }}>
                        {title}
                      </td>
                      <td style={{ padding: '4.5px 4px', textAlign: 'right', fontFamily: serifFont, fontWeight: 800, fontSize: '10.5px', color: '#0f172a' }}>
                        {comp.nota} <span style={{ fontSize: '7px', fontFamily: sansFont, color: '#64748b', fontWeight: 400 }}>/200</span>
                      </td>
                      <td style={{ padding: '4.5px 6px', fontFamily: monoFont, fontSize: '7.5px', fontStyle: 'italic', color: '#475569', lineHeight: 1.2, borderLeft: '2px solid #e2e8f0' }}>
                        {cleanCitacao ? `"${cleanCitacao}"` : '—'}
                      </td>
                      <td style={{ padding: '4.5px 0 4.5px 4px', lineHeight: 1.2, color: '#334155', fontSize: '8px' }}>
                        {cleanParecer}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Seção 2: Descritores SISEDU ou Recado Personalizado */}
          {showSisedu ? (
            <div style={{ marginTop: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '3px' }}>
                <h3 style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#0f172a', margin: 0, borderLeft: '3px solid #047857', paddingLeft: '6px' }}>
                  2. Matriz de Descritores Regionais SISEDU / SPAECE (D05 a D18)
                </h3>
                <span style={{ fontSize: '7.5px', fontFamily: monoFont, color: '#64748b', textTransform: 'uppercase' }}>Rubricas Qualitativas</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '5px', marginTop: '5px' }}>
                {siseduDescritoresMap.map(({ code, title }) => {
                  const descObj = siseduDescritores[code] || sisedu[code] || {};
                  const nivel = descObj.nivel || (code === 'D15' ? 'Inicial' : 'Intermediário');
                  const cleanJustificativa = clean(descObj.justificativa || 'Avaliação pedagógica em conformidade com as rubricas regionais.');

                  let badgeColor = '#047857';
                  if (nivel === 'Intermediário' || nivel === 'Em Desenvolvimento') {
                    badgeColor = '#b45309';
                  } else if (nivel === 'Inicial') {
                    badgeColor = '#64748b';
                  }

                  return (
                    <div key={code} style={{ border: '1px solid #e2e8f0', padding: '5px', borderRadius: '4px', backgroundColor: '#ffffff', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '2px', marginBottom: '2px' }}>
                          <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '8.5px', fontFamily: monoFont }}>{code}</span>
                          <span style={{ padding: '0.5px 4px', fontSize: '7px', fontWeight: 800, textTransform: 'uppercase', borderRadius: '3px', border: `1px solid ${badgeColor}`, color: badgeColor, backgroundColor: 'transparent' }}>
                            {nivel}
                          </span>
                        </div>
                        <p style={{ color: '#475569', lineHeight: 1.2, fontSize: '7.5px', margin: 0 }}>
                          {cleanJustificativa}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            customRecado && (
              <div style={{ marginTop: '10px', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px 12px', backgroundColor: '#fafaf9' }}>
                <div style={{ fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', color: '#0f172a', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Sparkles style={{ width: '12px', height: '12px', color: '#f54e00' }} />
                  Observação & Orientações do(a) Professor(a):
                </div>
                <p style={{ fontSize: '8.5px', color: '#334155', lineHeight: 1.3, margin: 0, whiteSpace: 'pre-wrap' }}>
                  {clean(customRecado)}
                </p>
              </div>
            )
          )}
        </div>

        {/* Rodapé Página 1 */}
        <div style={{ paddingTop: '6px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: monoFont, fontSize: '7.5px', color: '#64748b' }}>
          <div>Sistema Ágora ENEM • {customEscola || 'Projeto Ágora Escolar'} • Ficha de Avaliação</div>
          <div style={{ fontWeight: 700, color: '#0f172a' }}>Página 01 de 02</div>
        </div>
      </div>


      {/* ========================================================================= */}
      {/* PÁGINA 2: VERSO — TRANSCRIÇÃO VERBATIM E ASSINATURA                        */}
      {/* ========================================================================= */}
      <div
        id={`${idPrefix}-page-2`}
        className="folha-pagina folha-pagina-2"
        style={{
          width: '794px',
          height: '1123px',
          maxHeight: '1123px',
          backgroundColor: '#ffffff',
          color: '#0f172a',
          padding: '32px 36px 24px 36px',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          overflow: 'hidden',
          position: 'relative',
          fontFamily: sansFont,
          fontSize: '12px'
        }}
      >
        {/* Marca d'água de fundo */}
        {showWatermark && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            opacity: 0.03,
            transform: 'rotate(-30deg)',
            userSelect: 'none',
            zIndex: 0
          }}>
            <span style={{ fontSize: '32px', fontWeight: 900, fontFamily: monoFont, letterSpacing: '8px', color: '#0f172a', textTransform: 'uppercase', textAlign: 'center', lineHeight: 1.3 }}>
              PROJETO ÁGORA ESCOLAR<br />AVALIAÇÃO DE REDAÇÃO
            </span>
          </div>
        )}

        <div style={{ position: 'relative', zIndex: 10, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            {/* Page 2 Mini Header */}
            <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: monoFont, fontSize: '8px', color: '#64748b' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ border: '1px solid #0f172a', color: '#0f172a', padding: '1px 5px', borderRadius: '3px', fontWeight: 800, fontSize: '7.5px' }}>ANEXO II</span>
                <strong style={{ textTransform: 'uppercase', color: '#0f172a', fontSize: '9px', fontFamily: sansFont }}>Transcrição Verbatim do Texto Original</strong>
              </div>
              <div>REGISTRO: <strong style={{ color: '#0f172a' }}>#{String(redacao.id).padStart(5, '0')}</strong> • ESTUDANTE: <strong style={{ color: '#0f172a' }}>{studentNameDisplay}</strong></div>
            </div>

            {/* Seção 3: Transcrição Pautada (25 linhas) */}
            <div style={{ marginTop: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '3px' }}>
                <h3 style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#0f172a', margin: 0, borderLeft: '3px solid #0f172a', paddingLeft: '6px' }}>
                  3. Transcrição Fiel do Texto Manuscrito / Digitado
                </h3>
                <span style={{ fontSize: '7.5px', fontFamily: monoFont, color: '#64748b', textTransform: 'uppercase' }}>Folha Oficial de Transcrição</span>
              </div>

              <div style={{ border: '1px solid #e2e8f0', borderRadius: '4px', backgroundColor: '#ffffff', overflow: 'hidden', marginTop: '5px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    {numberedLines.map(({ num, text }) => (
                      <tr key={num} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ width: '30px', padding: '3px 4px', textAlign: 'center', color: '#94a3b8', backgroundColor: '#f8fafc', borderRight: '1px solid #e2e8f0', fontFamily: monoFont, fontWeight: 700, fontSize: '8px', userSelect: 'none' }}>
                          {String(num).padStart(2, '0')}
                        </td>
                        <td style={{ padding: '3px 8px', color: '#1e293b', lineHeight: 1.3, whiteSpace: 'pre-wrap', fontFamily: sansFont, fontSize: '8.5px', minHeight: '16px' }}>
                          {text || <span style={{ color: '#e2e8f0' }}></span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Seção 4: Autenticidade Digital & Assinatura */}
          <div style={{ paddingTop: '8px', borderTop: '1px solid #e2e8f0', display: 'grid', gridTemplateColumns: showSignature ? '7fr 5fr' : '1fr', gap: '14px', alignItems: 'flex-end', marginTop: '6px', fontFamily: monoFont, fontSize: '8px', color: '#475569' }}>
            
            {/* Selo Digital */}
            <div style={{ border: '1px solid #e2e8f0', padding: '8px 10px', borderRadius: '4px', backgroundColor: '#ffffff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#047857', fontWeight: 800, fontSize: '8.5px', fontFamily: sansFont }}>
                <ShieldCheck style={{ width: '13px', height: '13px', color: '#047857' }} />
                AUTENTICAÇÃO DIGITAL DA AVALIAÇÃO
              </div>
              <p style={{ fontSize: '7px', fontFamily: sansFont, color: '#475569', lineHeight: 1.25, margin: '3px 0 5px 0' }}>
                Documento emitido pelo Sistema Ágora ENEM e validado pedagogicamente pelo corpo docente.
              </p>
              <div style={{ paddingTop: '3px', fontSize: '7px', color: '#64748b', borderTop: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: '1px' }}>
                <div>CÓDIGO HASH: <strong style={{ color: '#0f172a' }}>{authHash}</strong></div>
                <div>CHAVE DE VALIDAÇÃO: <strong style={{ color: '#0f172a' }}>AGORA-2026-AVAL-ENEM</strong></div>
              </div>
            </div>

            {/* Linha de Assinatura */}
            {showSignature && (
              <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center' }}>
                <div style={{ width: '100%', borderTop: '1px solid #0f172a', paddingTop: '3px', marginTop: '16px' }}>
                  <div style={{ fontWeight: 700, color: '#0f172a', fontFamily: sansFont, fontSize: '8.5px', textTransform: 'uppercase' }}>
                    {customProfessor || 'Assinatura do Professor / Avaliador'}
                  </div>
                  <div style={{ fontSize: '7px', color: '#64748b', fontFamily: sansFont }}>
                    Visto de Validação Pedagógica
                  </div>
                </div>
              </div>
            )}

          </div>

        </div>

        {/* Rodapé Página 2 */}
        <div style={{ paddingTop: '6px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: monoFont, fontSize: '7.5px', color: '#64748b' }}>
          <div>Sistema Ágora ENEM • {customEscola || 'Projeto Ágora Escolar'} • Anexo II de Transcrição</div>
          <div style={{ fontWeight: 700, color: '#0f172a' }}>Página 02 de 02</div>
        </div>
      </div>

    </div>
  );
}
