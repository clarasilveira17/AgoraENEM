import { authService } from './authService';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '/api/corrigir';

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
 * Direct Cloud Submission & AI Evaluation (No offline IndexedDB storage)
 * Sends images or typed essays directly to /api/corrigir which saves straight to Supabase cloud.
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

  // Chunk items into max 2 per request to strictly respect Vercel's 4.5MB serverless payload limit
  const CHUNK_SIZE = 2;
  const chunks = [];
  for (let i = 0; i < normalizedItems.length; i += CHUNK_SIZE) {
    chunks.push(normalizedItems.slice(i, i + CHUNK_SIZE));
  }

  let successCount = 0;
  let errorCount = 0;
  const allResults = [];

  for (let c = 0; c < chunks.length; c++) {
    const chunk = chunks[c];
    if (onProgress) {
      onProgress(c + 1, chunks.length);
    }

    const payload = { redacoes: chunk };

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
      throw new Error(errMsg);
    }

    let data;
    try {
      const text = await response.text();
      data = JSON.parse(text);
    } catch (parseError) {
      throw new Error('Erro ao processar lote: o servidor não retornou JSON válido.');
    }

    const results = data.results || [];
    allResults.push(...results);

    results.forEach(r => {
      if (r.status === 'success') successCount++;
      else errorCount++;
    });
  }

  return {
    successCount,
    errorCount,
    results: allResults,
    message: `${successCount} redação(ões) avaliada(s) e gravada(s) na nuvem Supabase com sucesso!`
  };
}
