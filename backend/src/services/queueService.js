import { supabase, isSupabaseConfigured } from '../config/supabaseClient.js';
import redacaoRepository from '../repositories/redacaoRepository.js';
import { agenteAvaliadorUnificado, getMockENEMEvaluation } from './aiService.js';
import { resolveStudent } from '../utils/turmasUtils.js';
import logger from '../utils/logger.js';

/**
 * Fila de Jobs Serverless (Persistente no Supabase)
 * Compatível 100% com Vercel Serverless & Crons
 * Sem dependência de memória RAM ou setInterval de processo.
 */
class ServerlessQueueService {
  /**
   * Enfileira um novo job na tabela jobs do Supabase
   */
  async enqueueJob(tipo, payload) {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase não configurado para enfileiramento de jobs.');
    }

    const { data, error } = await supabase
      .from('jobs')
      .insert({
        tipo,
        payload,
        status: 'PENDENTE',
        tentativas: 0,
        criado_em: new Date().toISOString(),
        atualizado_em: new Date().toISOString()
      })
      .select('id, status, criado_em')
      .single();

    if (error) {
      console.error('[QueueService.enqueueJob Error]:', error.message);
      throw new Error(error.message);
    }

    return data;
  }

  /**
   * Consulta o status e resultado de um job por ID
   */
  async getJobById(jobId) {
    if (!isSupabaseConfigured) return null;

    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .maybeSingle();

    if (error || !data) return null;
    return data;
  }

  /**
   * Processa até batchSize jobs pendentes (chamado via Vercel Cron a cada 1 min)
   */
  async processPendingJobs(batchSize = 3) {
    if (!isSupabaseConfigured) return { processed: 0 };

    // 1. Busca jobs pendentes
    const { data: pendingJobs, error: fetchError } = await supabase
      .from('jobs')
      .select('*')
      .eq('status', 'PENDENTE')
      .order('criado_em', { ascending: true })
      .limit(batchSize);

    if (fetchError || !pendingJobs || pendingJobs.length === 0) {
      return { processed: 0, message: 'Nenhum job pendente para processar.' };
    }

    const apiKey = process.env.GEMINI_API_KEY;
    let processedCount = 0;

    for (const job of pendingJobs) {
      // Marca como PROCESSANDO
      await supabase
        .from('jobs')
        .update({
          status: 'PROCESSANDO',
          tentativas: (job.tentativas || 0) + 1,
          atualizado_em: new Date().toISOString()
        })
        .eq('id', job.id);

      try {
        const payload = job.payload || {};
        const items = payload.items || (Array.isArray(payload) ? payload : [payload]);
        const requestingUserId = payload.user_id || null;
        const jobResults = [];

        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const { id, imagem_base64, texto_digitado, nome_aluno, turma_aluno } = item;

          let extractedData = null;
          if (apiKey && apiKey.trim() !== '') {
            try {
              extractedData = await agenteAvaliadorUnificado(
                imagem_base64,
                texto_digitado,
                nome_aluno || null,
                turma_aluno || null,
                apiKey
              );
            } catch (err) {
              logger.error(`[Job ${job.id}] Erro Gemini no item ${id}: ${err.message}`);
              jobResults.push({ id, status: 'error', error: err.message });
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
          const tipoInput = item.tipo_input || (imagem_base64 ? 'imagem' : 'texto');

          const resolved = await resolveStudent(item.user_id, rawStudentName, rawTurma);
          const isNameDetected = Boolean(resolved.nome_aluno && !['Aluno Não Identificado', 'Estudante Não Identificado', 'Não identificado'].includes(resolved.nome_aluno));

          const savedId = await redacaoRepository.create({
            user_id: resolved.user_id,
            nome_aluno: resolved.nome_aluno,
            turma_aluno: resolved.turma_aluno,
            nome_detectado: isNameDetected ? 1 : 0,
            tipo_input: tipoInput,
            imagem_base64: imagem_base64 || null,
            texto_digitado: texto_digitado || null,
            extracted_data: extractedData,
            nota_final: notaTotalEnem,
            status_validacao: 'VALIDADA',
            validado_por: requestingUserId,
            data_validacao: new Date().toISOString()
          });

          jobResults.push({
            id,
            redacao_id: savedId,
            status: 'success',
            nota_final: notaTotalEnem,
            aluno: resolved.nome_aluno
          });

          // Pacing de 4 segundos entre itens para respeitar 15 RPM
          if (i < items.length - 1) {
            await new Promise(r => setTimeout(r, 4000));
          }
        }

        // Atualiza status do job para CONCLUIDO
        await supabase
          .from('jobs')
          .update({
            status: 'CONCLUIDO',
            resultado: { results: jobResults },
            atualizado_em: new Date().toISOString()
          })
          .eq('id', job.id);

        processedCount++;
      } catch (jobErr) {
        logger.error(`[Job ${job.id}] Falha geral: ${jobErr.message}`);
        await supabase
          .from('jobs')
          .update({
            status: job.tentativas >= 3 ? 'ERRO' : 'PENDENTE',
            erro: jobErr.message,
            atualizado_em: new Date().toISOString()
          })
          .eq('id', job.id);
      }
    }

    return { processed: processedCount };
  }

  /**
   * Métricas da fila baseadas no Supabase
   */
  async getStatus() {
    if (!isSupabaseConfigured) {
      return { queueLength: 0, isProcessing: false, stats: {} };
    }

    const { count: pendentesCount } = await supabase
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'PENDENTE');

    const { count: processandoCount } = await supabase
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'PROCESSANDO');

    return {
      queueLength: pendentesCount || 0,
      isProcessing: (processandoCount || 0) > 0,
      stats: {
        pendentes: pendentesCount || 0,
        processando: processandoCount || 0
      }
    };
  }
}

export const queueService = new ServerlessQueueService();
