import React from 'react';

/**
 * Componente da Folha Oficial de Avaliação e Redação (Documento Oficial Projeto Ágora Escolar).
 * Design fiel ao modelo institucional e econômico de impressão (Boletim_Redacao_Dovy_ID49.pdf).
 * Fontes e métricas calibradas especificamente para renderização nítida sem deslocamento de baseline no html2canvas/jsPDF.
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

  // Fontes padrão que possuem métricas de renderização 100% precisas no html2canvas
  const sansFont = 'Arial, "Helvetica Neue", Helvetica, sans-serif';
  const monoFont = '"Courier New", Courier, monospace';

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
          minHeight: '1123px',
          maxHeight: '1123px',
          backgroundColor: '#ffffff',
          color: '#000000',
          padding: '24px 28px',
          boxSizing: 'border-box',
          overflow: 'hidden',
          position: 'relative',
          fontFamily: sansFont,
          fontSize: '11px',
          lineHeight: '1.35'
        }}
      >
        {/* Moldura Externa */}
        <div style={{
          border: '1.5px solid #000000',
          borderRadius: '8px',
          padding: '18px 22px',
          height: '100%',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>

          {/* 1. Header Institucional */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1.5px solid #000000', paddingBottom: '8px' }}>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 'bold', textTransform: 'uppercase', color: '#000000', fontFamily: monoFont, lineHeight: '1.3' }}>
                ÁGORA ENEM — FICHA DE AVALIAÇÃO DE REDAÇÃO
              </div>
              <div style={{ fontSize: '8.5px', fontWeight: 'bold', color: '#333333', textTransform: 'uppercase', margin: '3px 0 0 0', fontFamily: monoFont, lineHeight: '1.3' }}>
                {customEscola || 'PROJETO ÁGORA ESCOLAR • SISTEMA PREDITIVO DE AVALIAÇÃO TEXTUAL (ENEM X SISEDU)'}
              </div>
            </div>

            <div style={{ textAlign: 'right', fontFamily: monoFont, fontSize: '8.5px', color: '#222222', borderLeft: '1px solid #d1d5db', paddingLeft: '12px', lineHeight: '1.3' }}>
              <div>REGISTRO: <strong style={{ color: '#000000' }}>#{String(redacao.id).padStart(5, '0')}</strong></div>
              <div>EMISSÃO: <strong style={{ color: '#000000' }}>{printDateStr} {printTimeStr}</strong></div>
            </div>
          </div>

          {/* 2. Card Estudante & Nota Final */}
          <div style={{
            border: '1px solid #000000',
            borderRadius: '6px',
            backgroundColor: '#ffffff',
            padding: '12px 18px',
            display: 'grid',
            gridTemplateColumns: '1fr 180px',
            gap: '16px',
            alignItems: 'center',
            boxSizing: 'border-box'
          }}>
            <div>
              <div style={{ fontSize: '8.5px', textTransform: 'uppercase', color: '#4b5563', fontFamily: monoFont, fontWeight: 'bold', lineHeight: '1.3' }}>
                ESTUDANTE:
              </div>
              <div style={{ fontSize: '18px', color: '#000000', fontWeight: 'bold', margin: '3px 0 8px 0', lineHeight: '1.25' }}>
                {studentNameDisplay}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', fontSize: '9px', fontFamily: monoFont, lineHeight: '1.3' }}>
                <div>
                  <span style={{ fontSize: '8px', color: '#4b5563', display: 'block' }}>Turma:</span>
                  <strong style={{ color: '#000000', fontSize: '10px' }}>{turmaDisplay}</strong>
                </div>
                <div>
                  <span style={{ fontSize: '8px', color: '#4b5563', display: 'block' }}>Data Lançamento:</span>
                  <strong style={{ color: '#000000', fontSize: '10px' }}>{dataLancamentoStr}</strong>
                </div>
                <div>
                  <span style={{ fontSize: '8px', color: '#4b5563', display: 'block' }}>Entrada:</span>
                  <strong style={{ color: '#000000', fontSize: '10px' }}>{redacao.imagem_base64 ? 'Imagem OCR' : 'Texto Digitado'}</strong>
                </div>
              </div>
            </div>

            {/* Score Hero Widget */}
            <div style={{ borderLeft: '1px solid #000000', paddingLeft: '16px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontSize: '8.5px', fontWeight: 'bold', textTransform: 'uppercase', color: '#374151', fontFamily: monoFont, lineHeight: '1.3' }}>
                NOTA FINAL ENEM
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '4px', margin: '3px 0' }}>
                <span style={{ fontSize: '34px', fontWeight: 'bold', fontFamily: monoFont, color: '#000000', lineHeight: '1.1' }}>
                  {notaTotal}
                </span>
                <span style={{ fontSize: '12px', fontFamily: monoFont, color: '#4b5563', lineHeight: '1.1' }}>/ 1000</span>
              </div>
              <div style={{ fontSize: '8px', color: '#6b7280', textTransform: 'uppercase', fontFamily: monoFont, lineHeight: '1.3' }}>
                Escala ENEM (0-1000)
              </div>
            </div>
          </div>

          {/* 3. Seção 1: Matriz ENEM (5 Competências) */}
          <div>
            <div style={{ borderBottom: '1.5px solid #000000', paddingBottom: '4px', marginBottom: '8px' }}>
              <div style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', color: '#000000', fontFamily: monoFont, lineHeight: '1.3' }}>
                1. MATRIZ DE COMPETÊNCIAS DO ENEM (0 A 200 PONTOS CADA)
              </div>
            </div>

            {/* Grid de Competências */}
            <div style={{ width: '100%', border: '1px solid #000000', borderRadius: '4px', overflow: 'hidden', backgroundColor: '#ffffff', boxSizing: 'border-box' }}>
              {/* Header */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '22% 9% 34% 35%',
                backgroundColor: '#f8fafc',
                borderBottom: '1px solid #000000',
                fontFamily: monoFont,
                fontSize: '8.5px',
                textTransform: 'uppercase',
                fontWeight: 'bold'
              }}>
                <div style={{ padding: '8px 10px', borderRight: '1px solid #000000' }}>COMPETÊNCIA</div>
                <div style={{ padding: '8px 4px', textAlign: 'center', borderRight: '1px solid #000000' }}>NOTA</div>
                <div style={{ padding: '8px 10px', borderRight: '1px solid #000000' }}>CITAÇÃO DIRETA DO TEXTO</div>
                <div style={{ padding: '8px 10px' }}>PARECER PEDAGÓGICO</div>
              </div>

              {/* Rows */}
              {enemCompetenciasMap.map(({ key, title }, idx) => {
                const comp = enem[key] || { nota: 0, citacao_texto: '', justificativa: 'Não avaliado' };
                const cleanCitacao = clean(comp.citacao_texto);
                const cleanParecer = clean(comp.justificativa);
                const isLast = idx === enemCompetenciasMap.length - 1;

                return (
                  <div
                    key={key}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '22% 9% 34% 35%',
                      borderBottom: isLast ? 'none' : '1px solid #000000',
                      alignItems: 'stretch',
                      boxSizing: 'border-box'
                    }}
                  >
                    <div style={{
                      padding: '9px 10px',
                      fontWeight: 'bold',
                      color: '#000000',
                      fontSize: '9.5px',
                      lineHeight: '1.4',
                      borderRight: '1px solid #000000',
                      display: 'flex',
                      alignItems: 'flex-start'
                    }}>
                      {title}
                    </div>

                    <div style={{
                      padding: '9px 4px',
                      textAlign: 'center',
                      fontFamily: monoFont,
                      fontWeight: 'bold',
                      fontSize: '14px',
                      color: '#000000',
                      borderRight: '1px solid #000000',
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'center'
                    }}>
                      {comp.nota}
                    </div>

                    <div style={{
                      padding: '9px 10px',
                      fontFamily: sansFont,
                      fontSize: '8.5px',
                      fontStyle: 'italic',
                      color: '#1f2937',
                      lineHeight: '1.45',
                      borderRight: '1px solid #000000'
                    }}>
                      {cleanCitacao ? `"${cleanCitacao}"` : '—'}
                    </div>

                    <div style={{
                      padding: '9px 10px',
                      lineHeight: '1.45',
                      color: '#1f2937',
                      fontSize: '8.5px'
                    }}>
                      {cleanParecer}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 4. Seção 2: Rubricas Qualitativas Sisedu */}
          <div>
            <div style={{ borderBottom: '1.5px solid #000000', paddingBottom: '4px', marginBottom: '8px' }}>
              <div style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', color: '#000000', fontFamily: monoFont, lineHeight: '1.3' }}>
                2. RUBRICAS QUALITATIVAS SISEDU (PROJETO ÁGORA ESCOLAR)
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {/* Dimensão Discursiva */}
              <div style={{ border: '1px solid #000000', borderRadius: '6px', padding: '12px 14px', backgroundColor: '#ffffff', boxSizing: 'border-box' }}>
                <div style={{ fontSize: '9.5px', fontWeight: 'bold', fontFamily: monoFont, textTransform: 'uppercase', color: '#000000', borderBottom: '1px solid #e5e7eb', paddingBottom: '4px', marginBottom: '8px', lineHeight: '1.3' }}>
                  DIMENSÃO DISCURSIVA
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {rubricasDiscursiva.map((item, idx) => (
                    <div key={idx} style={{ fontSize: '8.5px', lineHeight: '1.35' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ color: '#000000', fontSize: '9px' }}>{item.title}</strong>
                        <span style={{ fontFamily: monoFont, fontWeight: 'bold', fontSize: '9px', color: '#000000', textDecoration: 'underline' }}>
                          {item.nivel}
                        </span>
                      </div>
                      <div style={{ color: '#374151', lineHeight: '1.35', margin: '3px 0 0 0', fontSize: '8px' }}>
                        {item.desc}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Dimensão Ético-Moral */}
              <div style={{ border: '1px solid #000000', borderRadius: '6px', padding: '12px 14px', backgroundColor: '#ffffff', boxSizing: 'border-box' }}>
                <div style={{ fontSize: '9.5px', fontWeight: 'bold', fontFamily: monoFont, textTransform: 'uppercase', color: '#000000', borderBottom: '1px solid #e5e7eb', paddingBottom: '4px', marginBottom: '8px', lineHeight: '1.3' }}>
                  DIMENSÃO ÉTICO-MORAL
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {rubricasEticoMoral.map((item, idx) => (
                    <div key={idx} style={{ fontSize: '8.5px', lineHeight: '1.35' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ color: '#000000', fontSize: '9px' }}>{item.title}</strong>
                        <span style={{ fontFamily: monoFont, fontWeight: 'bold', fontSize: '9px', color: '#000000', textDecoration: 'underline' }}>
                          {item.nivel}
                        </span>
                      </div>
                      <div style={{ color: '#374151', lineHeight: '1.35', margin: '3px 0 0 0', fontSize: '8px' }}>
                        {item.desc}
                      </div>
                    </div>
                  ))}
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
          minHeight: '1123px',
          maxHeight: '1123px',
          backgroundColor: '#ffffff',
          color: '#000000',
          padding: '24px 28px',
          boxSizing: 'border-box',
          overflow: 'hidden',
          position: 'relative',
          fontFamily: sansFont,
          fontSize: '11px',
          lineHeight: '1.35'
        }}
      >
        {/* Moldura Externa */}
        <div style={{
          border: '1.5px solid #000000',
          borderRadius: '8px',
          padding: '18px 22px',
          height: '100%',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {/* Top Mini Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1.5px solid #000000', paddingBottom: '6px', marginBottom: '10px', fontFamily: monoFont, fontSize: '8.5px', lineHeight: '1.3' }}>
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
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <div style={{ borderBottom: '1.5px solid #000000', paddingBottom: '4px', marginBottom: '8px' }}>
                <div style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', color: '#000000', fontFamily: monoFont, lineHeight: '1.3' }}>
                  3. TRANSCRIÇÃO INTEGRAL DO TEXTO DA REDAÇÃO (VERBATIM)
                </div>
              </div>

              {/* Caixa de Transcrição Integral */}
              <div style={{
                border: '1px solid #000000',
                borderRadius: '6px',
                padding: '18px 22px',
                backgroundColor: '#ffffff',
                fontFamily: monoFont,
                fontSize: '10px',
                lineHeight: '1.7',
                color: '#111111',
                whiteSpace: 'pre-wrap',
                flex: 1,
                overflow: 'hidden',
                boxSizing: 'border-box'
              }}>
                {sanitizedFullText}
              </div>
            </div>
          </div>

          {/* Rodapé e Linha de Assinatura */}
          <div style={{ borderTop: '1.5px solid #000000', paddingTop: '10px', marginTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div style={{ fontFamily: monoFont, fontSize: '8.5px', color: '#374151', lineHeight: '1.35' }}>
              <div>Documento gerado pelo Sistema Ágora ENEM em {printDateStr}.</div>
              <div>Validação Pedagógica Automática via Inteligência Artificial.</div>
            </div>

            {showSignature && (
              <div style={{ textAlign: 'center', width: '260px' }}>
                <div style={{ borderTop: '1.5px solid #000000', paddingTop: '4px' }}>
                  <div style={{ fontWeight: 'bold', color: '#000000', fontFamily: sansFont, fontSize: '10px', lineHeight: '1.3' }}>
                    {customProfessor || 'Assinatura do Professor / Avaliador'}
                  </div>
                  <div style={{ fontSize: '8px', color: '#6b7280', fontFamily: sansFont, lineHeight: '1.2' }}>
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
