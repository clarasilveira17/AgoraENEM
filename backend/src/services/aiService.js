import { GoogleGenerativeAI } from '@google/generative-ai';
import { generateContentWithFallback } from '../config/gemini.js';

/**
 * Helper to safely clean and parse JSON responses from AI models
 */
export function cleanAndParseJSON(rawText) {
  let cleaned = rawText.trim();

  // Remove markdown codeblock wrappers if present
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  // Extract JSON object if surrounded by extra commentary
  const startIdx = cleaned.indexOf('{');
  const endIdx = cleaned.lastIndexOf('}');
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    cleaned = cleaned.substring(startIdx, endIdx + 1);
  }

  try {
    return JSON.parse(cleaned);
  } catch (firstErr) {
    console.warn(`[JSON Parser] Tentativa 1 de parse falhou (${firstErr.message}). Sanitizando JSON...`);

    let sanitized = cleaned
      // Escape raw unescaped control characters
      .replace(/[\u0000-\u0009\u000B\u000C\u000E-\u001F]/g, '')
      // Remove trailing commas before closing braces/brackets
      .replace(/,\s*([}\]])/g, '$1')
      // Fix invalid backslash escapes (e.g., \x, \a)
      .replace(/\\([^"\\\/bfnrtu])/g, '$1')
      .replace(/\\'/g, "'");

    try {
      return JSON.parse(sanitized);
    } catch (secondErr) {
      console.warn(`[JSON Parser] Tentativa 2 de parse falhou (${secondErr.message}). Sanitizando aspas e caracteres remanescentes...`);

      try {
        const ultraSanitized = sanitized
          .replace(/[\u007F-\u009F]/g, '');
        return JSON.parse(ultraSanitized);
      } catch (thirdErr) {
        console.error(`[JSON Parser] ❌ Falha crítica no parsing do JSON: ${thirdErr.message}`);
        throw thirdErr;
      }
    }
  }
}

/**
 * AGENTE ÚNICO UNIFICADO: Transcrição OCR + Banca Avaliadora Pedagógica (ENEM x SISEDU D05-D18)
 */
export async function agenteAvaliadorUnificado(imagemBase64, textoDigitado, nomeFornecido, turmaFornecida, apiKey) {
  const genAI = new GoogleGenerativeAI(apiKey);

  const systemInstruction = `Você é um perito em transcrição paleográfica e um avaliador educacional sênior especialista na Matriz do ENEM e Descritores do SISEDU/SPAECE (Projeto Ágora Escolar - SEDUC CE).

SUA MISSÃO EM 1 ÚNICA EXECUÇÃO:
1. **TRANSCRIÇÃO 100% INTEGRAL ("texto_transcrito"):** Se uma imagem de redação manuscrita for fornecida, transcreva 100% do texto palavra por palavra, preservando a estrutura de parágrafos. NUNCA resuma, NUNCA omita frases e NUNCA use reticências (...) para abreviar. Se for texto digitado, preserve-o integralmente no campo "texto_transcrito".
2. **IDENTIFICAÇÃO SINCERA DO ALUNO ("confianca_identificacao" e "motivo_incerteza_identificacao"):** Se o nome do aluno ou turma não forem fornecidos, tente identificá-los no cabeçalho/margem da folha. Seja 100% SINCERO quanto à certeza da leitura:
   - "ALTA": Nome completo e legível com clareza cristalina sem qualquer dúvida.
   - "MEDIA": Caligrafia difícil, nome abreviado, primeiro nome apenas ou letra duvidosa.
   - "BAIXA": Nome ilegível, rasurado, cortado ou ausente na folha.
   Forneça a justificativa sincera no campo "motivo_incerteza_identificacao".
3. **MATRIZ ENEM (Notas de 0 a 200 em múltiplos de 40: 0, 40, 80, 120, 160, 200 por competência):**
   - Competência 1: Domínio da modalidade escrita formal.
   - Competência 2: Compreensão do tema e aplicação de repertório sociocultural.
   - Competência 3: Seleção, relação, organização e interpretação de informações (Argumentação).
   - Competência 4: Mecanismos linguísticos para a argumentação (Coesão e Coerência).
   - Competência 5: Proposta de intervenção respeitando os direitos humanos.
4. **MATRIZ DESCRITORES SISEDU (Níveis: "Inicial", "Intermediário" ou "Adequado"):**
   - D05: Interpretação de texto / recursos gráficos e visuais na estrutura dissertativa.
   - D06: Identificação do tema ou tese central da proposta.
   - D12: Relações de coesão, substituição e continuidade lexical.
   - D13: Localização da tese principal e argumento central.
   - D14: Distinção entre partes principais e secundárias do texto.
   - D15: Reconhecimento de posições distintas e contra-argumentação.
   - D16: Articulação lógica entre tese e argumentos sustentadores.
   - D17: Escolha vocabular, precisão semântica e efeito de sentido.
   - D18: Emprego da pontuação e recursos expressivos na organização textual.
5. **DEVOLUTIVA NÍVEL INICIAL ("devolutiva_nivel_inicial"):** Se QUALQUER um dos descritores SISEDU for classificado como "Inicial", forneça um parecer pedagógico estruturado de intervenção imediata, contendo orientações práticas de reescrita para o aluno e sugestão de oficina para o professor.
6. **CITAÇÃO DIRETA OBRIGATÓRIA ("citacao_texto"):** Para cada competência ENEM e descritor SISEDU, extraia um trecho exato do texto do aluno que comprove sua avaliação.

FORMATO DE SAÍDA OBRIGATÓRIO (JSON estrito):
{
  "aluno": "${nomeFornecido || 'Nome do Aluno ou null'}",
  "turma": "${turmaFornecida || 'Turma do Aluno ou null'}",
  "confianca_identificacao": "ALTA",
  "motivo_incerteza_identificacao": "Nome e turma perfeitamente legíveis no cabeçalho",
  "texto_transcrito": "Texto integral transcrito palavra por palavra...",
  "devolutiva_nivel_inicial": "Diretriz pedagógica de intervenção para os pontos em Nível Inicial...",
  "avaliacoes": {
    "enem": {
      "competencia_1": { "nota": 160, "citacao_texto": "trecho exato do aluno", "justificativa": "..." },
      "competencia_2": { "nota": 200, "citacao_texto": "trecho exato do aluno", "justificativa": "..." },
      "competencia_3": { "nota": 160, "citacao_texto": "trecho exato do aluno", "justificativa": "..." },
      "competencia_4": { "nota": 160, "citacao_texto": "trecho exato do aluno", "justificativa": "..." },
      "competencia_5": { "nota": 160, "citacao_texto": "trecho exato do aluno", "justificativa": "..." },
      "nota_total_enem": 840
    },
    "sisedu": {
      "nivel_global": "Intermediário",
      "descritores": {
        "D05": { "nome": "Interpretação Gráfica/Textual", "nivel": "Adequado", "citacao_texto": "trecho exato", "justificativa": "..." },
        "D06": { "nome": "Identificação do Tema/Tese", "nivel": "Adequado", "citacao_texto": "trecho exato", "justificativa": "..." },
        "D12": { "nome": "Coesão e Substituição Lexical", "nivel": "Intermediário", "citacao_texto": "trecho exato", "justificativa": "..." },
        "D13": { "nome": "Localização da Tese Central", "nivel": "Adequado", "citacao_texto": "trecho exato", "justificativa": "..." },
        "D14": { "nome": "Distinção de Partes Principais/Secundárias", "nivel": "Intermediário", "citacao_texto": "trecho exato", "justificativa": "..." },
        "D15": { "nome": "Reconhecimento de Posições Distintas", "nivel": "Inicial", "citacao_texto": "trecho exato", "justificativa": "..." },
        "D16": { "nome": "Articulação de Tese e Argumentos", "nivel": "Intermediário", "citacao_texto": "trecho exato", "justificativa": "..." },
        "D17": { "nome": "Escolha Vocabular e Estilo", "nivel": "Adequado", "citacao_texto": "trecho exato", "justificativa": "..." },
        "D18": { "nome": "Pontuação e Recursos Expressivos", "nivel": "Intermediário", "citacao_texto": "trecho exato", "justificativa": "..." }
      }
    }
  }
}`;

  const promptText = `Realize a transcrição integral e a avaliação pedagógica cruzada (ENEM x SISEDU D05-D18).
Aluno Identificado: ${nomeFornecido || 'Não especificado (extrair do cabeçalho se houver)'}
Turma Identificada: ${turmaFornecida || 'Não especificada'}
${textoDigitado ? `\nTEXTO DIGITADO:\n"""\n${textoDigitado}\n"""` : ''}`;

  let contents = [];

  if (imagemBase64 && imagemBase64.trim().length > 0) {
    const base64Data = imagemBase64.includes('base64,')
      ? imagemBase64.split('base64,')[1]
      : imagemBase64;
    const mimeTypeMatch = imagemBase64.match(/^data:(image\/[a-zA-Z+]+);base64,/);
    const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : 'image/jpeg';

    contents = [
      { inlineData: { data: base64Data, mimeType } },
      promptText
    ];
  } else {
    contents = promptText;
  }

  const result = await generateContentWithFallback(
    genAI,
    {
      systemInstruction,
      generationConfig: { responseMimeType: 'application/json' }
    },
    contents
  );

  const responseText = result.response.text();
  console.log(`[Agente Único IA] Transcrição OCR e Avaliação pedagógica concluídas com sucesso.`);
  const parsed = cleanAndParseJSON(responseText);

  // Recalcula rigorosamente a soma real das 5 competências do ENEM (C1 + C2 + C3 + C4 + C5)
  if (parsed.avaliacoes?.enem) {
    const enem = parsed.avaliacoes.enem;
    const c1 = Number(enem.competencia_1?.nota ?? 0);
    const c2 = Number(enem.competencia_2?.nota ?? 0);
    const c3 = Number(enem.competencia_3?.nota ?? 0);
    const c4 = Number(enem.competencia_4?.nota ?? 0);
    const c5 = Number(enem.competencia_5?.nota ?? 0);
    const totalEnem = Math.min(1000, Math.max(0, c1 + c2 + c3 + c4 + c5));
    
    enem.nota_total_enem = totalEnem;
    parsed.nota_final = totalEnem;
  }

  if (nomeFornecido) parsed.aluno = nomeFornecido;
  if (turmaFornecida) parsed.turma = turmaFornecida;
  if (textoDigitado && (!parsed.texto_transcrito || parsed.texto_transcrito.length < textoDigitado.length)) {
    parsed.texto_transcrito = textoDigitado;
  }

  return parsed;
}

/**
 * Generates realistic Mock ENEM x Sisedu essay evaluations
 */
export function getMockENEMEvaluation(id, textoDigitado, nomeFornecido, turmaFornecida) {
  const isIdentified = !!nomeFornecido || Number(id) % 2 !== 0;

  const mockNames = [
    'Mariana Souza de Oliveira',
    'Lucas Gabriel Ferreira',
    'Beatriz Mendes da Silva',
    'Gabriel Santos Rocha'
  ];

  const selectedName = nomeFornecido || (isIdentified
    ? mockNames[Math.floor(Math.random() * mockNames.length)]
    : null);

  const selectedTurma = turmaFornecida || (isIdentified ? '3º Ano A - Ensino Médio' : null);

  const sampleTexts = [
    "No contexto da sociedade contemporânea, os desafios para a preservação da biodiversidade na Amazônia tornam-se cada vez mais prementes. Em primeira análise, cabe destacar que a falta de fiscalização governamental intensifica o desmatamento ilegal. Ademais, o sociólogo Zygmunt Bauman, em sua obra 'Modernidade Líquida', ressalta a fragilidade das instituições no combate às crises socioambientais. Portanto, medidas urgentes são necessárias para mitigar essa problemática.",
    "A democratização do acesso ao cinema no Brasil apresenta entraves históricos e socioeconômicos. Sob essa ótica, verifica-se que o alto custo dos ingressos e a concentração das salas de exibição em grandes centros urbanos marginalizam a população periférica. Como dizia Kant, o ser humano é aquilo que a educação faz dele, evidenciando a necessidade de ampliação cultural no país."
  ];

  const transcriptText = textoDigitado || `[MODO DEMONSTRAÇÃO - SEM CHAVE DE API ATIVA]\n\n${sampleTexts[Number(id) % sampleTexts.length]}`;

  return {
    aluno: selectedName,
    turma: selectedTurma,
    texto_transcrito: transcriptText,
    devolutiva_nivel_inicial: "DEVOLUTIVA DE INTERVENÇÃO PEDAGÓGICA (NÍVEL INICIAL - D15):\nO estudante demonstrou dificuldade no descritor D15 (Reconhecimento de posições distintas e contra-argumentação). Recomenda-se realizar oficinas de leitura guiada comparando editoriais com visões divergentes sobre o mesmo tema, incentivando o aluno a utilizar conectores adversativos (ex: 'embora', 'por outro lado') no parágrafo de desenvolvimento.",
    avaliacoes: {
      enem: {
        competencia_1: {
          nota: 160,
          citacao_texto: "os desafios para a preservação da biodiversidade na Amazônia tornam-se cada vez mais prementes",
          justificativa: "Demonstra bom domínio da norma culta formal com pontuais vírgulas deslocadas."
        },
        competencia_2: {
          nota: 200,
          citacao_texto: "o sociólogo Zygmunt Bauman, em sua obra 'Modernidade Líquida', ressalta a fragilidade das instituições",
          justificativa: "Excelente repertório sociocultural legitimado e produtivo articulado com a tese."
        },
        competencia_3: {
          nota: 160,
          citacao_texto: "a falta de fiscalização governamental intensifica o desmatamento ilegal",
          justificativa: "Projeto de texto estratégico e argumentação bem direcionada em defesa do ponto de vista."
        },
        competencia_4: {
          nota: 160,
          citacao_texto: "Em primeira análise, cabe destacar... Ademais, o sociólogo... Portanto, medidas urgentes",
          justificativa: "Repertório coesivo diversificado com operadores argumentativos interparágrafos."
        },
        competencia_5: {
          nota: 160,
          citacao_texto: "medidas urgentes são necessárias para mitigar essa problemática",
          justificativa: "Proposta de intervenção com agente e ação definidos, com detalhamento moderado."
        },
        nota_total_enem: 840
      },
      sisedu: {
        nivel_global: "Intermediário",
        descritores: {
          D05: {
            nome: "Interpretação Gráfica/Textual",
            nivel: "Adequado",
            citacao_texto: "preservação da biodiversidade na Amazônia",
            justificativa: "Compreende integralmente os elementos motivadores e contextualiza o problema."
          },
          D06: {
            nome: "Identificação do Tema/Tese",
            nivel: "Adequado",
            citacao_texto: "tornam-se cada vez mais prementes",
            justificativa: "Sustenta tese explícita e relevante alinhada à proposta da redação."
          },
          D12: {
            nome: "Coesão e Substituição Lexical",
            nivel: "Intermediário",
            citacao_texto: "Em primeira análise, cabe destacar...",
            justificativa: "Utiliza anáforas e conectivos adequadamente com raros vícios de repetição."
          },
          D13: {
            nome: "Localização da Tese Central",
            nivel: "Adequado",
            citacao_texto: "medidas urgentes são necessárias",
            justificativa: "Posiciona claramente o núcleo argumentativo no encerramento da introdução."
          },
          D14: {
            nome: "Distinção de Partes Principais/Secundárias",
            nivel: "Intermediário",
            citacao_texto: "a falta de fiscalização governamental intensifica o desmatamento",
            justificativa: "Hierarquiza argumentos centrais com bom suporte em exemplos secundários."
          },
          D15: {
            nome: "Reconhecimento de Posições Distintas",
            nivel: "Inicial",
            citacao_texto: "crises socioambientais",
            justificativa: "Necessita aprofundar o diálogo entre teses opostas e refutação estruturada."
          },
          D16: {
            nome: "Articulação de Tese e Argumentos",
            nivel: "Intermediário",
            citacao_texto: "Zygmunt Bauman, em sua obra 'Modernidade Líquida'",
            justificativa: "Conecta repertório sociológico à causa principal apontada no texto."
          },
          D17: {
            nome: "Escolha Vocabular e Estilo",
            nivel: "Adequado",
            citacao_texto: "mitigar essa problemática",
            justificativa: "Vocabulário preciso, variado e adequado à norma padrão da modalidade escrita."
          },
          D18: {
            nome: "Pontuação e Recursos Expressivos",
            nivel: "Intermediário",
            citacao_texto: "Portanto, medidas urgentes são necessárias...",
            justificativa: "Emprego correto de vírgulas, travessões e pausas explicativas ao longo do texto."
          }
        }
      }
    }
  };
}
