import { agenteAvaliadorUnificado, getMockENEMEvaluation } from '../services/aiService.js';
import { resolveStudent } from '../utils/turmasUtils.js';
import redacaoRepository from '../repositories/redacaoRepository.js';
import { queueService } from '../services/queueService.js';
import logger from '../utils/logger.js';

export async function handleCorrection(req, res) {
  let itemsToProcess = req.body?.redacoes || req.body?.documents;
  if (!itemsToProcess && (req.body?.texto_digitado || req.body?.imagem_base64)) {
    itemsToProcess = [req.body];
  }

  if (!itemsToProcess || !Array.isArray(itemsToProcess) || itemsToProcess.length === 0) {
    return res.status(400).json({ error: 'Payload must contain a "redacoes" array or essay fields.' });
  }

  // Limite de segurança para requisição síncrona HTTP
  const MAX_BATCH_SIZE = 10;
  if (itemsToProcess.length > MAX_BATCH_SIZE) {
    return res.status(400).json({
      error: `Tamanho máximo de lote excedido para avaliação síncrona. Envie no máximo ${MAX_BATCH_SIZE} redações por requisição para evitar timeouts de conexão.`
    });
  }

  const requestingUser = req.user || null;
  const apiKey = process.env.GEMINI_API_KEY;
  const results = [];

  logger.info(`Iniciando avaliação de lote com ${itemsToProcess.length} redação(ões)`, {
    requestId: req.id,
    batchSize: itemsToProcess.length,
    userId: requestingUser?.id
  });

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
          logger.info(`[ID ${id}] Executando Avaliação Unificada (OCR + ENEM + Sisedu)...`, { requestId: req.id, essayId: id });
          extractedData = await agenteAvaliadorUnificado(imagem_base64, texto_digitado, nome_aluno || null, turma_aluno || null, apiKey);
        } catch (apiErr) {
          logger.error(`[ID ${id}] Falha na API Gemini: ${apiErr.message}`, { requestId: req.id, essayId: id, error: apiErr });
          
          // Persiste a redação com status ERRO_PROCESSAMENTO para retry posterior
          let savedFailedId = null;
          try {
            savedFailedId = await redacaoRepository.create({
              user_id: item.user_id || null,
              nome_aluno: nome_aluno || 'Não identificado',
              turma_aluno: turma_aluno || null,
              nome_detectado: 0,
              data_captura: item.data_captura || new Date().toISOString(),
              tipo_input: imagem_base64 ? 'imagem' : 'texto',
              imagem_base64: imagem_base64 || null,
              texto_digitado: texto_digitado || null,
              extracted_data: {
                erro: apiErr.message,
                tentativas: 1,
                data_erro: new Date().toISOString()
              },
              nota_final: 0,
              status_validacao: 'ERRO_PROCESSAMENTO',
              validado_por: null,
              data_validacao: null
            });
          } catch (dbErr) {
            logger.warn(`[ID ${id}] Falha ao persistir erro no banco: ${dbErr.message}`);
          }

          results.push({
            id: savedFailedId || id,
            supabase_id: savedFailedId,
            cloud_id: savedFailedId,
            status: 'error',
            can_retry: true,
            error: `Falha na API Gemini (${apiErr.message}). Redação salva para reprocessamento automático.`
          });
          continue;
        }
      } else {
        logger.warn(`[ID ${id}] Nenhuma GEMINI_API_KEY configurada. Gerando avaliação simulada (Modo Demonstração)...`, { requestId: req.id, essayId: id });
        extractedData = getMockENEMEvaluation(id, texto_digitado, nome_aluno, turma_aluno);
      }

      if (texto_digitado && (!extractedData.texto_transcrito || extractedData.texto_transcrito.length < texto_digitado.length)) {
        extractedData.texto_transcrito = texto_digitado;
      }

      // Consolidação dos dados avaliados
      const rawStudentName = (nome_aluno && nome_aluno.trim()) || (extractedData.aluno && extractedData.aluno.trim()) || '';
      const rawTurma = (turma_aluno && turma_aluno.trim()) || (extractedData.turma && extractedData.turma.trim()) || '';
      const notaTotalEnem = extractedData.avaliacoes?.enem?.nota_total_enem ?? extractedData.nota_final ?? 0;
      const dataCaptura = item.data_captura || new Date().toISOString();
      const tipoInput = item.tipo_input || (imagem_base64 ? 'imagem' : 'texto');

      // Resolução inteligente de vínculo do aluno
      const resolved = await resolveStudent(item.user_id, rawStudentName, rawTurma);
      const isNameDetected = Boolean(resolved.nome_aluno && !['Aluno Não Identificado', 'Estudante Não Identificado', 'Não identificado'].includes(resolved.nome_aluno));

      const aiConfidence = extractedData.confianca_identificacao || (isNameDetected && resolved.user_id ? 'ALTA' : 'BAIXA');
      const isConfident = aiConfidence === 'ALTA' && Boolean(resolved.user_id);

      const statusValidacao = isConfident ? 'VALIDADA' : 'PENDENTE_VALIDACAO';
      const validadoPor = isConfident ? (requestingUser?.id || null) : null;
      const dataValidacao = isConfident ? new Date().toISOString() : null;

      // Persistência unificada via Repositório
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
        status_validacao: statusValidacao,
        validado_por: validadoPor,
        data_validacao: dataValidacao
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
          status_validacao: statusValidacao
        },
        processed_at: new Date().toISOString()
      });

      // Pacing de segurança entre itens (1.5s)
      if (i < itemsToProcess.length - 1) {
        await new Promise(r => setTimeout(r, 1500));
      }
    } catch (error) {
      logger.error(`Erro ao processar redação ID ${id}`, { requestId: req.id, essayId: id, error });
      results.push({
        id,
        status: 'error',
        error: error.message
      });
    }
  }

  logger.info(`Avaliação de lote finalizada com sucesso: ${results.length} processada(s)`, { requestId: req.id });

  return res.status(200).json({
    message: 'Redações avaliadas e gravadas no banco de dados com sucesso.',
    results
  });
}

/**
 * Reprocessa uma redação individual que estava com ERRO_PROCESSAMENTO
 */
export async function reprocessEssay(req, res) {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID de redação inválido.' });

  try {
    const redacao = await redacaoRepository.findById(id);
    if (!redacao) {
      return res.status(404).json({ error: 'Redação não encontrada.' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY não configurada no servidor.' });
    }

    if (!redacao.imagem_base64 && !redacao.texto_digitado) {
      return res.status(400).json({ error: 'Esta redação não possui imagem ou texto gravado para reavaliação.' });
    }

    logger.info(`[Reprocess] Reprocessando redação ID ${id} com Gemini...`);
    const extractedData = await agenteAvaliadorUnificado(
      redacao.imagem_base64,
      redacao.texto_digitado,
      redacao.nome_aluno,
      redacao.turma_aluno,
      apiKey
    );

    const rawStudentName = (redacao.nome_aluno && redacao.nome_aluno.trim()) || (extractedData.aluno && extractedData.aluno.trim()) || '';
    const rawTurma = (redacao.turma_aluno && redacao.turma_aluno.trim()) || (extractedData.turma && extractedData.turma.trim()) || '';
    const notaTotalEnem = extractedData.avaliacoes?.enem?.nota_total_enem ?? extractedData.nota_final ?? 0;

    const resolved = await resolveStudent(redacao.user_id, rawStudentName, rawTurma);
    const isNameDetected = Boolean(resolved.nome_aluno && !['Aluno Não Identificado', 'Estudante Não Identificado', 'Não identificado'].includes(resolved.nome_aluno));
    const aiConfidence = extractedData.confianca_identificacao || (isNameDetected && resolved.user_id ? 'ALTA' : 'BAIXA');
    const isConfident = aiConfidence === 'ALTA' && Boolean(resolved.user_id);

    const statusValidacao = isConfident ? 'VALIDADA' : 'PENDENTE_VALIDACAO';
    const validadoPor = isConfident ? (req.user?.id || null) : null;
    const dataValidacao = isConfident ? new Date().toISOString() : null;

    await redacaoRepository.update(id, {
      user_id: resolved.user_id,
      nome_aluno: resolved.nome_aluno,
      turma_aluno: resolved.turma_aluno,
      nome_detectado: isNameDetected ? 1 : 0,
      extracted_data: extractedData,
      nota_final: notaTotalEnem,
      status_validacao: statusValidacao,
      validado_por: validadoPor,
      data_validacao: dataValidacao
    });

    return res.status(200).json({
      message: 'Redação reprocessada com sucesso!',
      redacao: {
        id,
        nome_aluno: resolved.nome_aluno,
        turma_aluno: resolved.turma_aluno,
        nota_final: notaTotalEnem,
        status_validacao: statusValidacao,
        extracted_data: extractedData
      }
    });
  } catch (error) {
    logger.error(`[Reprocess Error] Falha ao reprocessar redação ID ${id}: ${error.message}`);
    return res.status(500).json({
      error: `Falha ao reprocessar redação: ${error.message}`
    });
  }
}

/**
 * Reprocessa todas as redações que falharam (status ERRO_PROCESSAMENTO)
 */
export async function reprocessAllFailed(req, res) {
  try {
    const redacoes = await redacaoRepository.findAll({ user: { role: 'ADMIN' }, includeImage: true });
    const comErro = redacoes.filter(r => r.status_validacao === 'ERRO_PROCESSAMENTO' && (r.imagem_base64 || r.texto_digitado));

    if (comErro.length === 0) {
      return res.status(200).json({
        message: 'Nenhuma redação com erro pendente para reprocessar.',
        enqueuedCount: 0
      });
    }

    for (const r of comErro) {
      queueService.enqueue({
        id: `reprocess_${r.id}`,
        db_id: r.id,
        imagem_base64: r.imagem_base64,
        texto_digitado: r.texto_digitado,
        nome_aluno: r.nome_aluno,
        turma_aluno: r.turma_aluno,
        tipo_input: r.tipo_input,
        data_captura: r.data_captura
      }, req.user);
    }

    return res.status(200).json({
      message: `${comErro.length} redação(ões) adicionada(s) à fila de reprocessamento seguro.`,
      enqueuedCount: comErro.length,
      queueStatus: queueService.getStatus()
    });
  } catch (error) {
    logger.error(`[ReprocessAll Error]: ${error.message}`);
    return res.status(500).json({ error: `Erro ao agendar reprocessamento: ${error.message}` });
  }
}

/**
 * Retorna o status da fila de reprocessamento em tempo real
 */
export function getQueueStatus(req, res) {
  return res.status(200).json(queueService.getStatus());
}

