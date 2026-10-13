import { agenteAvaliadorUnificado, getMockENEMEvaluation } from '../services/aiService.js';
import { resolveStudent } from '../utils/turmasUtils.js';
import redacaoRepository from '../repositories/redacaoRepository.js';
import { queueService } from '../services/queueService.js';
import logger from '../utils/logger.js';

/**
 * Endpoint de avaliação de redações.
 * Suporta modo assíncrono padrão para lotes de escala (202 Accepted) e modo síncrono para 1 foto.
 */
export async function handleCorrection(req, res) {
  let itemsToProcess = req.body?.redacoes || req.body?.documents;
  if (!itemsToProcess && (req.body?.texto_digitado || req.body?.imagem_base64)) {
    itemsToProcess = [req.body];
  }

  if (!itemsToProcess || !Array.isArray(itemsToProcess) || itemsToProcess.length === 0) {
    return res.status(400).json({ error: 'Payload deve conter um array "redacoes" ou campos da redação.' });
  }

  if (itemsToProcess.length > 10) {
    return res.status(400).json({ error: 'Tamanho máximo de lote excedido (limite de 10 redações por requisição para proteção de recursos).' });
  }

  const requestingUser = req.user || null;
  const isAsyncMode = req.query.async === 'true' || itemsToProcess.length > 2;

  // Modo Assíncrono para Lotes: Enfileira na tabela jobs do Supabase e retorna 202
  if (isAsyncMode) {
    try {
      const job = await queueService.enqueueJob('CORRECAO_IA', {
        items: itemsToProcess,
        user_id: requestingUser?.id || null
      });

      logger.info(`Lote com ${itemsToProcess.length} redações enfileirado no Job ID ${job.id}`, { requestId: req.id, jobId: job.id });

      return res.status(202).json({
        message: 'Lote de redações enfileirado com sucesso para processamento em segundo plano.',
        jobId: job.id,
        status: job.status,
        totalItens: itemsToProcess.length,
        checkStatusUrl: `/api/jobs/${job.id}`
      });
    } catch (enqueueErr) {
      logger.error('Erro ao enfileirar job de correção:', enqueueErr);
      return res.status(500).json({ error: 'Falha ao agendar processamento do lote.' });
    }
  }

  // Modo Síncrono direto (apenas para lotes unitários/rápidos)
  const apiKey = process.env.GEMINI_API_KEY;
  const results = [];

  for (let i = 0; i < itemsToProcess.length; i++) {
    const item = itemsToProcess[i];
    const { id, imagem_base64, texto_digitado, nome_aluno, turma_aluno } = item;

    if (!imagem_base64 && !texto_digitado) {
      results.push({ id, status: 'error', error: 'Nenhum dado de imagem ou texto foi fornecido.' });
      continue;
    }

    try {
      let extractedData = null;

      if (apiKey && apiKey.trim() !== '') {
        try {
          extractedData = await agenteAvaliadorUnificado(imagem_base64, texto_digitado, nome_aluno || null, turma_aluno || null, apiKey);
        } catch (apiErr) {
          logger.error(`[ID ${id}] Falha na API Gemini: ${apiErr.message}`, { requestId: req.id, essayId: id });
          results.push({ id, status: 'error', error: apiErr.message });
          continue;
        }
      } else {
        extractedData = getMockENEMEvaluation(id, texto_digitado, nome_aluno, turma_aluno);
      }

      if (texto_digitado && (!extractedData.texto_transcrito || extractedData.texto_transcrito.length < texto_digitado.length)) {
        extractedData.texto_transcrito = texto_digitado;
      }

      const rawStudentName = (nome_aluno && nome_aluno.trim()) || (extractedData.aluno && extractedData.aluno.trim()) || '';
      const rawTurma = (turma_aluno && turma_aluno.trim()) || (extractedData.turma && extractedData.turma.trim()) || '';
      const notaTotalEnem = extractedData.avaliacoes?.enem?.nota_total_enem ?? extractedData.nota_final ?? 0;
      const dataCaptura = item.data_captura || new Date().toISOString();
      const tipoInput = item.tipo_input || (imagem_base64 ? 'imagem' : 'texto');

      const resolved = await resolveStudent(item.user_id, rawStudentName, rawTurma);
      const isNameDetected = Boolean(resolved.nome_aluno && !['Aluno Não Identificado', 'Estudante Não Identificado', 'Não identificado'].includes(resolved.nome_aluno));

      const savedId = await redacaoRepository.create({
        user_id: resolved.user_id,
        nome_aluno: resolved.nome_aluno,
        turma_aluno: resolved.turma_aluno,
        nome_detectado: isNameDetected ? 1 : 0,
        data_captura: dataCaptura,
        tipo_input: tipoInput,
        imagem_base64: imagem_base64 || null,
        texto_digitado: texto_digitado || null,
        extracted_data: extractedData,
        nota_final: notaTotalEnem,
        status_validacao: 'VALIDADA',
        validado_por: requestingUser?.id || null,
        data_validacao: new Date().toISOString()
      });

      results.push({
        id,
        supabase_id: savedId,
        cloud_id: savedId,
        status: 'success',
        extracted: {
          ...extractedData,
          id: savedId || id,
          aluno: resolved.nome_aluno,
          turma: resolved.turma_aluno,
          nota_final: notaTotalEnem,
          status_validacao: 'VALIDADA'
        }
      });
    } catch (error) {
      logger.error(`Erro ao processar redação ID ${id}`, { requestId: req.id, essayId: id, error });
      results.push({ id, status: 'error', error: error.message });
    }
  }

  return res.status(200).json({
    message: 'Avaliação concluída com sucesso.',
    results
  });
}

/**
 * Consulta status e resultado de um Job assíncrono
 */
export async function getJobStatus(req, res) {
  try {
    const { id } = req.params;
    const job = await queueService.getJobById(id);

    if (!job) {
      return res.status(404).json({ error: 'Job não encontrado.' });
    }

    return res.status(200).json(job);
  } catch (error) {
    return res.status(500).json({ error: 'Falha ao consultar job.' });
  }
}

/**
 * Endpoint acionado por Vercel Cron para processar jobs pendentes
 */
export async function cronProcessJobs(req, res) {
  try {
    const result = await queueService.processPendingJobs(3);
    return res.status(200).json({
      message: 'Worker executado com sucesso.',
      ...result
    });
  } catch (err) {
    logger.error('Erro na execução do cron de jobs:', err);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * Endpoint acionado por Vercel Cron para limpar leases de correção expirados (> 90min)
 */
export async function cronCleanupLeases(req, res) {
  try {
    const liberadas = await redacaoRepository.limparLeasesExpirados(90);
    return res.status(200).json({
      message: 'Limpeza de leases concluída.',
      leasesLiberados: liberadas
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * Reprocessa uma redação individual que falhou
 */
export async function reprocessEssay(req, res) {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID de redação inválido.' });

  try {
    const redacao = await redacaoRepository.findById(id);
    if (!redacao) return res.status(404).json({ error: 'Redação não encontrada.' });

    const job = await queueService.enqueueJob('CORRECAO_IA', {
      items: [redacao],
      user_id: req.user?.id || null
    });

    return res.status(202).json({
      message: 'Redação enfileirada para reprocessamento.',
      jobId: job.id
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Reprocessa todas as redações que falharam
 */
export async function reprocessAllFailed(req, res) {
  try {
    const job = await queueService.enqueueJob('REPROCESSAR_ERROS', {
      user_id: req.user?.id || null
    });

    return res.status(202).json({
      message: 'Reprocessamento de falhas enfileirado com sucesso.',
      jobId: job.id
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Retorna status da fila no Supabase
 */
export async function getQueueStatus(req, res) {
  const status = await queueService.getStatus();
  return res.status(200).json(status);
}
