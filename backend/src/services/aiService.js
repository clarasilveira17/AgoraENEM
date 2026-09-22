import { GoogleGenerativeAI } from '@google/generative-ai';
import crypto from 'crypto';
import { generateContentWithFallback } from '../config/gemini.js';

/* ============================================================================
 * PARSER / REPARO DE JSON
 * ==========================================================================*/

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
  let cleaned = rawText.trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const startIdx = cleaned.indexOf('{');
  const endIdx = cleaned.lastIndexOf('}');
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    cleaned = cleaned.substring(startIdx, endIdx + 1);
  }

  try { return JSON.parse(cleaned); } catch (e) {
    console.warn(`[JSON Parser] Tentativa 1 falhou: ${e.message}`);
  }
  try { return JSON.parse(repairJsonString(cleaned)); } catch (e) {
    console.warn(`[JSON Parser] Tentativa 2 falhou: ${e.message}`);
  }
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
 * ETAPA 1 — TRANSCRIÇÃO
 * ==========================================================================*/

const TRANSCRICAO_SYSTEM_PROMPT = `Você é um transcritor especializado em manuscritos escolares de redação.

TAREFA: Transcreva EXATAMENTE o texto manuscrito na imagem, preservando as linhas físicas (Linha 01 a Linha 30) com a quebra de linha '\\n' correspondente.

REGRAS DE LEITURA E CALIGRAFIA (MUITO IMPORTANTE):
1. FIDELIDADE VISUAL: Transcreva o que está escrito no papel. Não invente acentos, não adicione tremas (ü) — que não existem no português atual —, nem crie letras que não estejam nitidamente desenhadas.
2. AMBIGUIDADES CALIGRÁFICAS: A caligrafia cursiva pode fazer com que letras como 'o' e 'a' pareçam semelhantes, ou que o 'b' se assemelhe a um 's'. 
   - SE a letra for ambígua, dê sempre o benefício da dúvida ao aluno e transcreva a forma correta e natural da palavra no contexto (ex: se o 'o' parecer um 'a', transcreva 'o').
   - NUNCA invente incorreções ortográficas que o aluno não cometeu só porque o traço é feio.
3. Não corrija a gramática real do aluno (como a omissão clara de uma letra numa palavra, ex: "igressar" sem 'n'), mas garanta que falhas puramente visuais da caligrafia não se tornem erros fantásticos no texto transcrito.

Responda APENAS com este JSON estrito, sem comentários, sem markdown:
{
  "texto_transcrito": "Linha 1...\\nLinha 2...\\nLinha 3...",
  "aluno_detectado": "nome extraído do cabeçalho ou null",
  "turma_detectada": "turma extraída do cabeçalho ou null",
  "confianca_identificacao": "ALTA|MEDIA|BAIXA",
  "motivo_incerteza_identificacao": "breve nota sobre legibilidade"
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

  return cleanAndParseJSON(result.response.text());
}

/* ============================================================================
 * ETAPA 2 — COLETA DE FATOS
 * ==========================================================================*/

const AVALIACAO_SYSTEM_PROMPT = `Você é um AVALIADOR E ANALISTA TEXTUAL OFICIAL DO ENEM (padrão INEP / Cartilha do Participante 2026).
Sua missão é extrair e reportar com máxima precisão e imparcialidade os FATOS observáveis sobre a redação.
Você compreende a intenção comunicativa do estudante, mantendo o olhar crítico e técnico de um especialista em Linguística e Letras, diferenciando problemas estruturais reais de meros lapsos pontuais de caligrafia ou transcrição.

REGRA FUNDAMENTAL: Toda constatação de desvio, repertório, tese ou elemento interventivo deve ser comprovada com citação literal (ou trecho mais próximo) do texto transcrito.

════════════════════════════════════════════════════════════════════════════
REGRA DE ESCOPO E IDENTIFICAÇÃO:
Considere APENAS o corpo do texto. IGNORE completamente dados de cabeçalho (nome do aluno, turma, escola, data, assinatura ou palavras soltas no início como "Redação" ou "Filosofia").
════════════════════════════════════════════════════════════════════════════

────────────────────────────────────────────────────────────────────────────
C1 — FATOS SOBRE DOMÍNIO DA MODALIDADE ESCRITA FORMAL:
- "compromete_compreensao": true SOMENTE se as falhas sintáticas ou desvios tornarem o raciocínio ininteligível. Se o sentido foi claramente compreendido, é false.
- "estrutura_sintatica": "excelente" (períodos complexos subordinados fluidos) | "boa" (períodos bem estruturados com poucos truncamentos) | "regular" | "precaria" | "inexistente".
- "contagem_por_categoria": conte os desvios REAIS do corpo do texto:
    - "ortografia": erros reais de grafia
    - "concordancia": concordância verbal ou nominal legítima do aluno
    - "pontuacao": vírgula separando sujeito/predicado, falta de ponto final, etc.
    - "regencia": verbal ou nominal
    - "crase": omissão ou uso indevido
    - "acentuacao": falta ou excesso de acentuação
    - "escolha_vocabular": vocabulário inadequado/impreciso
  Se não houver desvios em uma categoria, preencha 0.

REGRAS ESPECIAIS DE OCR E CALIGRAFIA:
1. TRANSLINEAÇÃO: Hífen de quebra de linha ('-\\n') com divisão silábica correta NUNCA é erro de pontuação nem de ortografia.
2. TROCA 'O' vs 'A' DO OCR: Trocas pontuais isoladas de gênero (ex.: "processo mais complicada") devem ser presumidas como falha do OCR e NÃO contabilizadas em concordância.
3. REGRA DE 1 LETRA (LAPSOS ISOLADOS): Omissão/troca de apenas 1 letra em palavra não reincidente deve ser ponderada como lapso leve.

- "exemplos": lista com até 5 desvios mais relevantes ("citacao_texto" e "tipo").

────────────────────────────────────────────────────────────────────────────
C2 — FATOS SOBRE TEMA, GÊNERO E REPERTÓRIO SOCIOCULTURAL:
- "abordagem_do_tema": 
    "completa"       → aborda todos os elementos do recorte temático.
    "tangenciamento" → aborda apenas o assunto genérico mais amplo, omitindo o recorte central.
    "fuga"           → desenvolve assunto completamente desconexo da proposta.

- "tipo_repertorio": escolha UMA classificação com base na Cartilha INEP 2026:
    "produtivo"           → repertório legitimado de área do conhecimento externa (filosofia, história, sociologia, literatura, cinema, dados), PERTINENTE ao tema e USADO PARA FUNDAMENTAR o argumento (não apenas citado).
    "legitimado"          → repertório de fonte reconhecida e pertinente, mas apenas citado como autoridade, sem desdobramento analítico profundo.
    "repertorio_de_bolso" → citação memorizada genérica/decorada (ex: Platão/"A República", Aristóteles/"animal político", "Constituição de 1988" superficial) encaixada de forma forçada sem relação causal com a problemática específica.
    "motivadores"         → fundamentação baseada exclusivamente em dados/ideias dos textos motivadores.
    "inexistente"         → ausência de repertório externo.

- "citacao_repertorio": trecho literal do repertório utilizado (ou "" se inexistente).

────────────────────────────────────────────────────────────────────────────
C3 — FATOS SOBRE PROJETO DE TEXTO E COERÊNCIA:
- "tem_tese_clara": true se há posicionamento/tese identificável na introdução.
- "progressao": 
    "estrategica" → projeto de texto autônomo e maduro, com planejamento evidente (introdução antecipa argumentos, D1/D2 desenvolvem com análise crítica sem lacunas, conclusão amarra a tese).
    "clara"       → boa organização de ideias e defesa clara, com pequenos pontos descritivos.
    "previsivel"  → argumentação previsível, mais expositiva do que crítica.
    "lacunar"     → ideias soltas, saltos temáticos ou lacunas explicativas.
    "ausente"     → texto desordenado ou contraditório.
- "tem_contradicao": true se o texto se contradiz internamente.
- "citacao_tese": trecho literal da tese defendida.

────────────────────────────────────────────────────────────────────────────
C4 — FATOS SOBRE MECANISMOS DE COESÃO:
- "usa_conectivos_interparagrafos": true se há operadores argumentativos ligando o início dos parágrafos (ex: "Em primeira análise", "Ademais", "Outrossim", "Portanto").
- "usa_conectivos_intraparagrafos": true se há conectivos ligando os períodos internos de cada parágrafo.
- "contagem_por_categoria": conte inadequações REAIS:
    - "repeticao_lexical": repetição viciosa da mesma palavra de conteúdo no mesmo parágrafo (sem sinônimo).
    - "conector_mal_empregado": conectivo com valor semântico inadequado (ex: "portanto" com sentido de oposição).
    - "referencia_ambigua": pronome ou anáfora cujo referente fica confuso.
- "exemplos": até 3 exemplos com "citacao_texto" e "tipo".

────────────────────────────────────────────────────────────────────────────
C5 — FATOS SOBRE A PROPOSTA DE INTERVENÇÃO (5 ELEMENTOS OFICIAIS):
Fatie a proposta principal e verifique a presença explícita dos 5 elementos (Cartilha INEP 2026):
1. "agente":       { "presente": bool, "citacao_texto": "núcleo do agente competente (ex: Ministério da Saúde)" }
2. "acao":         { "presente": bool, "citacao_texto": "ação propositiva concreta (não mera constatação passiva)" }
3. "meio":         { "presente": bool, "citacao_texto": "modo/meio de execução (ex: por meio de projetos nas escolas)" }
4. "efeito":       { "presente": bool, "citacao_texto": "finalidade/impacto pretendido (ex: a fim de reduzir o etarismo)" }
5. "detalhamento": { "presente": bool, "citacao_texto": "informação adicional que detalha/exemplifica agente, ação, meio ou efeito" }
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
    "exemplos": [ { "citacao_texto": "...", "tipo": "ortografia" } ]
  },
  "c2": {
    "abordagem_do_tema": "completa",
    "tipo_repertorio": "produtivo",
    "citacao_repertorio": "..."
  },
  "c3": {
    "tem_tese_clara": true,
    "progressao": "estrategica",
    "tem_contradicao": false,
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

  // Tipos presentes nos exemplos (para detectar fantasmas)
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

  // Contagem hard: só conta se há pelo menos 1 exemplo do tipo
  let hardTotal = 0;
  for (const tipo of C1_HARD) {
    const n = numeroSeguro(cat[tipo]);
    if (n > 0 && tiposComExemplo.has(tipo)) hardTotal += n;
  }

  // Contagem soft: soma bruta (com ou sem exemplo), capada
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
 *   2-4 desvios (ou até 5 desvios leves) → 160 (bom domínio, poucos desvios)
 *   5-10 desvios                         → 120 (domínio mediano)
 *   11-16 desvios                        → 80  (domínio insuficiente)
 *   17+ desvios                          → 40  (domínio precário)
 */
function calcularNotaC1(c1) {
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
function calcularNotaC2(c2) {
  const abordagem = c2?.abordagem_do_tema;
  const repertorio = c2?.tipo_repertorio;

  if (abordagem === 'fuga') return { nota: 0 };
  if (abordagem === 'tangenciamento') return { nota: 40 };

  if (abordagem === 'completa') {
    if (repertorio === 'produtivo') return { nota: 200 };
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
function calcularNotaC3(c3, c2) {
  const tangenciou = c2?.abordagem_do_tema === 'tangenciamento';
  const fugiu = c2?.abordagem_do_tema === 'fuga';
  if (fugiu) return { nota: 0 };

  const progressao = c3?.progressao;
  const contradicao = c3?.tem_contradicao === true;
  const teseClara = c3?.tem_tese_clara === true;

  let nota;
  if (contradicao || progressao === 'ausente') nota = 0;
  else if (progressao === 'lacunar') nota = 80;
  else if (progressao === 'previsivel') nota = 120;
  else if (progressao === 'clara') nota = 160;
  else if (progressao === 'estrategica') nota = 200;
  else nota = 80;

  if (!teseClara && nota > 120) nota = 120;
  if (tangenciou) nota = Math.min(nota, 40);

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
function calcularNotaC4(c4) {
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

function calcularNotaC5(c5, c2) {
  const fugiu = c2?.abordagem_do_tema === 'fuga';
  const tangenciou = c2?.abordagem_do_tema === 'tangenciamento';

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

  let nota = qtd * 40;
  if (tangenciou) nota = Math.min(nota, 40);

  return { nota, elementos: presentes, desrespeito_dh: false };
}

/* ============================================================================
 * ETAPA 4 — DEVOLUTIVA PEDAGÓGICA (CONCISA, DIRETA E HUMANA - PADRÃO INEP 2026)
 * ==========================================================================*/

async function gerarDevolutiva(notas, fatos, textoBase, apiKey) {
  const genAI = new GoogleGenerativeAI(apiKey);

  const resumoNotas = `
NOTAS OFICIAIS DO ENEM JÁ CALCULADAS:
  Competência 1 = ${notas.c1} / 200
  Competência 2 = ${notas.c2} / 200
  Competência 3 = ${notas.c3} / 200
  Competência 4 = ${notas.c4} / 200
  Competência 5 = ${notas.c5} / 200
  TOTAL ENEM = ${notas.total} / 1000
`;

  const system = `Você é um avaliador de redação oficial do ENEM (graduado em Letras).
Sua devolutiva deve ser CONCISA, PRECISA, RESPEITOSA e DIRETA AO PONTO, idêntica aos pareceres dos professores reais do Ensino Médio.

REGRAS DE REDAÇÃO:
1. Seja objetivo: no máximo 2 a 3 frases por competência.
2. Destaque o ponto central (o que garantiu a nota e o que faltou para o próximo nível).
3. NUNCA cite translineações com hífen ('-\\n') como erros ortográficos.
4. Ao exemplificar falhas, cite apenas o termo exato.

FORMATO DE SAÍDA — JSON estrito:
{
  "devolutiva_enem": "Visão Geral: [1 parágrafo conciso com avaliação da tese e tom]\\n\\n• C1 (${notas.c1} pts): [Análise concisa da norma padrão e sintaxe]\\n\\n• C2 (${notas.c2} pts): [Análise concisa do tema e repertório]\\n\\n• C3 (${notas.c3} pts): [Análise concisa do projeto de texto]\\n\\n• C4 (${notas.c4} pts): [Análise concisa dos recursos coesivos]\\n\\n• C5 (${notas.c5} pts): [Análise concisa dos 5 elementos da intervenção e o que faltou]\\n\\n• Dica Prática: [1 ou 2 orientações diretas para a próxima redação]",
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

  if ((!textoBase || textoBase.trim().length === 0) && imagemBase64 && imagemBase64.trim().length > 0) {
    const transcricao = await transcreverRedacao(imagemBase64, apiKey);
    textoBase = transcricao.texto_transcrito;
    alunoDetectado = nomeFornecido || transcricao.aluno_detectado;
    turmaDetectada = turmaFornecida || transcricao.turma_detectada;
    confianca = transcricao.confianca_identificacao;
    motivoIncerteza = transcricao.motivo_incerteza_identificacao;
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
      sisedu: { descritores: fatos.sisedu || {} },
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