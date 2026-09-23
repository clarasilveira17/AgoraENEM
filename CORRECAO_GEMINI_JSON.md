# Correção de Parse JSON e Configuração dos Modelos Gemini

## 1. Problema Identificado
Ao processar avaliações com a API Gemini, ocorria o seguinte erro de sintaxe durante o parse da resposta da IA:
```text
Erro ao processar: Falha na API Gemini (Unexpected non-whitespace character after JSON at position 2881 (line 22 column 3)).
Por favor, aguarde alguns instantes ou verifique sua cota da API.
```

### Causa Raiz:
- O modelo Gemini às vezes inclui caracteres não-vazios, comentários explicativos, quebras ou blocos adicionais após a chave de fechamento `}` do JSON principal.
- Quando o `JSON.parse` recebia a string completa, o parser falhava ao encontrar dados após o término do objeto JSON válido.

---

## 2. Solução Implementada

### A. Extração Balanceada e Fatiamento Posicional ([aiService.js](file:///c:/dev/NOVO/APODI/backend/src/services/aiService.js))
1. **`extractBalancedJson(str)`**:
   - Analisa a resposta da IA por máquina de estados e contagem de profundidade de delimitadores `{` / `}` ou `[` / `]`.
   - Ignora caracteres entre aspas e escapes `\"`.
   - Encerra a captura no momento exato em que a profundidade volta a `0`, descartando qualquer comentário ou texto que venha após o JSON.
2. **Recuperação de Erros de Posição (`matchPos`)**:
   - Caso ocorra uma exceção de `Unexpected non-whitespace character after JSON at position <N>`, o parser extrai `slice(0, N)` e refaz o parse com sucesso.
3. **Reparo e Sanitização**:
   - Tratamento de aspas duplas internas não-escapadas em strings.
   - Remoção de caracteres de controle invisíveis (`\u0000-\u001F`).
   - Fechamento automático de chaves para respostas truncadas por limite de tokens.

---

## 3. Configuração dos Modelos ([gemini.js](file:///c:/dev/NOVO/APODI/backend/src/config/gemini.js))

A lista de modelos prioritários foi configurada conforme solicitado:

```javascript
export const GEMINI_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.7-flash',
  'gemini-flash-latest',
  'gemini-3.5-flash',
  'gemini-3.8-flash',
  'gemini-3.6-flash'
];
```

O mecanismo `generateContentWithFallback` percorre a lista de modelos em ordem de prioridade, alternando automaticamente em caso de indisponibilidade (404, 429/Quota, 503 ou Timeout).

---

## 4. Testes e Validação
- **Arquivo de testes**: [`aiService.test.js`](file:///c:/dev/NOVO/APODI/backend/src/services/aiService.test.js)
- **Cenários testados**:
  1. Limpeza de blocos markdown ````json ... ````.
  2. Extração de JSON envolvido por comentários antes e depois.
  3. Caracteres extras após a chave de fechamento (cenário do erro original).
  4. Aspas duplas internas não-escapadas em valores de strings.
  5. Caracteres de controle e quebras brutas.
- **Resultado da suíte**: 30/30 testes aprovados no Vitest.
