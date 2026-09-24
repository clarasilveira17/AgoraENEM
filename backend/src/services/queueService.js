import redacaoRepository from '../repositories/redacaoRepository.js';
import { agenteAvaliadorUnificado } from './aiService.js';
import { resolveStudent } from '../utils/turmasUtils.js';
import logger from '../utils/logger.js';

/**
 * Fila de Processamento com Rate Limiting Estrito e Retry Automático
 * 
 * - Garante espaçamento de 4 a 5 segundos entre requisições para NUNCA exceder a cota de 15 RPM.
 * - Salva as redações com erro com status 'ERRO_PROCESSAMENTO' e imagem para reprocessamento posterior.
 * - Suporta retry automático com backoff exponencial.
 */

class RateLimitedQueueService {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    this.rateLimitDelayMs = 4500; // 4.5s = ~13 reqs/min (totalmente seguro para o limite de 15 RPM)
    this.maxRetries = 3;
    this.stats = {
      totalEnqueued: 0,
      processed: 0,
      success: 0,
      errors: 0,
      retries: 0
    };

    // Worker periódico em background que busca e reprocessa itens com erro a cada 3 minutos (economiza I/O do Supabase)
    this.autoRetryInterval = setInterval(() => {
      this.checkAndRetryFailedEssays();
    }, 3 * 60 * 1000);

    if (this.autoRetryInterval.unref) {
      this.autoRetryInterval.unref();
    }
  }

  /**
   * Adiciona um item à fila de processamento
   */
  enqueue(item, requestingUser = null) {
    const queueItem = {
      id: item.id || `queue_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      item,
      requestingUser,
      attempts: 0,
      enqueuedAt: Date.now(),
      status: 'PENDENTE'
    };

    this.queue.push(queueItem);
    this.stats.totalEnqueued++;

    if (!this.isProcessing) {
      this.processQueue();
    }

    return queueItem.id;
  }

  /**
   * Loop principal de processamento da fila com controle estrito de RPM
   */
  async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;

    while (this.queue.length > 0) {
      const current = this.queue.shift();
      current.status = 'PROCESSANDO';
      current.attempts++;

      try {
        logger.info(`[Queue] Processando item ID: ${current.id} (Tentativa ${current.attempts}/${this.maxRetries})`);
        const result = await this.executeEvaluation(current.item, current.requestingUser);
        
        current.status = 'CONCLUIDO';
        current.result = result;
        this.stats.processed++;
        this.stats.success++;
      } catch (error) {
        logger.error(`[Queue] Erro ao processar item ID ${current.id}: ${error.message}`);
        this.stats.errors++;

        // Se ainda tiver tentativas, re-enfileira com atraso
        if (current.attempts < this.maxRetries) {
          const backoffDelay = current.attempts * 10000; // 10s, 20s
          logger.warn(`[Queue] Re-enfileirando item ID ${current.id} para retry em ${backoffDelay / 1000}s`);
          this.stats.retries++;
          
          setTimeout(() => {
            current.status = 'PENDENTE';
            this.queue.push(current);
            if (!this.isProcessing) this.processQueue();
          }, backoffDelay);
        } else {
          // Esgotou tentativas: salva no banco com status ERRO_PROCESSAMENTO para reprocessamento manual/agendado
          await this.saveFailedEssay(current.item, error.message, current.attempts);
        }
      }

      // Intervalo de segurança anti-estouro de cota (4.5s)
      if (this.queue.length > 0) {
        await new Promise(r => setTimeout(r, this.rateLimitDelayMs));
      }
    }

    this.isProcessing = false;
  }

  /**
   * Executa a avaliação real via Gemini e grava o resultado
   */
  async executeEvaluation(item, requestingUser) {
    const { id, imagem_base64, texto_digitado, nome_aluno, turma_aluno, db_id } = item;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!imagem_base64 && !texto_digitado) {
      throw new Error('Nenhum dado de imagem ou texto foi fornecido.');
    }

    if (!apiKey || apiKey.trim() === '') {
      throw new Error('Chave de API Gemini não configurada.');
    }

    const extractedData = await agenteAvaliadorUnificado(
      imagem_base64,
      texto_digitado,
      nome_aluno || null,
      turma_aluno || null,
      apiKey
    );

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

    const aiConfidence = extractedData.confianca_identificacao || (isNameDetected && resolved.user_id ? 'ALTA' : 'BAIXA');
    const isConfident = aiConfidence === 'ALTA' && Boolean(resolved.user_id);

    const statusValidacao = isConfident ? 'VALIDADA' : 'PENDENTE_VALIDACAO';
    const validadoPor = isConfident ? (requestingUser?.id || null) : null;
    const dataValidacao = isConfident ? new Date().toISOString() : null;

    let savedId = db_id;

    if (db_id) {
      // Atualiza registro existente que estava com erro ou pendente
      await redacaoRepository.update(db_id, {
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
    } else {
      // Cria nova redação
      savedId = await redacaoRepository.create({
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
    }

    return {
      id: savedId || id,
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
      }
    };
  }

  /**
   * Salva redação com status ERRO_PROCESSAMENTO para reprocessamento futuro
   */
  async saveFailedEssay(item, errorMessage, attempts) {
    try {
      const dataCaptura = item.data_captura || new Date().toISOString();
      const tipoInput = item.tipo_input || (item.imagem_base64 ? 'imagem' : 'texto');
      
      const payload = {
        user_id: item.user_id || null,
        nome_aluno: item.nome_aluno || 'Não identificado',
        turma_aluno: item.turma_aluno || null,
        nome_detectado: 0,
        data_captura: dataCaptura,
        tipo_input: tipoInput,
        imagem_base64: item.imagem_base64 || null,
        texto_digitado: item.texto_digitado || null,
        extracted_data: {
          erro: errorMessage,
          tentativas: attempts,
          data_erro: new Date().toISOString(),
          texto_transcrito: item.texto_digitado || null
        },
        nota_final: 0,
        status_validacao: 'ERRO_PROCESSAMENTO',
        validado_por: null,
        data_validacao: null
      };

      if (item.db_id) {
        await redacaoRepository.update(item.db_id, payload);
      } else {
        await redacaoRepository.create(payload);
      }
    } catch (e) {
      logger.error(`[Queue] Falha ao persistir erro da redação: ${e.message}`);
    }
  }

  /**
   * Busca pontualmente apenas redações com ERRO_PROCESSAMENTO (máximo 5) para retry sem sobrecarregar o Supabase
   */
  async checkAndRetryFailedEssays() {
    if (this.isProcessing || this.queue.length > 0) return;

    try {
      const comErro = await redacaoRepository.findPendingRetries(5);

      if (comErro && comErro.length > 0) {
        logger.info(`[Queue Worker] Encontradas ${comErro.length} redação(ões) pendentes para reavaliação automática`);
        for (const r of comErro) {
          this.enqueue({
            id: `retry_${r.id}`,
            db_id: r.id,
            user_id: r.user_id,
            imagem_base64: r.imagem_base64,
            texto_digitado: r.texto_digitado,
            nome_aluno: r.nome_aluno,
            turma_aluno: r.turma_aluno,
            tipo_input: r.tipo_input,
            data_captura: r.data_captura
          });
        }
      }
    } catch (e) {
      logger.warn(`[Queue Worker] Erro ao verificar redações com falha: ${e.message}`);
    }
  }

  /**
   * Retorna o status atual da fila
   */
  getStatus() {
    return {
      queueLength: this.queue.length,
      isProcessing: this.isProcessing,
      rateLimitDelayMs: this.rateLimitDelayMs,
      estimatedMinutesRemaining: Math.ceil((this.queue.length * (this.rateLimitDelayMs / 1000)) / 60),
      stats: this.stats
    };
  }
}

export const queueService = new RateLimitedQueueService();
