import { agenteAvaliadorUnificado, getMockENEMEvaluation } from '../services/aiService.js';
import { resolveStudent } from '../utils/turmasUtils.js';
import redacaoRepository from '../repositories/redacaoRepository.js';
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
          results.push({
            id,
            status: 'error',
            error: `Falha na API Gemini (${apiErr.message}). Por favor, aguarde alguns instantes ou verifique sua cota da API.`
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
      const validadoPor = isConfident ? (requestingUser?.id || 1) : null;
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

      if (i < itemsToProcess.length - 1) {
        await new Promise(r => setTimeout(r, 600));
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
