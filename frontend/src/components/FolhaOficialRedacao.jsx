import React from 'react';

/**
 * Componente da Folha Oficial de Avaliação e Redação (Documento Oficial Projeto Ágora Escolar).
 * Design fiel ao modelo institucional e econômico de impressão (Boletim_Redacao_Dovy_ID49.pdf).
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
  customProfessor = 'Assinatura do Professor / Avaliador',
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

  const studentNameDisplay = clean(manualName || redacao.nome_aluno || data.aluno || 'Estudante Não Identificado');
  const turmaDisplay = clean(manualTurma || redacao.turma_aluno || data.turma || 'Geral');
  const notaTotal = Number(notaEnemCalculada ?? redacao.nota_final ?? 0);

  const printDateStr = new Date().toLocaleDateString('pt-BR');
  const printTimeStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const dataLancamentoStr = redacao.data_captura 
    ? new Date(redacao.data_captura).toLocaleDateString('pt-BR') 
    : printDateStr;

  const enemCompetenciasMap = [
    { key: 'competencia_1', title: 'Competência 1 - Norma Culta' },
    { key: 'competencia_2', title: 'Competência 2 - Tema e Repertório' },
    { key: 'competencia_3', title: 'Competência 3 - Argumentação' },
    { key: 'competencia_4', title: 'Competência 4 - Coesão e Coerência' },
    { key: 'competencia_5', title: 'Competência 5 - Proposta de Intervenção' }
  ];

  // Rubricas Qualitativas Sisedu (Dimensão Discursiva e Dimensão Ético-Moral)
  const rubricasDiscursiva = [
    {
      title: 'Clareza da Tese:',
      nivel: siseduDescritores['D06']?.nivel || siseduDescritores['D13']?.nivel || (notaTotal >= 800 ? 'Avançado' : 'Adequado'),
      desc: clean(siseduDescritores['D06']?.justificativa || siseduDescritores['D13']?.justificativa || 'A tese é claramente delimitada no final do primeiro parágrafo, antecipando os dois argumentos que estruturam o texto.')
    },
    {
      title: 'Argumentação:',
      nivel: siseduDescritores['D16']?.nivel || siseduDescritores['D14']?.nivel || (enem.competencia_3?.nota >= 160 ? 'Avançado' : 'Adequado'),
      desc: clean(siseduDescritores['D16']?.justificativa || enem.competencia_3?.justificativa || 'Os argumentos são consistentes, articulados e sustentados por uma lógica interna clara que relaciona a teoria à realidade social.')
    },
    {
      title: 'Repertório:',
      nivel: siseduDescritores['D05']?.nivel || (enem.competencia_2?.nota >= 160 ? 'Avançado' : 'Adequado'),
      desc: clean(siseduDescritores['D05']?.justificativa || enem.competencia_2?.justificativa || 'Utiliza referências externas de alta relevância de maneira produtiva e integrada ao raciocínio.')
    }
  ];

  const rubricasEticoMoral = [
    {
      title: 'Empatia e Alteridade:',
      nivel: siseduDescritores['D15']?.nivel || (enem.competencia_5?.nota >= 160 ? 'Adequado' : 'Inicial'),
      desc: clean(siseduDescritores['D15']?.justificativa || '—')
    },
    {
      title: 'Justificação Moral:',
      nivel: siseduDescritores['D18']?.nivel || (enem.competencia_5?.nota >= 160 ? 'Adequado' : 'Inicial'),
      desc: clean(siseduDescritores['D18']?.justificativa || '—')
    },
    {
      title: 'Conclusão Crítica / Propostas:',
      nivel: (enem.competencia_5?.nota >= 160 ? 'Adequado' : enem.competencia_5?.nota >= 120 ? 'Intermediário' : 'Inicial'),
      desc: clean(enem.competencia_5?.justificativa || '—')
    }
  ];

  const sanitizedFullText = clean(fullTextContent || data.texto_transcrito || redacao.texto_digitado || 'Texto da redação indisponível.');

  const sansFont = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
  const monoFont = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';

  return (
    <div className="folha-oficial-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '24px', alignItems: 'center' }}>
      
      {/* ========================================================================= */}
      {/* PÁGINA 1: FICHA DE AVALIAÇÃO DE REDAÇÃO (ENEM & SISEDU)                    */}
      {/* ========================================================================= */}
      <div
        id={`${idPrefix}-page-1`}
        className="folha-pagina folha-pagina-1"
        style={{
          width: '794px',
          height: '1123px',
          maxHeight: '1123px',
          backgroundColor: '#ffffff',
          color: '#000000',
          padding: '24px 28px',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          overflow: 'hidden',
          position: 'relative',
          fontFamily: sansFont,
          fontSize: '11px'
        }}
      >
        {/* Borda Externa Arredondada Fiel ao Modelo */}
        <div style={{
          border: '1.5px solid #000000',
          borderRadius: '8px',
          padding: '20px 22px',
          height: '100%',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          
          <div>
            {/* Top Institutional Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1.5px solid #000000', paddingBottom: '8px' }}>
              <div>
                <h1 style={{ fontSize: '15px', fontWeight: 700, textTransform: 'uppercase', color: '#000000', margin: 0, fontFamily: monoFont, letterSpacing: '0.5px' }}>
                  ÁGORA ENEM — FICHA DE AVALIAÇÃO DE REDAÇÃO
                </h1>
                <p style={{ fontSize: '8px', fontWeight: 600, color: '#333333', textTransform: 'uppercase', letterSpacing: '0.6px', margin: '3px 0 0 0', fontFamily: monoFont }}>
                  {customEscola || 'PROJETO ÁGORA ESCOLAR • SISTEMA PREDITIVO DE AVALIAÇÃO TEXTUAL (ENEM X SISEDU)'}
                </p>
              </div>

              <div style={{ textAlign: 'right', fontFamily: monoFont, fontSize: '8.5px', color: '#222222', borderLeft: '1px solid #d1d5db', paddingLeft: '12px', lineHeight: 1.3 }}>
                <div>REGISTRO: <strong style={{ color: '#000000' }}>#{String(redacao.id).padStart(5, '0')}</strong></div>
                <div>EMISSÃO: <strong style={{ color: '#000000' }}>{printDateStr} {printTimeStr}</strong></div>
              </div>
            </div>

            {/* Student Info & Score Box */}
            <div style={{
              border: '1px solid #000000',
              borderRadius: '6px',
              backgroundColor: '#ffffff',
              padding: '10px 16px',
              display: 'grid',
              gridTemplateColumns: '1fr 180px',
              gap: '16px',
              alignItems: 'center',
              marginTop: '12px'
            }}>
              <div>
                <span style={{ fontSize: '8px', textTransform: 'uppercase', color: '#4b5563', fontFamily: monoFont, fontWeight: 600, display: 'block' }}>
                  ESTUDANTE:
                </span>
                <h2 style={{ fontSize: '17px', color: '#000000', fontWeight: 700, margin: '2px 0 8px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {studentNameDisplay}
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', fontSize: '9px', fontFamily: monoFont }}>
                  <div>
                    <span style={{ fontSize: '7.5px', color: '#4b5563', display: 'block' }}>Turma:</span>
                    <strong style={{ color: '#000000', fontSize: '9.5px' }}>{turmaDisplay}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '7.5px', color: '#4b5563', display: 'block' }}>Data Lançamento:</span>
                    <strong style={{ color: '#000000', fontSize: '9.5px' }}>{dataLancamentoStr}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '7.5px', color: '#4b5563', display: 'block' }}>Entrada:</span>
                    <strong style={{ color: '#000000', fontSize: '9.5px' }}>{redacao.imagem_base64 ? 'Imagem OCR' : 'Texto Digitado'}</strong>
                  </div>
                </div>
              </div>

              {/* Score Hero Widget */}
              <div style={{ borderLeft: '1px solid #000000', paddingLeft: '16px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#374151', fontFamily: monoFont }}>
                  NOTA FINAL ENEM
                </span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '3px', margin: '2px 0' }}>
                  <span style={{ fontSize: '32px', fontWeight: 800, fontFamily: monoFont, color: '#000000', lineHeight: 1 }}>
                    {notaTotal}
                  </span>
                  <span style={{ fontSize: '11px', fontFamily: monoFont, color: '#4b5563' }}>/ 1000</span>
                </div>
                <span style={{ fontSize: '7.5px', color: '#6b7280', textTransform: 'uppercase', fontFamily: monoFont, letterSpacing: '0.4px' }}>
                  Escala ENEM (0-1000)
                </span>
              </div>
            </div>

            {/* Seção 1: Matriz ENEM (5 Competências) */}
            <div style={{ marginTop: '12px' }}>
              <div style={{ borderBottom: '1.5px solid #000000', paddingBottom: '3px', marginBottom: '6px' }}>
                <h3 style={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#000000', margin: 0, fontFamily: monoFont }}>
                  1. MATRIZ DE COMPETÊNCIAS DO ENEM (0 A 200 PONTOS CADA)
                </h3>
              </div>

              <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', border: '1px solid #000000', fontSize: '8.5px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #000000', fontFamily: monoFont, fontSize: '8px', textTransform: 'uppercase', fontWeight: 700 }}>
                    <th style={{ padding: '5px 6px', width: '22%', borderRight: '1px solid #000000' }}>COMPETÊNCIA</th>
                    <th style={{ padding: '5px 4px', textAlign: 'center', width: '9%', borderRight: '1px solid #000000' }}>NOTA</th>
                    <th style={{ padding: '5px 6px', width: '34%', borderRight: '1px solid #000000' }}>CITAÇÃO DIRETA DO TEXTO</th>
                    <th style={{ padding: '5px 6px', width: '35%' }}>PARECER PEDAGÓGICO</th>
                  </tr>
                </thead>
                <tbody>
                  {enemCompetenciasMap.map(({ key, title }) => {
                    const comp = enem[key] || { nota: 0, citacao_texto: '', justificativa: 'Não avaliado' };
                    const cleanCitacao = clean(comp.citacao_texto);
                    const cleanParecer = clean(comp.justificativa);

                    return (
                      <tr key={key} style={{ verticalAlign: 'top', borderBottom: '1px solid #000000' }}>
                        <td style={{ padding: '5px 6px', fontWeight: 700, color: '#000000', fontSize: '9px', lineHeight: 1.2, borderRight: '1px solid #000000' }}>
                          {title}
                        </td>
                        <td style={{ padding: '5px 4px', textAlign: 'center', fontFamily: monoFont, fontWeight: 700, fontSize: '12px', color: '#000000', borderRight: '1px solid #000000' }}>
                          {comp.nota}
                        </td>
                        <td style={{ padding: '5px 6px', fontFamily: monoFont, fontSize: '8px', fontStyle: 'italic', color: '#1f2937', lineHeight: 1.25, borderRight: '1px solid #000000' }}>
                          {cleanCitacao ? `"${cleanCitacao}"` : '—'}
                        </td>
                        <td style={{ padding: '5px 6px', lineHeight: 1.25, color: '#1f2937', fontSize: '8px' }}>
                          {cleanParecer}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Seção 2: Rubricas Qualitativas Sisedu (Projeto Ágora Escolar) */}
            <div style={{ marginTop: '12px' }}>
              <div style={{ borderBottom: '1.5px solid #000000', paddingBottom: '3px', marginBottom: '8px' }}>
                <h3 style={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#000000', margin: 0, fontFamily: monoFont }}>
                  2. RUBRICAS QUALITATIVAS SISEDU (PROJETO ÁGORA ESCOLAR)
                </h3>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {/* Box Dimensão Discursiva */}
                <div style={{ border: '1px solid #000000', borderRadius: '6px', padding: '8px 12px', backgroundColor: '#ffffff' }}>
                  <div style={{ fontSize: '9px', fontWeight: 700, fontFamily: monoFont, textTransform: 'uppercase', color: '#000000', borderBottom: '1px solid #e5e7eb', paddingBottom: '3px', marginBottom: '6px' }}>
                    DIMENSÃO DISCURSIVA
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {rubricasDiscursiva.map((item, idx) => (
                      <div key={idx} style={{ fontSize: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong style={{ color: '#000000', fontSize: '8.5px' }}>{item.title}</strong>
                          <span style={{ fontFamily: monoFont, fontWeight: 700, fontSize: '8.5px', color: '#000000', textDecoration: 'underline' }}>
                            {item.nivel}
                          </span>
                        </div>
                        <p style={{ color: '#374151', lineHeight: 1.2, margin: '2px 0 0 0', fontSize: '7.5px' }}>
                          {item.desc}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Box Dimensão Ético-Moral */}
                <div style={{ border: '1px solid #000000', borderRadius: '6px', padding: '8px 12px', backgroundColor: '#ffffff' }}>
                  <div style={{ fontSize: '9px', fontWeight: 700, fontFamily: monoFont, textTransform: 'uppercase', color: '#000000', borderBottom: '1px solid #e5e7eb', paddingBottom: '3px', marginBottom: '6px' }}>
                    DIMENSÃO ÉTICO-MORAL
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {rubricasEticoMoral.map((item, idx) => (
                      <div key={idx} style={{ fontSize: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong style={{ color: '#000000', fontSize: '8.5px' }}>{item.title}</strong>
                          <span style={{ fontFamily: monoFont, fontWeight: 700, fontSize: '8.5px', color: '#000000', textDecoration: 'underline' }}>
                            {item.nivel}
                          </span>
                        </div>
                        <p style={{ color: '#374151', lineHeight: 1.2, margin: '2px 0 0 0', fontSize: '7.5px' }}>
                          {item.desc}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

          </div>

        </div>
      </div>


      {/* ========================================================================= */}
      {/* PÁGINA 2: TRANSCRIÇÃO INTEGRAL (VERBATIM) E ASSINATURA                      */}
      {/* ========================================================================= */}
      <div
        id={`${idPrefix}-page-2`}
        className="folha-pagina folha-pagina-2"
        style={{
          width: '794px',
          height: '1123px',
          maxHeight: '1123px',
          backgroundColor: '#ffffff',
          color: '#000000',
          padding: '24px 28px',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          overflow: 'hidden',
          position: 'relative',
          fontFamily: sansFont,
          fontSize: '11px'
        }}
      >
        {/* Borda Externa Arredondada Fiel ao Modelo */}
        <div style={{
          border: '1.5px solid #000000',
          borderRadius: '8px',
          padding: '20px 22px',
          height: '100%',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          
          <div>
            {/* Top Mini Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1.5px solid #000000', paddingBottom: '6px', marginBottom: '12px', fontFamily: monoFont, fontSize: '8.5px' }}>
              <div>
                <strong style={{ textTransform: 'uppercase', color: '#000000' }}>
                  ANEXO II: TRANSCRIÇÃO INTEGRAL & VALIDAÇÃO
                </strong>
                <span style={{ color: '#4b5563' }}> — REGISTRO #{String(redacao.id).padStart(5, '0')}</span>
              </div>
              <div>
                <span style={{ color: '#4b5563' }}>Estudante: </span>
                <strong style={{ color: '#000000' }}>{studentNameDisplay}</strong>
              </div>
            </div>

            {/* Seção 3: Transcrição Integral do Texto */}
            <div>
              <div style={{ borderBottom: '1.5px solid #000000', paddingBottom: '3px', marginBottom: '10px' }}>
                <h3 style={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#000000', margin: 0, fontFamily: monoFont }}>
                  3. TRANSCRIÇÃO INTEGRAL DO TEXTO DA REDAÇÃO (VERBATIM)
                </h3>
              </div>

              {/* Caixa de Transcrição Integral */}
              <div style={{
                border: '1px solid #000000',
                borderRadius: '6px',
                padding: '16px 20px',
                backgroundColor: '#ffffff',
                fontFamily: monoFont,
                fontSize: '9.5px',
                lineHeight: 1.55,
                color: '#111111',
                whiteSpace: 'pre-wrap',
                minHeight: '520px',
                boxSizing: 'border-box'
              }}>
                {sanitizedFullText}
              </div>
            </div>
          </div>

          {/* Rodapé e Linha de Assinatura */}
          <div style={{ borderTop: '1.5px solid #000000', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div style={{ fontFamily: monoFont, fontSize: '8.5px', color: '#374151', lineHeight: 1.4 }}>
              <div>Documento gerado pelo Sistema Ágora ENEM em {printDateStr}.</div>
              <div>Validação Pedagógica Automática via Inteligência Artificial.</div>
            </div>

            {showSignature && (
              <div style={{ textAlign: 'center', width: '270px' }}>
                <div style={{ borderTop: '1.5px solid #000000', paddingTop: '4px' }}>
                  <div style={{ fontWeight: 700, color: '#000000', fontFamily: sansFont, fontSize: '10px' }}>
                    {customProfessor || 'Assinatura do Professor / Avaliador'}
                  </div>
                  <div style={{ fontSize: '8px', color: '#6b7280', fontFamily: sansFont }}>
                    Visto de Validação Pedagógica
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

    </div>
  );
}
