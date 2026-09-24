import { authService } from './authService';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '/api/corrigir';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * Converte um File ou Blob para Base64 Data URL de forma assíncrona
 */
function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(null);
    if (typeof file === 'string') return resolve(file); // já é string base64 ou texto
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result || null);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

/**
 * Processamento de Redações na Nuvem com Pacing Seguro de RPM (1 por vez) e Retry Automático
 */
export async function processRedacoesCloud(items, onProgress, defaults = {}) {
  if (!items || items.length === 0) {
    return { successCount: 0, errorCount: 0, results: [], message: 'Nenhuma redação fornecida.' };
  }

  const token = authService.getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };

  // Normaliza e converte todos os itens (lendo File/Blob para base64 se necessário)
  const normalizedItems = await Promise.all(
    items.map(async (item, idx) => {
      let imagemBase64 = null;
      let textoDigitado = null;
      let tipoInput = item.tipo_input || 'imagem';
      let nomeAluno = item.nome_manual || item.nome_aluno || item.nome || defaults.nomePadrao || null;
      let turmaAluno = item.turma_manual || item.turma_aluno || item.turma || defaults.turmaPadrao || null;
      let userId = item.user_id || defaults.usuarioId || null;

      if (item instanceof File || item instanceof Blob) {
        imagemBase64 = await readFileAsBase64(item);
        tipoInput = 'imagem';
      } else if (item.base64 || item.imagem_base64) {
        imagemBase64 = item.base64 || item.imagem_base64;
        tipoInput = 'imagem';
      } else if (item.file instanceof File || item.file instanceof Blob) {
        imagemBase64 = await readFileAsBase64(item.file);
        tipoInput = 'imagem';
      } else if (item.texto_digitado || item.texto) {
        textoDigitado = item.texto_digitado || item.texto;
        tipoInput = 'texto';
      }

      return {
        id: item.id || `upload_${Date.now()}_${idx}`,
        name: item.name || `Redação ${idx + 1}`,
        imagem_base64: imagemBase64,
        texto_digitado: textoDigitado,
        tipo_input: tipoInput,
        nome_aluno: nomeAluno,
        turma_aluno: turmaAluno,
        user_id: userId,
        data_captura: item.data_captura || new Date().toISOString()
      };
    })
  );

  let successCount = 0;
  let errorCount = 0;
  const allResults = [];
  const totalItems = normalizedItems.length;

  for (let i = 0; i < totalItems; i++) {
    const item = normalizedItems[i];
    let attempts = 0;
    const MAX_RETRIES = 3;
    let itemSuccess = false;
    let lastResult = null;

    while (attempts < MAX_RETRIES && !itemSuccess) {
      attempts++;
      
      if (onProgress) {
        const statusText = attempts > 1
          ? `Tentativa ${attempts}/${MAX_RETRIES}...`
          : (totalItems > 1 ? `Avaliando foto ${i + 1} de ${totalItems}...` : 'Avaliando com IA...');
        
        onProgress(i + 1, totalItems, {
          currentIndex: i + 1,
          total: totalItems,
          currentItem: item,
          attempt: attempts,
          maxAttempts: MAX_RETRIES,
          status: statusText,
          allResults
        });
      }

      try {
        const payload = { redacoes: [item] };
        const response = await fetch(BACKEND_URL, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const errText = await response.text().catch(() => '');
          let errMsg = `Servidor retornou status ${response.status}: ${response.statusText}`;
          try {
            const parsed = JSON.parse(errText);
            if (parsed.error) errMsg = parsed.error;
          } catch (e) {}

          const isRateOrDemand = response.status === 429 || response.status === 503 ||
                                 errMsg.includes('cota') || errMsg.includes('demand') || errMsg.includes('overloaded');

          if (isRateOrDemand && attempts < MAX_RETRIES) {
            const waitTime = attempts * 6000; // 6s, 12s
            if (onProgress) {
              const waitStatus = `Aguardando cota (${waitTime / 1000}s) para foto ${i + 1}/${totalItems}...`;
              onProgress(i + 1, totalItems, {
                currentIndex: i + 1,
                total: totalItems,
                currentItem: item,
                attempt: attempts,
                maxAttempts: MAX_RETRIES,
                status: waitStatus,
                allResults
              });
            }
            await sleep(waitTime);
            continue;
          }

          throw new Error(errMsg);
        }

        const data = await response.json();
        const result = (data.results && data.results[0]) || { status: 'success', id: item.id };
        lastResult = result;

        if (result.status === 'success') {
          itemSuccess = true;
          successCount++;
        } else {
          // Erro retornado pela API Gemini dentro do 200
          const errMsg = result.error || 'Falha na avaliação';
          const isRetryable = errMsg.includes('503') || errMsg.includes('429') || errMsg.includes('demand') || errMsg.includes('cota');
          
          if (isRetryable && attempts < MAX_RETRIES) {
            const waitTime = attempts * 7000;
            if (onProgress) {
              const retryStatus = `Alta demanda no Gemini. Repetindo foto ${i + 1}/${totalItems} em ${waitTime / 1000}s...`;
              onProgress(i + 1, totalItems, {
                currentIndex: i + 1,
                total: totalItems,
                currentItem: item,
                attempt: attempts,
                maxAttempts: MAX_RETRIES,
                status: retryStatus,
                allResults
              });
            }
            await sleep(waitTime);
            continue;
          }

          errorCount++;
          break;
        }
      } catch (err) {
        lastResult = {
          id: item.id,
          status: 'error',
          error: err.message
        };

        if (attempts < MAX_RETRIES) {
          const waitTime = attempts * 5000;
          await sleep(waitTime);
          continue;
        } else {
          errorCount++;
          break;
        }
      }
    }

    if (lastResult) {
      allResults.push(lastResult);
    }

    // Pacing seguro entre fotos (3.5 segundos = ~12 fotos/minuto, seguro contra 15 RPM)
    if (i < totalItems - 1) {
      await sleep(3500);
    }
  }

  return {
    successCount,
    errorCount,
    results: allResults,
    message: errorCount > 0
      ? `${successCount} redação(ões) avaliada(s) com sucesso. ${errorCount} com erro (salvas no sistema para retry).`
      : `${successCount} redação(ões) avaliada(s) e gravada(s) na nuvem com sucesso!`
  };
}

/**
 * Reprocessa uma redação individual que estava com ERRO_PROCESSAMENTO
 */
export async function reprocessarRedacao(id) {
  const token = authService.getToken();
  const response = await fetch(`/api/redacoes/${id}/reprocessar`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    }
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Falha ao reprocessar redação.');
  }
  return data;
}

/**
 * Dispara o reprocessamento em lote de todas as redações com erro
 */
export async function reprocessarTodasFalhas() {
  const token = authService.getToken();
  const response = await fetch('/api/redacoes/reprocessar-erros', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    }
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Falha ao reprocessar redações com erro.');
  }
  return data;
}

/**
 * Obtém o status da fila de background no backend
 */
export async function obterStatusFila() {
  const token = authService.getToken();
  const response = await fetch('/api/queue/status', {
    headers: {
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    }
  });

  if (!response.ok) return null;
  return response.json();
}

