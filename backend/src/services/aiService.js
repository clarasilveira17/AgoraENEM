import { GoogleGenerativeAI } from '@google/generative-ai';
import { generateContentWithFallback } from '../config/gemini.js';

/**
 * State-machine JSON repairer that sanitizes raw control characters,
 * fixes unescaped inner quotes, and corrects invalid escapes inside strings.
 */
function repairJsonString(jsonStr) {
  let result = '';
  let inString = false;
  let isEscaped = false;

  for (let i = 0; i < jsonStr.length; i++) {
    const char = jsonStr[i];

    if (inString) {
      if (isEscaped) {
        if (char === '"' || char === '\\' || char === '/' || char === 'b' || char === 'f' || char === 'n' || char === 'r' || char === 't' || char === 'u') {
          result += '\\' + char;
        } else {
          result += char;
        }
        isEscaped = false;
      } else if (char === '\\') {
        isEscaped = true;
      } else if (char === '"') {
        // Determine if this is the closing quote or an unescaped inner quote
        const remaining = jsonStr.slice(i + 1);
        const nextNonWs = remaining.search(/\S/);
        const nextChar = nextNonWs !== -1 ? remaining[nextNonWs] : '';

        if (nextChar === ':' || nextChar === ',' || nextChar === '}' || nextChar === ']' || nextChar === '') {
          inString = false;
          result += '"';
        } else {
          result += "'";
        }
      } else if (char === '\n') {
        result += '\\n';
      } else if (char === '\r') {
        result += '\\r';
      } else if (char === '\t') {
        result += '\\t';
      } else if (char.charCodeAt(0) < 32) {
        // Strip other invalid control characters (0x00 to 0x1F)
      } else {
        result += char;
      }
    } else {
      if (char === '"') {
        inString = true;
        result += '"';
      } else {
        result += char;
      }
    }
  }

  if (inString) {
    result += '"';
  }

  // Remove trailing commas before } or ]
  return result.replace(/,\s*([}\]])/g, '$1');
}

/**
 * Helper to safely clean and parse JSON responses from AI models
 */
export function cleanAndParseJSON(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('Texto de resposta inválido ou vazio para conversão em JSON.');
  }

  let cleaned = rawText.trim();

  // Remove markdown codeblock wrappers if present
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  // Extract JSON object if surrounded by extra commentary
  const startIdx = cleaned.indexOf('{');
  const endIdx = cleaned.lastIndexOf('}');
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    cleaned = cleaned.substring(startIdx, endIdx + 1);
  }

  // Tentativa 1: Parse direto padrão
  try {
    return JSON.parse(cleaned);
  } catch (firstErr) {
    console.warn(`[JSON Parser] Tentativa 1 de parse falhou (${firstErr.message}). Aplicando reparo avançado de JSON...`);
  }

  // Tentativa 2: Reparo de máquina de estados (caracteres de controle, quebras de linha cruas, aspas internas)
  try {
    const repaired = repairJsonString(cleaned);
    return JSON.parse(repaired);
  } catch (secondErr) {
    console.warn(`[JSON Parser] Tentativa 2 de parse falhou (${secondErr.message}). Sanitizando linhas com regex...`);
  }

  // Tentativa 3: Sanitização agressiva linha por linha
  try {
    const lines = cleaned.split(/\r?\n/);
    const fixedLines = lines.map(line => {
      const match = line.match(/^(\s*"[a-zA-Z0-9_]+"\s*:\s*")(.*)("(?:,\s*|\s*))$/);
      if (match) {
        const prefix = match[1];
        const content = match[2];
        const suffix = match[3];
        const safeContent = content
          .replace(/[\u0000-\u001F]/g, ' ')
          .replace(/(?<!\\)"/g, "'");
        return prefix + safeContent + suffix;
      }
      return line.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
    });
    const finalClean = fixedLines.join('\n').replace(/,\s*([}\]])/g, '$1');
    return JSON.parse(finalClean);
  } catch (finalErr) {
    console.error(`[JSON Parser] ❌ Falha crítica no parsing do JSON: ${finalErr.message}`);
    throw finalErr;
  }
}

/**
 * AGENTE ÚNICO UNIFICADO: Transcrição OCR + Banca Avaliadora Pedagógica (ENEM x SISEDU D05-D18)
 */
export async function agenteAvaliadorUnificado(imagemBase64, textoDigitado, nomeFornecido, turmaFornecida, apiKey) {
  const genAI = new GoogleGenerativeAI(apiKey);

  const systemInstruction = `Você é um avaliador educacional sênior e especialista oficial na Matriz de Correção do ENEM (INEP) e nos Descritores do SISEDU/SPAECE (Projeto Ágora Escolar).

SUA POSTURA É: IMPARCIAL, TÉCNICA, HONESTA E PEDAGOGICAMENTE JUSTA.
- Não seja artificialmente punitivo como um corretor ortográfico robótico que ignora a maturidade do texto.
- Não seja benevolente ou inflacione notas sem evidências textuais.
- Aplique com exatidão a gradação oficial de níveis do INEP (0, 40, 80, 120, 160, 200) e os descritores do SISEDU ("Adequado", "Intermediário", "Inicial").

DIRETRIZES OFICIAIS DE CALIBRAÇÃO (MATRIZ ENEM):

1. **COMPETÊNCIA 1 (Domínio da Norma Culta Escrita):**
   - **200 pts:** Excelente domínio. Desvios gramaticais ou de convenção da escrita apenas como exceções raras (até 2 falhas pontuais que não sejam reincidentes).
   - **160 pts (BOM DOMÍNIO):** Estrutura sintática fluida, períodos bem formados e vocabulário formal expressivo. Apresenta poucos desvios gramaticais ou ortográficos pontuais (ex: pequenos deslizes de acentuação gráfica em proparoxítonas, crase ou pontuação isolada) que NÃO comprometem a fluidez e a clareza da leitura.
   - **120 pts (DOMÍNIO MEDIANO):** Presença de erros sintáticos estruturais recorrentes (truncamento de períodos, falta de paralelismo sintático grave) E/OU muitos desvios gramaticais sistemáticos e frequentes em todo o texto.
   - **80 pts:** Domínio insuficiente, com múltiplos desvios graves e estrutura sintática quebrada.
   - **40 / 0 pts:** Domínio precário ou desconhecimento da norma culta.

2. **COMPETÊNCIA 2 (Compreensão do Tema e Repertório Sociocultural Legitimado):**
   - **200 pts:** Aborda o tema integralmente e utiliza repertório sociocultural LEGITIMADO E PRODUTIVO (pertinente e diretamente articulado à defesa da tese com vínculo autoral explícito).
   - **160 pts:** Aborda o tema integralmente e utiliza repertório sociocultural LEGITIMADO e pertinente ao tema, mesmo que a articulação com a tese seja convencional ou com produtividade básica.
   - **120 pts:** Abordagem completa do tema, mas com repertório baseado apenas nos textos motivadores OU repertório legitimado descolado/pouco pertinente ao núcleo temático.
   - **80 / 40 / 0 pts:** Tangenciamento do tema, cópia dos textos motivadores ou fuga total ao tema.

3. **COMPETÊNCIA 3 (Projeto de Texto e Desenvolvimento Argumentativo):**
   - **200 pts:** Projeto de texto estratégico, consistente e autoral. Tese clara na introdução com argumentos desdobrados e comprovados sem lacunas lógicas.
   - **160 pts:** Projeto de texto perceptível e claro. Apresenta tese e desenvolve argumentos com direção argumentativa definida, podendo apresentar pequenas falhas pontuais de aprofundamento que não anulam a força do ponto de vista defendido.
   - **120 pts:** Projeto de texto com falhas evidentes, argumentação previsível, lacunas lógicas ou desenvolvimento meramente expositivo/superficial.
   - **80 / 40 / 0 pts:** Argumentação inconsistente, contraditória ou sem projeto de texto perceptível.

4. **COMPETÊNCIA 4 (Coesão Textual e Recursos Coesivos):**
   - **200 pts:** Estruturação coesiva exemplar. Presença diversificada de conectivos interparágrafos (em pelo menos 2 transições de parágrafos) e intraparágrafos, com raríssimas ou nenhuma repetição e sem inadequações.
   - **160 pts:** Bom uso de recursos coesivos. Emprega conectores inter e intraparágrafos adequadamente, com poucas repetições ou inadequações leves.
   - **120 pts:** Uso mediano de recursos coesivos, com repetição frequente de operadores argumentativos ou falhas na conexão entre orações.
   - **80 / 40 / 0 pts:** Inadequação generalizada de conectivos ou ausência de recursos coesivos.

5. **COMPETÊNCIA 5 (Proposta de Intervenção Social):**
   Avalie estritamente a presença dos 5 ELEMENTOS OFICIAIS DO ENEM (40 pontos por elemento):
   - **Elemento 1: AGENTE** (Quem fará? Ex: Ministério, Governo Federal, Sociedade Civil).
   - **Elemento 2: AÇÃO** (O que será feito? Verbo no infinitivo/imperativo).
   - **Elemento 3: MEIO/MODO** (Como será feito? Por meio de quê? Através de quais mecanismos?).
   - **Elemento 4: EFEITO/FINALIDADE** (Para quê? Qual o objetivo/impacto social esperado?).
   - **Elemento 5: DETALHAMENTO** (Explicação extra ou desdobramento de um dos 4 elementos anteriores, ex: explicando a atuação do agente ou o funcionamento prático do meio).
   * **200 pts:** Contém os 5 elementos completos, claros e articulados à discussão.
   * **160 pts:** Contém os 4 elementos essenciais OU os 5 elementos com detalhamento sucinto.
   * **120 pts:** Contém 3 elementos válidos.
   * **80 pts:** Contém 2 elementos válidos.
   * **40 pts:** Contém apenas 1 elemento válido.
   * **0 pts:** Ausência de proposta ou violação explícita aos Direitos Humanos.

DIRETRIZES DA MATRIZ SISEDU/SPAECE (D05 a D18):
- Classifique cada descritor em "Adequado", "Intermediário" ou "Inicial" com base na proficiência real demonstrada.
- D05: Interpretação de texto / recursos gráficos na estrutura dissertativa.
- D06: Identificação do tema ou tese central da proposta.
- D12: Relações de coesão, substituição e continuidade lexical.
- D13: Localização da tese principal e argumento central.
- D14: Distinção entre partes principais e secundárias do texto.
- D15: Reconhecimento de posições distintas e contra-argumentação.
- D16: Articulação lógica entre tese e argumentos sustentadores.
- D17: Escolha vocabular, precisão semântica e efeito de sentido.
- D18: Emprego da pontuação e recursos expressivos na organização textual.

MISSÃO ADICIONAL:
1. **TRANSCRIÇÃO LINHA A LINHA DA FOLHA OFICIAL (Linhas 01 a 30):** Transcreva o texto do aluno preservando exatamente a disposição de linhas da folha pautada de redação. Insira uma quebra de linha ('\n') ao final de cada linha física manuscrita na folha, de modo que cada linha corresponda fielmente às linhas 1 a 30 da folha oficial. Se for texto digitado, quebre as linhas mantendo a estrutura de parágrafos bem definida.
2. **IDENTIFICAÇÃO SINCERA:** Classifique "confianca_identificacao" em "ALTA", "MEDIA" ou "BAIXA" com base na legibilidade do cabeçalho.
3. **CITAÇÃO DIRETA ("citacao_texto"):** Extraia sempre trecho literal do aluno como evidência para cada nota.
4. **DEVOLUTIVA PEDAGÓGICA ENEM ("devolutiva_enem"):** Parecer pedagógico estruturado OBRIGATORIAMENTE em tópicos com quebras de linha duplas ('\n\n') e marcadores '•', nunca em um único bloco corrido:
   • Visão Geral da Produção Textual: Parecer sobre a maturidade discursiva e projeto de texto.
   • Na Competência 1: Análise dos desvios gramaticais, ortografia e sintaxe.
   • Na Competência 2: Análise da compreensão do tema e repertório legitimado/produtivo.
   • Na Competência 3: Análise do projeto de texto e consistência dos argumentos.
   • A Competência 4: Análise dos conectores inter e intraparágrafos e coesão.
   • Por fim, a Competência 5: Análise dos 5 elementos da intervenção (Agente, Ação, Modo, Efeito, Detalhamento).
   • Recomendações de Evolução: Ações claras para o estudante atingir os 1000 pontos.
5. **DEVOLUTIVA DE INTERVENÇÃO SISEDU/SPAECE ("devolutiva_sisedu"):** Parecer escolar focado nos Descritores do SISEDU (D05 a D18), estruturado OBRIGATORIAMENTE com quebras de linha duplas ('\n\n') e marcadores '•':
   • Diagnóstico Curricular: Nível global e destaque dos descritores adequados (D06, D13, D17).
   • Fragilidades Prioritárias: Detalhamento dos descritores em nível Inicial ou Intermediário (ex: D15 contra-argumentação, D18 pontuação, D12 substituição lexical).
   • Sugere-se ao professor: Roteiro prático de oficina pedagógica ou atividade de reescrita para aplicação em sala de aula.
6. **SINTAXE JSON RIGOROSA:** Retorne estritamente um único objeto JSON válido. Ao citar obras, frases ou palavras dentro das strings do JSON, use sempre aspas simples '...' para nunca quebrar as aspas delimitadoras do JSON.

FORMATO DE SAÍDA OBRIGATÓRIO (JSON estrito):
{
  "aluno": "${nomeFornecido || 'Nome do Aluno ou null'}",
  "turma": "${turmaFornecida || 'Turma do Aluno ou null'}",
  "confianca_identificacao": "ALTA",
  "motivo_incerteza_identificacao": "Nome e turma perfeitamente legíveis no cabeçalho",
  "texto_transcrito": "Linha 1 do texto manuscrito...\nLinha 2 do texto manuscrito...\nLinha 3...",
  "devolutiva_enem": "Visão Geral: O texto apresenta...\n\n• Na Competência 1: Observa-se...\n\n• Na Competência 2: O tema é...\n\n• Na Competência 3: O projeto de texto...\n\n• A Competência 4: Revela bom uso...\n\n• Por fim, a Competência 5: Apresenta os 5 elementos...\n\n• Recomendações de Evolução: Praticar...",
  "devolutiva_sisedu": "Diagnóstico Curricular: O desempenho situa-se...\n\n• Fragilidades Prioritárias: Observam-se fragilidades em D15 e D18...\n\n• Sugere-se ao professor: Uma oficina prática de...",
  "devolutiva_nivel_inicial": "Plano de intervenção pedagógica focado nos Descritores do SISEDU/SPAECE...",
  "avaliacoes": {
    "enem": {
      "competencia_1": { "nota": 160, "citacao_texto": "trecho literal", "justificativa": "..." },
      "competencia_2": { "nota": 160, "citacao_texto": "trecho literal", "justificativa": "..." },
      "competencia_3": { "nota": 160, "citacao_texto": "trecho literal", "justificativa": "..." },
      "competencia_4": { "nota": 160, "citacao_texto": "trecho literal", "justificativa": "..." },
      "competencia_5": { "nota": 160, "citacao_texto": "trecho literal", "justificativa": "..." },
      "nota_total_enem": 800
    },
    "sisedu": {
      "nivel_global": "Intermediário",
      "descritores": {
        "D05": { "nome": "Interpretação Gráfica/Textual", "nivel": "Adequado", "citacao_texto": "trecho literal", "justificativa": "..." },
        "D06": { "nome": "Identificação do Tema/Tese", "nivel": "Adequado", "citacao_texto": "trecho literal", "justificativa": "..." },
        "D12": { "nome": "Coesão e Substituição Lexical", "nivel": "Intermediário", "citacao_texto": "trecho literal", "justificativa": "..." },
        "D13": { "nome": "Localização da Tese Central", "nivel": "Adequado", "citacao_texto": "trecho literal", "justificativa": "..." },
        "D14": { "nome": "Distinção de Partes Principais/Secundárias", "nivel": "Intermediário", "citacao_texto": "trecho literal", "justificativa": "..." },
        "D15": { "nome": "Reconhecimento de Posições Distintas", "nivel": "Inicial", "citacao_texto": "trecho literal", "justificativa": "..." },
        "D16": { "nome": "Articulação de Tese e Argumentos", "nivel": "Intermediário", "citacao_texto": "trecho literal", "justificativa": "..." },
        "D17": { "nome": "Escolha Vocabular e Estilo", "nivel": "Adequado", "citacao_texto": "trecho literal", "justificativa": "..." },
        "D18": { "nome": "Pontuação e Recursos Expressivos", "nivel": "Intermediário", "citacao_texto": "trecho literal", "justificativa": "..." }
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
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.0,
        topP: 0.95,
        topK: 1
      }
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
