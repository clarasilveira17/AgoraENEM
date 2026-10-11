import { GoogleGenerativeAI } from '@google/generative-ai';
import crypto from 'crypto';
import { generateContentWithFallback } from '../config/gemini.js';

/* ============================================================================
 * PARSER / REPARO DE JSON ROBUSTO
 * ==========================================================================*/

function extractBalancedJson(str) {
  if (!str || typeof str !== 'string') return null;

  // Se houver bloco markdown ```json ... ```, extrai o conteúdo do primeiro bloco
  const mdMatch = str.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const targetStr = mdMatch ? mdMatch[1].trim() : str.trim();

  const firstBrace = targetStr.indexOf('{');
  const firstBracket = targetStr.indexOf('[');

  let startIdx = -1;
  let openChar = '';
  let closeChar = '';

  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    startIdx = firstBrace;
    openChar = '{';
    closeChar = '}';
  } else if (firstBracket !== -1) {
    startIdx = firstBracket;
    openChar = '[';
    closeChar = ']';
  } else {
    return targetStr;
  }

  let depth = 0;
  let inString = false;
  let isEscaped = false;

  for (let i = startIdx; i < targetStr.length; i++) {
    const char = targetStr[i];

    if (inString) {
      if (isEscaped) {
        isEscaped = false;
      } else if (char === '\\') {
        isEscaped = true;
      } else if (char === '"') {
        inString = false;
      }
    } else {
      if (char === '"') {
        inString = true;
      } else if (char === openChar) {
        depth++;
      } else if (char === closeChar) {
        depth--;
        if (depth === 0) {
          return targetStr.slice(startIdx, i + 1);
        }
      }
    }
  }

  return targetStr.slice(startIdx);
}

function repairJsonString(jsonStr) {
  let result = '';
  let inString = false;
  let isEscaped = false;

  for (let i = 0; i < jsonStr.length; i++) {
    const char = jsonStr[i];
    if (inString) {
      if (isEscaped) {
        if ('"\\/bfnrtu'.includes(char)) result += '\\' + char;
        else result += char;
        isEscaped = false;
      } else if (char === '\\') {
        isEscaped = true;
      } else if (char === '"') {
        const remaining = jsonStr.slice(i + 1);
        const nextNonWs = remaining.search(/\S/);
        const nextChar = nextNonWs !== -1 ? remaining[nextNonWs] : '';
        if (nextChar === ':' || nextChar === ',' || nextChar === '}' || nextChar === ']' || nextChar === '') {
          inString = false;
          result += '"';
        } else {
          result += "'";
        }
      } else if (char === '\n') result += '\\n';
      else if (char === '\r') result += '\\r';
      else if (char === '\t') result += '\\t';
      else if (char.charCodeAt(0) < 32) { /* descarta */ }
      else result += char;
    } else {
      if (char === '"') { inString = true; result += '"'; }
      else result += char;
    }
  }
  if (inString) result += '"';
  return result.replace(/,\s*([}\]])/g, '$1');
}

export function cleanAndParseJSON(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('Texto de resposta inválido ou vazio para conversão em JSON.');
  }

  const rawTrimmed = rawText.trim();

  // Tentativa 0: Parse direto se já for JSON puro
  try {
    return JSON.parse(rawTrimmed);
  } catch (e) {
    const matchPos = e.message.match(/position\s+(\d+)/i);
    if (matchPos && matchPos[1]) {
      const pos = parseInt(matchPos[1], 10);
      if (pos > 0 && pos < rawTrimmed.length) {
        try {
          return JSON.parse(rawTrimmed.slice(0, pos));
        } catch (_) {}
      }
    }
  }

  // Tentativa 1: Extrair bloco balanceado
  let cleaned = extractBalancedJson(rawTrimmed) || rawTrimmed;

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    const matchPos = e.message.match(/position\s+(\d+)/i);
    if (matchPos && matchPos[1]) {
      const pos = parseInt(matchPos[1], 10);
      if (pos > 0 && pos < cleaned.length) {
        try {
          return JSON.parse(cleaned.slice(0, pos));
        } catch (_) {}
      }
    }
    console.warn(`[JSON Parser] Tentativa 1 falhou: ${e.message}`);
  }

  // Tentativa 2: Reparar strings com caracteres de controle e aspas
  try {
    const repaired = repairJsonString(cleaned);
    return JSON.parse(repaired);
  } catch (e) {
    const matchPos = e.message.match(/position\s+(\d+)/i);
    if (matchPos && matchPos[1]) {
      const pos = parseInt(matchPos[1], 10);
      if (pos > 0 && pos < cleaned.length) {
        try {
          return JSON.parse(repairJsonString(cleaned.slice(0, pos)));
        } catch (_) {}
      }
    }
    console.warn(`[JSON Parser] Tentativa 2 falhou: ${e.message}`);
  }

  // Tentativa 3: Sanitização linha a linha com regex
  try {
    const lines = cleaned.split(/\r?\n/).map(line => {
      const m = line.match(/^(\s*"[a-zA-Z0-9_]+"\s*:\s*")(.*)("(?:,\s*|\s*))$/);
      if (m) {
        const [, prefix, content, suffix] = m;
        const safe = content.replace(/[\u0000-\u001F]/g, ' ').replace(/(?<!\\)"/g, "'");
        return prefix + safe + suffix;
      }
      return line.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
    });
    const finalClean = lines.join('\n').replace(/,\s*([}\]])/g, '$1');
    return JSON.parse(finalClean);
  } catch (e) {
    const matchPos = e.message.match(/position\s+(\d+)/i);
    if (matchPos && matchPos[1]) {
      const pos = parseInt(matchPos[1], 10);
      if (pos > 0 && pos < cleaned.length) {
        try {
          const lines = cleaned.slice(0, pos).split(/\r?\n/).map(line => {
            const m = line.match(/^(\s*"[a-zA-Z0-9_]+"\s*:\s*")(.*)("(?:,\s*|\s*))$/);
            if (m) {
              const [, prefix, content, suffix] = m;
              const safe = content.replace(/[\u0000-\u001F]/g, ' ').replace(/(?<!\\)"/g, "'");
              return prefix + safe + suffix;
            }
            return line.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
          });
          const finalClean = lines.join('\n').replace(/,\s*([}\]])/g, '$1');
          return JSON.parse(finalClean);
        } catch (_) {}
      }
    }
    console.warn(`[JSON Parser] Tentativa 3 falhou: ${e.message}`);
  }

  // Tentativa 4: Fechamento forçado de JSON truncado
  try {
    let truncated = cleaned.trim().replace(/,\s*$/, '');
    const openBraces = (truncated.match(/{/g) || []).length;
    const closeBraces = (truncated.match(/}/g) || []).length;
    if (openBraces > closeBraces) {
      if ((truncated.match(/"/g) || []).length % 2 !== 0) {
        truncated += '"';
      }
      truncated += '}'.repeat(openBraces - closeBraces);
      return JSON.parse(truncated);
    }
  } catch (e) {
    console.warn(`[JSON Parser] Tentativa 4 falhou: ${e.message}`);
  }

  throw new Error(`Falha ao converter resposta da IA em formato JSON válido: ${rawText.substring(0, 150)}...`);
}

/* ============================================================================
 * CACHE — DESLIGADO POR PADRÃO
 * ==========================================================================*/

const _cacheMemoria = new Map();
const CACHE_MAX_MEMORIA = 500;

let _cachePersistente = {
  get: async () => null,
  set: async () => { },
};

export function configurarCachePersistente(provider) {
  if (provider && typeof provider.get === 'function' && typeof provider.set === 'function') {
    _cachePersistente = provider;
  }
}

function normalizarParaHash(texto) {
  return String(texto || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.,;:!?]+/g, '')
    .trim();
}

function hashTexto(texto) {
  return crypto
    .createHash('sha256')
    .update(normalizarParaHash(texto))
    .digest('hex')
    .slice(0, 24);
}

async function cacheGet(hash) {
  if (!hash) return null;
  if (_cacheMemoria.has(hash)) return _cacheMemoria.get(hash);
  try {
    const persistido = await _cachePersistente.get(hash);
    if (persistido) {
      _cacheMemoria.set(hash, persistido);
      return persistido;
    }
  } catch (e) {
    console.warn(`[Cache] Falha no get persistente: ${e.message}`);
  }
  return null;
}

async function cacheSet(hash, resultado) {
  if (!hash) return;
  if (_cacheMemoria.size >= CACHE_MAX_MEMORIA) {
    const primeiraChave = _cacheMemoria.keys().next().value;
    _cacheMemoria.delete(primeiraChave);
  }
  _cacheMemoria.set(hash, resultado);
  try {
    await _cachePersistente.set(hash, resultado);
  } catch (e) {
    console.warn(`[Cache] Falha no set persistente: ${e.message}`);
  }
}

/* ============================================================================
 * SANEAMENTO ORTOGRÁFICO — REDE DE SEGURANÇA INDEPENDENTE DO PROMPT
 * ==========================================================================*/

// Únicos diacríticos que existem na ortografia atual do português.
const LETRAS_ACENTUADAS_VALIDAS = new Set('áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ');

/**
 * O modelo às vezes "alucina" um diacrítico que o português não usa
 * (ex.: trema em 'ü', ou 'ï'/'ë'/'ä'/'ö'/'ñ' vindos de ruído visual do
 * traço). O prompt já proíbe isso, mas prompts nem sempre são obedecidos
 * à risca — então aplicamos aqui uma normalização determinística que NÃO
 * depende do modelo: qualquer caractere acentuado que não esteja na lista
 * de acentos válidos do português é reduzido à sua letra-base (ü → u,
 * ï → i, ë → e, ä → a, ö → o, ñ → n), e os acentos válidos (á, ç etc.)
 * são preservados intactos.
 */
function sanitizarOrtografiaPortugues(texto) {
  if (typeof texto !== 'string' || texto.length === 0) return texto;
  return texto
    .normalize('NFC')
    .split('')
    .map(char => {
      if (LETRAS_ACENTUADAS_VALIDAS.has(char)) return char;
      const semDiacritico = char.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return semDiacritico.length === 1 ? semDiacritico : char;
    })
    .join('');
}

/* ============================================================================
 * ETAPA 1 — TRANSCRIÇÃO
 * ==========================================================================*/

const TRANSCRICAO_SYSTEM_PROMPT = `Você é um transcritor oficial e especializado em manuscritos escolares de redação do ENEM.

TAREFA: Transcreva EXATAMENTE a folha de redação ipsis litteris, preservando os erros ortográficos e gramaticais originais e as linhas físicas (Linha 01 a Linha 30) com a quebra de linha '\\n' correspondente. Use [ilegível] se algum trecho ou palavra for impossível de ler.

REGRAS DE LEITURA E CALIGRAFIA (MUITO IMPORTANTE):
1. FIDELIDADE VISUAL IPSIS LITTERIS: Transcreva o que está escrito no papel sem corrigir erros do aluno. Se a caligrafia estiver ilegível em algum ponto, use a marcação [ilegível].
2. ALFABETO PERMITIDO (regra rígida): você só pode usar as 26 letras do português (a-z, A-Z) e as acentuações que realmente existem na ortografia atual: á à â ã é ê í ó ô õ ú ç (e maiúsculas). NUNCA escreva trema (ü) ou qualquer outro diacrítico como ï, ë, ä, ö, ñ — eles não existem mais no português. Se um traço parecer um trema, é sujeira do papel, sombra do traço ou pressão da caneta — ignore-o e leia a vogal normalmente.
3. PARES DE LETRAS QUE A CALIGRAFIA CURSIVA ESCOLAR CONFUNDE COM FREQUÊNCIA — nestes casos, dê SEMPRE o benefício da dúvida ao aluno e escolha a leitura que resulta numa palavra real no contexto:
   - 'o' vs 'a' (loop superior aberto em cursiva rápida, ex: "todos", "outro", "conjunto", "complicado", "do primeiro", "tecnológicos"): escolha SEMPRE a forma correta em concordância e gênero exigida pela frase. NUNCA transcreva 'a' quando a gramática do contexto exigir 'o'.
   - 'b' vs 'v' vs 's' (curva ou haste mal fechada, ex: "acaba" que parece "acasa"): escolha a palavra real e legítima em português ("acaba").
   - 'n' vs 'u' (arco invertido, comum em letra apressada)
   - 'm' vs 'n' vs 'rn' (contagem de hastes)
   - 'e' vs 'i' vs 'c' (curva aberta ou fechada)
   - 'r' vs 'n' (haste curta)
   Regra prática: se a leitura literal do traço resultar numa não-palavra ou num erro absurdo de concordância/ortografia que a intenção do aluno claramente não cometeu, transcreva a palavra pretendida. NUNCA invente incorreções ortográficas ou de concordância que o aluno não cometeu só porque o traço da letra é rápido ou aberto.
4. Não penalize omissões ou trocas puramente caligráficas visuais; garanta que ruídos visuais não se tornem erros fantásticos no texto transcrito.
5. REGISTRO DE DÚVIDAS: sempre que tiver que decidir entre duas leituras plausíveis para um mesmo trecho, registre isso em "duvidas_transcricao" (linha, trecho ambíguo, leitura adotada e motivo).

Responda APENAS com este JSON estrito, sem comentários, sem markdown:
{
  "texto_transcrito": "Linha 1...\\nLinha 2...\\nLinha 3...",
  "aluno_detectado": "nome extraído do cabeçalho ou null",
  "turma_detectada": "turma extraída do cabeçalho ou null",
  "confianca_identificacao": "ALTA|MEDIA|BAIXA",
  "motivo_incerteza_identificacao": "breve nota sobre legibilidade",
  "duvidas_transcricao": [ { "linha": 1, "trecho_ambiguo": "...", "leitura_adotada": "...", "motivo": "..." } ]
}`;

export async function transcreverRedacao(imagemBase64, apiKey) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const base64Data = imagemBase64.includes('base64,')
    ? imagemBase64.split('base64,')[1]
    : imagemBase64;
  const mimeMatch = imagemBase64.match(/^data:(image\/[a-zA-Z+]+);base64,/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';

  const result = await generateContentWithFallback(
    genAI,
    {
      systemInstruction: TRANSCRICAO_SYSTEM_PROMPT,
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.0,
        topK: 1,
        topP: 1.0,
      },
    },
    [{ inlineData: { data: base64Data, mimeType } }, 'Transcreva esta redação manuscrita.']
  );

  const transcricao = cleanAndParseJSON(result.response.text());
  if (transcricao && typeof transcricao.texto_transcrito === 'string') {
    transcricao.texto_transcrito = sanitizarOrtografiaPortugues(transcricao.texto_transcrito);
  }
  return transcricao;
}

/* ============================================================================
 * ETAPA 2 — COLETA DE FATOS
 * ==========================================================================*/

const AVALIACAO_SYSTEM_PROMPT = `Você é um corretor oficial do ENEM, altamente criterioso e fiel à Cartilha do Corretor do INEP 2026.

REGRAS INEGOCIÁVEIS:
1. NOTAS: Você SÓ pode usar as notas 200, 160, 120, 80, 40, 0 por competência. PROIBIDO qualquer outra nota intermediária.
2. RIGOR: Seja muito criterioso. Não dê 200 facilmente em nenhuma competência.
3. EVIDÊNCIAS: Toda constatação de desvio, repertório, tese ou elemento interventivo deve ser comprovada com citação literal do texto.

════════════════════════════════════════════════════════════════════════════
REGRA DE ESCOPO E IDENTIFICAÇÃO:
Considere APENAS o corpo do texto da redação. IGNORE completamente dados de cabeçalho (nome do aluno, turma, escola, data, assinatura ou palavras soltas no início como "Redação" ou "Filosofia").
════════════════════════════════════════════════════════════════════════════

────────────────────────────────────────────────────────────────────────────
C1 — NORMA CULTA (DOMÍNIO DA MODALIDADE ESCRITA FORMAL):
- "compromete_compreensao": true SOMENTE se falhas sintáticas graves tornarem o raciocínio ininteligível.
- "estrutura_sintatica": "excelente" (períodos complexos subordinados fluidos) | "boa" (períodos bem estruturados) | "regular" | "precaria" | "inexistente".
- "contagem_por_categoria": conte os desvios REAIS do corpo do texto:
    - "ortografia": erros reais de grafia e letras ilegíveis
    - "concordancia": concordância verbal ou nominal
    - "pontuacao": vírgula separando sujeito/predicado, falta de ponto final, etc.
    - "regencia": verbal ou nominal
    - "crase": omissão ou uso indevido
    - "acentuacao": falta ou excesso de acentuação
    - "escolha_vocabular": vocabulário inadequado, informalidade ou imprecisão
- Quando houver repetição do mesmo erro, contabilize cada ocorrência e aponte a reincidência.
- REGRAS ESPECIAIS DE OCR/CALIGRAFIA:
    1. Hífen de translineação ('-\\n') com divisão silábica correta NUNCA é erro.
    2. Troca 'o' vs 'a' decorrente de loop cursivo aberto não deve ser contabilizada como erro de concordância.
- "exemplos": lista com até 6 desvios mais relevantes ("citacao_texto", "tipo", "explicacao").

────────────────────────────────────────────────────────────────────────────
C2 — TEMA E ESTRUTURA DISSERTATIVA (REPERTÓRIO SOCIOCULTURAL):
- "quantidade_paragrafos": conte o total de parágrafos estruturados (o padrão esperado é 4: Introdução, D1, D2 e Conclusão).
- "tem_quatro_paragrafos": true se houver exatamente 4 parágrafos estruturados (Introdução, 2 Desenvolvimentos e Conclusão).
- "abordagem_do_tema": 
    "completa"       → Desenvolve tese e problemática social com unidade temática e postura crítica.
    "tangenciamento" → Aborda apenas o assunto geral, ignorando o recorte temático específico.
    "fuga"           → Assunto desconexo ou gênero não dissertativo.
- "tipo_repertorio": escolha UMA classificação com base na Cartilha INEP 2026:
    "produtivo"           → repertório legitimado de área do conhecimento externa (filosofia, história, sociologia, literatura, cinema, legislação), PERTINENTE ao tema e USADO EFETIVAMENTE para fundamentar a argumentação.
    "legitimado"          → repertório de fonte reconhecida e pertinente, mas apenas citado como autoridade, sem desdobramento analítico profundo.
    "repertorio_de_bolso" → citação memorizada genérica/decorada encaixada de forma forçada sem relação causal com a problemática específica.
    "motivadores"         → fundamentação baseada exclusivamente em dados/ideias dos textos motivadores.
    "inexistente"         → ausência de repertório externo.
- "repertorio_na_introducao": true se houver repertório legitimado/pertinente na introdução.
- "repertorio_nos_desenvolvimentos": true se houver repertório legitimado/pertinente nos desenvolvimentos (D1 e/D2).
- "citacao_repertorio": trecho literal do(s) repertório(s) utilizado(s).

────────────────────────────────────────────────────────────────────────────
C3 — ARGUMENTAÇÃO E PROJETO DE TEXTO:
- "tem_tese_clara": true se há posicionamento/tese identificável na introdução.
- "progressao": 
    "estrategica" → projeto de texto autônomo, maduro e planejado (introdução antecipa argumentos, D1/D2 desenvolvem criticamente com repertórios produtivos sem lacunas, conclusão amarra a tese).
    "clara"       → boa organização de ideias e defesa clara, com pequenos pontos expositivos.
    "previsivel"  → argumentação previsível, mais expositiva do que analítica/crítica.
    "lacunar"     → ideias soltas, saltos temáticos ou lacunas explicativas.
    "ausente"     → texto desordenado ou contraditório.
- "tem_contradicao": true se o texto se contradiz internamente.
- "produtividade_repertorio_analisada": breve comentário sobre como os repertórios sustentam ou deixam de sustentar os argumentos.
- "citacao_tese": trecho literal da tese defendida.

────────────────────────────────────────────────────────────────────────────
C4 — COESÃO E MECANISMOS LINGUÍSTICOS:
- "usa_conectivos_interparagrafos": true se há operadores argumentativos ligando o início dos parágrafos (ex: "Em primeira análise", "Ademais", "Outrossim", "Portanto").
- "usa_conectivos_intraparagrafos": true se há conectores ligando os períodos internos de cada parágrafo (coesão intra e infraparagrafal).
- "contagem_por_categoria": conte inadequações REAIS:
    - "repeticao_lexical": repetição viciosa da mesma palavra de conteúdo no mesmo parágrafo (sem sinônimo).
    - "conector_mal_empregado": conectivo com valor semântico inadequado.
    - "referencia_ambigua": pronome ou anáfora com referente confuso.
- "exemplos": até 3 exemplos com "citacao_texto" e "tipo".

────────────────────────────────────────────────────────────────────────────
C5 — PROPOSTA DE INTERVENÇÃO (5 ELEMENTOS OFICIAIS):
Fatie a proposta principal e verifique a presença explícita dos 5 elementos (Cartilha INEP 2026):
1. "agente":       { "presente": bool, "citacao_texto": "núcleo do agente competente (ex: Ministério da Educação, Governo Federal, escolas)" }
2. "acao":         { "presente": bool, "citacao_texto": "ação propositiva concreta (o que deve ser feito)" }
3. "meio":         { "presente": bool, "citacao_texto": "modo/meio de execução explícito introduzido por estrutura modal (ex: por meio de..., mediante..., através de...)" }
4. "efeito":       { "presente": bool, "citacao_texto": "finalidade/impacto pretendido (ex: a fim de..., para que..., com o fito de...)" }
5. "detalhamento": { "presente": bool, "citacao_texto": "informação adicional que detalha/exemplifica agente, ação, meio ou efeito" }
- "elementos_faltantes": lista de strings indicando quais elementos estão ausentes (ex: ["meio", "detalhamento"]).
- "desrespeito_dh": true SOMENTE se houver incitação direta à violência, tortura, execução sumária ou ódio contra grupos humanos.

────────────────────────────────────────────────────────────────────────────
SISEDU/SPAECE — Descritores avaliados em "Adequado" | "Intermediário" | "Inicial":
D05, D06, D12, D13, D14, D15, D16, D17, D18 com citação e justificativa concisa.

────────────────────────────────────────────────────────────────────────────
FORMATO DE SAÍDA — JSON estrito sem formatação externa:
{
  "c1": {
    "compromete_compreensao": false,
    "estrutura_sintatica": "boa",
    "contagem_por_categoria": {
      "ortografia": 0,
      "concordancia": 0,
      "pontuacao": 0,
      "regencia": 0,
      "crase": 0,
      "acentuacao": 0,
      "escolha_vocabular": 0
    },
    "exemplos": [ { "citacao_texto": "...", "tipo": "ortografia", "explicacao": "..." } ]
  },
  "c2": {
    "quantidade_paragrafos": 4,
    "tem_quatro_paragrafos": true,
    "abordagem_do_tema": "completa",
    "tipo_repertorio": "produtivo",
    "repertorio_na_introducao": true,
    "repertorio_nos_desenvolvimentos": true,
    "citacao_repertorio": "..."
  },
  "c3": {
    "tem_tese_clara": true,
    "progressao": "estrategica",
    "tem_contradicao": false,
    "produtividade_repertorio_analisada": "...",
    "citacao_tese": "..."
  },
  "c4": {
    "usa_conectivos_interparagrafos": true,
    "usa_conectivos_intraparagrafos": true,
    "contagem_por_categoria": {
      "repeticao_lexical": 0,
      "conector_mal_empregado": 0,
      "referencia_ambigua": 0
    },
    "exemplos": [ { "citacao_texto": "...", "tipo": "conector_mal_empregado" } ]
  },
  "c5": {
    "agente":       { "presente": true,  "citacao_texto": "..." },
    "acao":         { "presente": true,  "citacao_texto": "..." },
    "meio":         { "presente": false, "citacao_texto": "" },
    "efeito":       { "presente": true,  "citacao_texto": "..." },
    "detalhamento": { "presente": false, "citacao_texto": "" },
    "elementos_faltantes": ["meio", "detalhamento"],
    "desrespeito_dh": false
  },
  "sisedu": {
    "D05": { "nome": "Interpretação Gráfica/Textual",        "nivel": "Adequado",     "citacao_texto": "...", "justificativa": "..." },
    "D06": { "nome": "Identificação do Tema/Tese",           "nivel": "Adequado",     "citacao_texto": "...", "justificativa": "..." },
    "D12": { "nome": "Coesão e Substituição Lexical",        "nivel": "Intermediário", "citacao_texto": "...", "justificativa": "..." },
    "D13": { "nome": "Localização da Tese Central",          "nivel": "Adequado",     "citacao_texto": "...", "justificativa": "..." },
    "D14": { "nome": "Distinção de Partes Principais/Secundárias", "nivel": "Intermediário", "citacao_texto": "...", "justificativa": "..." },
    "D15": { "nome": "Reconhecimento de Posições Distintas", "nivel": "Inicial",      "citacao_texto": "...", "justificativa": "..." },
    "D16": { "nome": "Articulação de Tese e Argumentos",     "nivel": "Intermediário", "citacao_texto": "...", "justificativa": "..." },
    "D17": { "nome": "Escolha Vocabular e Estilo",           "nivel": "Adequado",     "citacao_texto": "...", "justificativa": "..." },
    "D18": { "nome": "Pontuação e Recursos Expressivos",     "nivel": "Intermediário", "citacao_texto": "...", "justificativa": "..." }
  }
}`;

async function coletarFatos(textoBase, apiKey) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const promptText = `Analise a redação abaixo e reporte APENAS os fatos solicitados. NÃO atribua notas.

TEXTO DA REDAÇÃO:
"""
${textoBase}
"""`;

  const result = await generateContentWithFallback(
    genAI,
    {
      systemInstruction: AVALIACAO_SYSTEM_PROMPT,
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
        topP: 0.85,
        topK: 20,
      },
    },
    promptText
  );

  return cleanAndParseJSON(result.response.text());
}

/* ============================================================================
 * ETAPA 3 — CÁLCULO DAS NOTAS
 * ==========================================================================*/

const DEGRAUS = [0, 40, 80, 120, 160, 200];

function clampDegrau(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return DEGRAUS.reduce((best, d) => Math.abs(d - n) < Math.abs(best - n) ? d : best, 0);
}

function numeroSeguro(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/* Categorias de C1 agrupadas por sensibilidade a OCR:
 *   HARD: ortografia, concordancia, regencia, escolha_vocabular
 *         (não dependem de ler um diacrítico — mais confiáveis)
 *   SOFT: pontuacao, crase, acentuacao
 *         (dependem de detectar um acento/caractere — muito sensíveis a OCR)
 */
const C1_HARD = ['ortografia', 'concordancia', 'regencia', 'escolha_vocabular'];
const C1_SOFT = ['pontuacao', 'crase', 'acentuacao'];
const C1_SOFT_CAP = 2; // soma máxima que categorias soft podem contribuir

/**
 * Conta desvios de C1 com duas regras de robustez:
 *
 *  1. Redução de fantasma: categoria com count > 0 mas SEM exemplo
 *     correspondente em `exemplos` é reduzida para 0. Isso evita que o
 *     modelo invente números sem citação.
 *
 *  2. Cap de soft: a soma das categorias sensíveis a OCR (pontuação, crase,
 *     acentuação) é limitada a C1_SOFT_CAP. Variação de OCR entre 0 e 3
 *     crases não muda a nota.
 */
function contarDesviosC1Robusto(c1) {
  const cat = c1?.contagem_por_categoria || {};
  const exemplos = Array.isArray(c1?.exemplos) ? c1.exemplos : [];

  // Tipos presentes nos exemplos (para validação)
  // Filtra qualquer falso desvio que contenha hífen de translineação
  const exemplosValidos = exemplos.filter(e => {
    const cit = (e?.citacao_texto || '').trim();
    if (cit.includes('-\\n') || cit.includes('- ') || cit.includes('-\n')) {
      return false; // descarta falsos erros de translineação
    }
    return true;
  });

  const tiposComExemplo = new Set(
    exemplosValidos
      .map(e => (e?.tipo || '').trim())
      .filter(Boolean)
  );

  // Contagem hard: se há exemplos reportados no total, soma desvios reais das categorias
  let hardTotal = 0;
  for (const tipo of C1_HARD) {
    const n = numeroSeguro(cat[tipo]);
    if (n > 0) {
      if (tiposComExemplo.has(tipo) || tiposComExemplo.size >= 1) {
        hardTotal += n;
      } else {
        hardTotal += Math.min(n, 1);
      }
    }
  }

  // Contagem soft: soma de categorias sensíveis a OCR capada
  let softBruto = 0;
  for (const tipo of C1_SOFT) {
    softBruto += numeroSeguro(cat[tipo]);
  }
  const softTotal = Math.min(softBruto, C1_SOFT_CAP);

  const totalEfetivo = hardTotal + softTotal;

  return {
    totalEfetivo,
    hardTotal,
    softBruto,
    softTotal,
    categoriasComExemplo: [...tiposComExemplo],
    exemplos: exemplosValidos,
  };
}

/* ---- C1 ----
 * Bandas oficiais INEP (com totalEfetivo capado e ponderado):
 *   0-1 desvios e sintaxe excelente/boa   → 200 (excepcionalidade)
 *   2-4 desvios (poucos desvios)         → 160 (bom domínio)
 *   5-10 desvios                         → 120 (domínio mediano)
 *   11-16 desvios                        → 80  (domínio insuficiente)
 *   17+ desvios                          → 40  (domínio precário)
 */
export function calcularNotaC1(c1) {
  const compromete = c1?.compromete_compreensao === true;
  const cat = c1?.contagem_por_categoria || {};

  const { totalEfetivo, hardTotal, softBruto, softTotal, categoriasComExemplo, exemplos } =
    contarDesviosC1Robusto(c1);

  let nota;
  if (totalEfetivo <= 1) nota = 200;
  else if (totalEfetivo <= 5) nota = 160;
  else if (totalEfetivo <= 10) nota = 120;
  else if (totalEfetivo <= 16) nota = 80;
  else nota = 40;

  if (compromete) nota = Math.min(nota, 80);

  return {
    nota,
    contagem: Object.values(cat).reduce((a, b) => a + numeroSeguro(b), 0),
    contagemEfetiva: totalEfetivo,
    hardTotal,
    softBruto,
    softTotal,
    contagemPorCategoria: cat,
    categoriasComExemplo,
    exemplos,
  };
}

/* ---- C2 ---- */
export function calcularNotaC2(c2) {
  const abordagem = c2?.abordagem_do_tema;
  const repertorio = c2?.tipo_repertorio;
  const temQuatroParagrafos = c2?.tem_quatro_paragrafos !== false && (c2?.quantidade_paragrafos === undefined || Number(c2?.quantidade_paragrafos) >= 4);

  if (abordagem === 'fuga') return { nota: 0 };
  if (abordagem === 'tangenciamento') return { nota: 40 };

  if (abordagem === 'completa') {
    if (repertorio === 'produtivo') {
      // 4 parágrafos com repertórios legítimos, pertinentes e produtivos = 200. Sem os 4 parágrafos completos = 160.
      return { nota: temQuatroParagrafos ? 200 : 160 };
    }
    if (repertorio === 'legitimado') return { nota: 160 };
    // Argumentação previsível / senso comum / repertório de bolso com abordagem completa = 120 (Nível 3 Oficial INEP)
    if (repertorio === 'repertorio_de_bolso' || repertorio === 'motivadores' || repertorio === 'inexistente') {
      return { nota: 120 };
    }
    return { nota: 120 };
  }

  if (repertorio === 'produtivo' || repertorio === 'legitimado') return { nota: 120 };
  if (repertorio === 'repertorio_de_bolso' || repertorio === 'motivadores') return { nota: 80 };
  return { nota: 40 };
}

/* ---- C3 ---- */
export function calcularNotaC3(c3, c2) {
  const fugiu = c2?.abordagem_do_tema === 'fuga';
  if (fugiu) return { nota: 0 };

  const progressao = c3?.progressao;
  const contradicao = c3?.tem_contradicao === true;
  const teseClara = c3?.tem_tese_clara === true;
  const semRepertorio = c2?.tipo_repertorio === 'inexistente' || c2?.tipo_repertorio === 'motivadores' || c2?.tipo_repertorio === 'repertorio_de_bolso';

  let nota;
  if (contradicao || progressao === 'ausente') nota = 0;
  else if (progressao === 'lacunar') nota = 80;
  else if (progressao === 'previsivel') nota = 120;
  else if (progressao === 'clara') nota = 160;
  else if (progressao === 'estrategica') nota = 200;
  else nota = 80;

  if (!teseClara && nota > 120) nota = 120;
  // Redação sem repertório externo legitimado que permanece no senso comum tem teto oficial de 120 em C3 (Nível 3 INEP)
  if (semRepertorio && nota > 120) nota = 120;

  return { nota };
}

/* ---- C4 ----
 * Bandas:
 *   0-1      → 200
 *   2-3      → 160
 *   4-6      → 120
 *   7-9      → 80
 *   10+      → 40
 */
export function calcularNotaC4(c4) {
  const inter = c4?.usa_conectivos_interparagrafos === true;
  const intra = c4?.usa_conectivos_intraparagrafos === true;
  const cat = c4?.contagem_por_categoria || {};
  const exemplos = Array.isArray(c4?.exemplos) ? c4.exemplos : [];

  let contagem = 0;
  for (const v of Object.values(cat)) {
    contagem += numeroSeguro(v);
  }

  if (!inter && !intra) {
    return { nota: 40, contagem, contagemPorCategoria: cat, exemplos };
  }

  let nota;
  if (contagem <= 1) nota = 200;
  else if (contagem <= 3) nota = 160;
  else if (contagem <= 6) nota = 120;
  else if (contagem <= 9) nota = 80;
  else nota = 40;

  if (!inter) nota = Math.min(nota, 160);
  if (!intra) nota = Math.min(nota, 120);

  return { nota, contagem, contagemPorCategoria: cat, exemplos };
}

/* ---- C5 ---- */
const ELEMENTOS_C5 = ['agente', 'acao', 'meio', 'efeito', 'detalhamento'];

export function calcularNotaC5(c5, c2) {
  const fugiu = c2?.abordagem_do_tema === 'fuga';

  if (c5?.desrespeito_dh === true) {
    return { nota: 0, elementos: {}, desrespeito_dh: true };
  }
  if (fugiu) {
    return { nota: 0, elementos: {}, desrespeito_dh: false };
  }

  const presentes = {};
  let qtd = 0;
  for (const el of ELEMENTOS_C5) {
    const ok = c5?.[el]?.presente === true && !!(c5?.[el]?.citacao_texto || '').trim();
    presentes[el] = ok;
    if (ok) qtd++;
  }

  const agenteCit = (c5?.agente?.citacao_texto || '').toLowerCase().trim();
  const detalhCit = (c5?.detalhamento?.citacao_texto || '').toLowerCase().trim();
  if (agenteCit && detalhCit && agenteCit === detalhCit) {
    if (presentes.agente && !presentes.detalhamento) { presentes.detalhamento = true; qtd++; }
    else if (presentes.detalhamento && !presentes.agente) { presentes.agente = true; qtd++; }
  }

  const nota = qtd * 40;

  return { nota, elementos: presentes, desrespeito_dh: false };
}

/* ============================================================================
 * ETAPA 4 — DEVOLUTIVA PEDAGÓGICA (PADRÃO OFICIAL INEP 2026)
 * ==========================================================================*/

async function gerarDevolutiva(notas, fatos, textoBase, apiKey) {
  const genAI = new GoogleGenerativeAI(apiKey);

  const resumoNotas = `
NOTAS OFICIAIS DO ENEM JÁ CALCULADAS (APLICAÇÃO ESTRITA 0, 40, 80, 120, 160, 200):
  Competência 1 = ${notas.c1} / 200
  Competência 2 = ${notas.c2} / 200
  Competência 3 = ${notas.c3} / 200
  Competência 4 = ${notas.c4} / 200
  Competência 5 = ${notas.c5} / 200
  TOTAL ENEM = ${notas.total} / 1000
`;

  const system = `Você é um corretor oficial do ENEM, altamente criterioso e fiel à Cartilha do Corretor do INEP 2026.

Sua devolutiva deve ser CONCISA, CRITERIOSA, PRECISA e DIRETA AO PONTO, estruturada exatamente por competência e destacando com exemplos os desvios e o diagnóstico rápido de evolução.

REGRAS OBRIGATÓRIAS DE FORMATAÇÃO DA DEVOLUTIVA:
- C1: Aponte os erros gramaticais, ortográficos e de letra ilegível com exemplos literais. Se houver reincidência de erro, aponte a penalização.
- C2: Analise compreensão do tema, respeito à estrutura de 4 parágrafos e o uso de repertórios na introdução e desenvolvimentos (legitimidade, pertinência e produtividade).
- C3: Analise projeto de texto, progressão argumentativa, coerência e produtividade dos repertórios.
- C4: Analise conectivos interparagrafais e intraparagrafais (infraparagrafais), repetições lexicais e articulação.
- C5: Confira os 5 elementos (Agente, Ação, Meio/Modo, Efeito, Detalhamento). Aponte claramente o que está presente e o que falta (cada elemento ausente desconta 40 pontos).
- NOTA FINAL: ${notas.total}/1000
- DIAGNÓSTICO RÁPIDO: síntese direta do que o aluno mais precisa melhorar para a próxima redação.

FORMATO DE SAÍDA — JSON estrito:
{
  "devolutiva_enem": "C1 - Norma culta: Nota ${notas.c1}\\nDesvios: [Aponte erros gramaticais, ortográficos e de legibilidade com exemplos]\\n\\nC2 - Tema: Nota ${notas.c2}\\nDesvios: [Analise abordagem do tema, estrutura de 4 parágrafos e repertórios]\\n\\nC3 - Argumentação: Nota ${notas.c3}\\nDesvios: [Analise projeto de texto, progressão e produtividade dos argumentos]\\n\\nC4 - Coesão: Nota ${notas.c4}\\nDesvios: [Analise conectivos inter e intraparagrafais e repetições]\\n\\nC5 - Intervenção: Nota ${notas.c5}\\nDesvios: [Análise dos 5 elementos da intervenção: Agente, Ação, Meio/Modo, Efeito, Detalhamento. Aponte o que falta]\\n\\nNOTA FINAL: ${notas.total}/1000\\n\\nDIAGNÓSTICO RÁPIDO: [O que mais precisa melhorar]",
  "devolutiva_sisedu": "Diagnóstico SPAECE/SISEDU:\\n• Pontos Fortes: [breve]\\n• Fragilidades: [breve]\\n• Recomendação: [breve]"
}`;

  const user = `${resumoNotas}

FATOS TÉCNICOS:
${JSON.stringify(fatos, null, 2)}

TEXTO DO ESTUDANTE:
"""
${textoBase}
"""

Gere o parecer conciso e rigoroso.`;

  const result = await generateContentWithFallback(
    genAI,
    {
      systemInstruction: system,
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
        topP: 0.85,
        topK: 20,
      },
    },
    user
  );

  return cleanAndParseJSON(result.response.text());
}

/* ============================================================================
 * ORQUESTRADOR PRINCIPAL
 * ==========================================================================*/

export async function agenteAvaliadorUnificado(
  imagemBase64,
  textoDigitado,
  nomeFornecido,
  turmaFornecida,
  apiKey,
  opcoes = {}
) {
  const usarCache = opcoes.usarCache === true;

  let textoBase = textoDigitado;
  let alunoDetectado = nomeFornecido;
  let turmaDetectada = turmaFornecida;
  let confianca = 'ALTA';
  let motivoIncerteza = 'Texto fornecido diretamente';
  let duvidasTranscricao = [];

  if ((!textoBase || textoBase.trim().length === 0) && imagemBase64 && imagemBase64.trim().length > 0) {
    const transcricao = await transcreverRedacao(imagemBase64, apiKey);
    textoBase = transcricao.texto_transcrito;
    alunoDetectado = nomeFornecido || transcricao.aluno_detectado;
    turmaDetectada = turmaFornecida || transcricao.turma_detectada;
    confianca = transcricao.confianca_identificacao;
    motivoIncerteza = transcricao.motivo_incerteza_identificacao;
    duvidasTranscricao = Array.isArray(transcricao.duvidas_transcricao) ? transcricao.duvidas_transcricao : [];
  }

  if (!textoBase || textoBase.trim().length === 0) {
    throw new Error('Nenhum texto disponível para avaliação.');
  }

  const hash = hashTexto(textoBase);
  if (usarCache) {
    const cacheado = await cacheGet(hash);
    if (cacheado) {
      return {
        ...cacheado,
        aluno: alunoDetectado || cacheado.aluno || null,
        turma: turmaDetectada || cacheado.turma || null,
        confianca_identificacao: confianca,
        motivo_incerteza_identificacao: motivoIncerteza,
        texto_transcrito: textoBase,
        duvidas_transcricao: duvidasTranscricao,
        cache_hit: true,
        _hash: hash,
      };
    }
  }

  const fatos = await coletarFatos(textoBase, apiKey);

  const c1 = calcularNotaC1(fatos.c1);
  const c2 = calcularNotaC2(fatos.c2);
  const c3 = calcularNotaC3(fatos.c3, fatos.c2);
  const c4 = calcularNotaC4(fatos.c4);
  const c5 = calcularNotaC5(fatos.c5, fatos.c2);

  const notas = {
    c1: c1.nota,
    c2: c2.nota,
    c3: c3.nota,
    c4: c4.nota,
    c5: c5.nota,
    total: c1.nota + c2.nota + c3.nota + c4.nota + c5.nota,
  };

  const devolutiva = await gerarDevolutiva(notas, fatos, textoBase, apiKey);

  const resultado = {
    aluno: alunoDetectado || null,
    turma: turmaDetectada || null,
    confianca_identificacao: confianca,
    motivo_incerteza_identificacao: motivoIncerteza,
    texto_transcrito: textoBase,
    duvidas_transcricao: duvidasTranscricao,

    devolutiva_enem: devolutiva.devolutiva_enem,
    devolutiva_sisedu: devolutiva.devolutiva_sisedu,

    avaliacoes: {
      enem: {
        competencia_1: {
          nota: c1.nota,
          contagem_desvios: c1.contagem,
          contagem_efetiva: c1.contagemEfetiva,
          hard_total: c1.hardTotal,
          soft_bruto: c1.softBruto,
          soft_total: c1.softTotal,
          categorias_com_exemplo: c1.categoriasComExemplo,
          contagem_por_categoria: c1.contagemPorCategoria,
          desvios: c1.exemplos,
          citacao_texto: c1.exemplos[0]?.citacao_texto || '',
          justificativa: `C1: bruto=${c1.contagem}, hard=${c1.hardTotal}, soft=${c1.softTotal} (de ${c1.softBruto} brutos), efetivo=${c1.contagemEfetiva}.`,
        },
        competencia_2: {
          nota: c2.nota,
          citacao_texto: fatos.c2?.citacao_repertorio || '',
          justificativa: `Abordagem: ${fatos.c2?.abordagem_do_tema}; repertório: ${fatos.c2?.tipo_repertorio}.`,
        },
        competencia_3: {
          nota: c3.nota,
          citacao_texto: fatos.c3?.citacao_tese || '',
          justificativa: `Progressão: ${fatos.c3?.progressao}; tese clara: ${fatos.c3?.tem_tese_clara}; contradição: ${fatos.c3?.tem_contradicao}.`,
        },
        competencia_4: {
          nota: c4.nota,
          contagem_inadequacoes: c4.contagem,
          contagem_por_categoria: c4.contagemPorCategoria,
          inadequacoes: c4.exemplos,
          citacao_texto: c4.exemplos[0]?.citacao_texto || '',
          justificativa: `Conectivos inter: ${fatos.c4?.usa_conectivos_interparagrafos}; intra: ${fatos.c4?.usa_conectivos_intraparagrafos}; ${c4.contagem} inadequação(ões).`,
        },
        competencia_5: {
          nota: c5.nota,
          elementos_finais: c5.elementos,
          desrespeito_dh: c5.desrespeito_dh,
        },
        nota_total_enem: notas.total,
      },
      sisedu: {
        descritores: fatos.sisedu || {},
        dimensao_etico_critica: {
          empatia_alteridade: {
            nivel: c5.nota >= 160 ? 'Avançado' : (c5.nota >= 120 ? 'Adequado' : 'Inicial'),
            justificativa: c5.nota >= 160 
              ? 'Demonstra forte sensibilidade em relação ao sofrimento alheio e à superação de preconceitos estruturais contra a população vulnerável.'
              : (c5.nota >= 120 ? 'Reconhece a condição dos grupos sociais afetados pela temática, mantendo postura respeitosa e alinhada aos direitos humanos.' : 'Apresenta abordagem incipiente da alteridade, necessitando de maior aprofundamento sobre a empatia com os grupos vulneráveis.')
          },
          justificacao_moral: {
            nivel: (c3.nota >= 160 && c5.nota >= 120) ? 'Avançado' : (c3.nota >= 120 ? 'Adequado' : 'Inicial'),
            justificativa: (c3.nota >= 160 && c5.nota >= 120)
              ? 'Fundamenta a necessidade de justiça social com base em princípios éticos de responsabilidade coletiva e dignidade humana.'
              : (c3.nota >= 120 ? 'Articula valores cívicos e responsabilidade social de forma pertinente ao longo da fundamentação argumentativa.' : 'Fundamentação moral e ética básica, demandando articulação mais sólida dos valores de cidadania e bem coletivo.')
          },
          conclusao_critica: {
            nivel: c5.nota >= 160 ? 'Avançado' : (c5.nota >= 120 ? 'Adequado' : 'Inicial'),
            justificativa: c5.nota >= 160
              ? 'A conclusão vai além da mera burocracia estatal, propondo uma transformação cultural e solidária na mentalidade da sociedade.'
              : (c5.nota >= 120 ? 'Apresenta proposta de intervenção consistente e aplicável para o enfrentamento prático da problemática.' : 'Proposta de intervenção restrita ou elementar, necessitando de maior detalhamento e visão transformadora.')
          }
        }
      },
    },

    nota_final: notas.total,
    cache_hit: false,
    _hash: hash,
    _fatos_brutos: fatos,
  };

  if (usarCache) {
    await cacheSet(hash, resultado);
  }

  return resultado;
}

/* ============================================================================
 * MODO DE TESTE
 * ==========================================================================*/

function modaNumerica(arr) {
  if (!arr || arr.length === 0) return null;
  const m = new Map();
  for (const v of arr) m.set(v, (m.get(v) || 0) + 1);
  let melhor = arr[0], maxFreq = 0;
  for (const [v, f] of m) if (f > maxFreq) { maxFreq = f; melhor = v; }
  return melhor;
}

function estatisticas(arr) {
  return {
    min: Math.min(...arr),
    max: Math.max(...arr),
    range: Math.max(...arr) - Math.min(...arr),
    moda: modaNumerica(arr),
    valores: arr,
  };
}

export async function avaliarRedacaoN(
  imagemBase64,
  textoDigitado,
  nomeFornecido,
  turmaFornecida,
  apiKey,
  n = 5
) {
  if (!Number.isFinite(n) || n < 1) {
    throw new Error('n deve ser um inteiro >= 1.');
  }

  const resultados = [];
  for (let i = 0; i < n; i++) {
    const r = await agenteAvaliadorUnificado(
      imagemBase64,
      textoDigitado,
      nomeFornecido,
      turmaFornecida,
      apiKey,
      { usarCache: false }
    );
    resultados.push(r);
  }

  const notasTotais = resultados.map(r => r.nota_final);
  const c1s = resultados.map(r => r.avaliacoes.enem.competencia_1.nota);
  const c2s = resultados.map(r => r.avaliacoes.enem.competencia_2.nota);
  const c3s = resultados.map(r => r.avaliacoes.enem.competencia_3.nota);
  const c4s = resultados.map(r => r.avaliacoes.enem.competencia_4.nota);
  const c5s = resultados.map(r => r.avaliacoes.enem.competencia_5.nota);

  const est = {
    n_execucoes: n,
    total: estatisticas(notasTotais),
    c1: estatisticas(c1s),
    c2: estatisticas(c2s),
    c3: estatisticas(c3s),
    c4: estatisticas(c4s),
    c5: estatisticas(c5s),
    estavel: new Set(notasTotais).size === 1,
  };

  const compsQueVariaram = ['c1', 'c2', 'c3', 'c4', 'c5'].filter(c => est[c].range > 0);

  const veredito = est.estavel
    ? `✅ Estável: todas as ${n} execuções deram ${notasTotais[0]} pontos.`
    : `⚠️  Instável: notas entre ${est.total.min} e ${est.total.max} (range ${est.total.range}). ` +
    `Competência(s) que variaram: ${compsQueVariaram.join(', ')}.`;

  return {
    resultados,
    estatisticas: est,
    veredito,
  };
}

/* ============================================================================
 * MOCK
 * ==========================================================================*/

export function getMockENEMEvaluation(id, textoDigitado, nomeFornecido, turmaFornecida) {
  const isIdentified = !!nomeFornecido || Number(id) % 2 !== 0;
  const mockNames = [
    'Mariana Souza de Oliveira',
    'Lucas Gabriel Ferreira',
    'Beatriz Mendes da Silva',
    'Gabriel Santos Rocha',
  ];
  const selectedName = nomeFornecido || (isIdentified
    ? mockNames[Math.floor(Math.random() * mockNames.length)]
    : null);
  const selectedTurma = turmaFornecida || (isIdentified ? '3º Ano A - Ensino Médio' : null);
  const sampleTexts = [
    "No contexto da sociedade contemporânea, os desafios para a preservação da biodiversidade na Amazônia tornam-se cada vez mais prementes. Em primeira análise, cabe destacar que a falta de fiscalização governamental intensifica o desmatamento ilegal. Ademais, o sociólogo Zygmunt Bauman, em sua obra 'Modernidade Líquida', ressalta a fragilidade das instituições no combate às crises socioambientais. Portanto, medidas urgentes são necessárias para mitigar essa problemática.",
    "A democratização do acesso ao cinema no Brasil apresenta entraves históricos e socioeconômicos. Sob essa ótica, verifica-se que o alto custo dos ingressos e a concentração das salas de exibição em grandes centros urbanos marginalizam a população periférica. Como dizia Kant, o ser humano é aquilo que a educação faz dele, evidenciando a necessidade de ampliação cultural no país.",
  ];
  const transcriptText = textoDigitado || `[MODO DEMONSTRAÇÃO]\n\n${sampleTexts[Number(id) % sampleTexts.length]}`;

  return {
    aluno: selectedName,
    turma: selectedTurma,
    texto_transcrito: transcriptText,
    avaliacoes: {
      enem: {
        competencia_1: { nota: 200, citacao_texto: "...", justificativa: "..." },
        competencia_2: { nota: 200, citacao_texto: "...", justificativa: "..." },
        competencia_3: { nota: 160, citacao_texto: "...", justificativa: "..." },
        competencia_4: { nota: 200, citacao_texto: "...", justificativa: "..." },
        competencia_5: {
          nota: 160,
          elementos_finais: { agente: true, acao: true, meio: false, efeito: true, detalhamento: true },
        },
        nota_total_enem: 920,
      },
      sisedu: { nivel_global: 'Intermediário', descritores: {} },
    },
    nota_final: 920,
    cache_hit: false,
  };
}