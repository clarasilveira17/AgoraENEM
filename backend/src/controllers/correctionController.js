import { agenteAvaliadorUnificado, getMockENEMEvaluation } from '../services/aiService.js';
import { supabase, isSupabaseConfigured, getNextId } from '../config/supabaseClient.js';
import db from '../config/db.js';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../middleware/authMiddleware.js';
import { resolveStudent, normalizeTurma } from '../utils/turmasUtils.js';

export async function handleCorrection(req, res) {
  let itemsToProcess = req.body?.redacoes || req.body?.documents;
  if (!itemsToProcess && (req.body?.texto_digitado || req.body?.imagem_base64)) {
    itemsToProcess = [req.body];
  }

  if (!itemsToProcess || !Array.isArray(itemsToProcess) || itemsToProcess.length === 0) {
    return res.status(400).json({ error: 'Payload must contain a "redacoes" array or essay fields.' });
  }

  console.log(`[CorrectionController] Recebida solicitação em lote para avaliar ${itemsToProcess.length} redação(ões)...`);

  // Extrai usuário autenticado do cabeçalho se fornecido
  let requestingUser = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded && decoded.id) {
        requestingUser = decoded;
      }
    } catch (e) {
      // Token inválido ou expirado, continua normalmente
    }
  }

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
          console.log(`[CorrectionController] [ID ${id}] 🎓 Executando Avaliação Unificada (OCR + ENEM + Sisedu)...`);
          extractedData = await agenteAvaliadorUnificado(imagem_base64, texto_digitado, nome_aluno || null, turma_aluno || null, apiKey);
        } catch (apiErr) {
          console.error(`[CorrectionController] [ID ${id}] ❌ Erro na API Gemini: ${apiErr.message}`);
          results.push({
            id,
            status: 'error',
            error: `Falha na API Gemini (${apiErr.message}). Por favor, aguarde alguns instantes ou verifique sua cota da API.`
          });
          continue;
        }
      } else {
        console.log(`[CorrectionController] [ID ${id}] [MODO DEMONSTRAÇÃO] Nenhuma GEMINI_API_KEY configurada. Gerando avaliação simulada...`);
        extractedData = getMockENEMEvaluation(id, texto_digitado, nome_aluno, turma_aluno);
      }

      if (texto_digitado && (!extractedData.texto_transcrito || extractedData.texto_transcrito.length < texto_digitado.length)) {
        extractedData.texto_transcrito = texto_digitado;
      }

      // Consolidação dos dados finais avaliados
      const rawStudentName = (nome_aluno && nome_aluno.trim()) || (extractedData.aluno && extractedData.aluno.trim()) || '';
      const rawTurma = (turma_aluno && turma_aluno.trim()) || (extractedData.turma && extractedData.turma.trim()) || '';
      const notaTotalEnem = extractedData.avaliacoes?.enem?.nota_total_enem ?? extractedData.nota_final ?? 0;
      const dataCaptura = item.data_captura || new Date().toISOString();
      const tipoInput = item.tipo_input || (imagem_base64 ? 'imagem' : 'texto');

      // Resolução inteligente de vínculo do aluno
      const resolved = await resolveStudent(item.user_id, rawStudentName, rawTurma);
      const isNameDetected = Boolean(resolved.nome_aluno && !['Aluno Não Identificado', 'Estudante Não Identificado', 'Não identificado'].includes(resolved.nome_aluno));

      // Sinceridade da IA:
      // Se a IA teve dúvida ("MEDIA" ou "BAIXA") ou não encontrou aluno no cadastro, marca como pendente para o professor conferir
      const aiConfidence = extractedData.confianca_identificacao || (isNameDetected && resolved.user_id ? 'ALTA' : 'BAIXA');
      const isConfident = aiConfidence === 'ALTA' && Boolean(resolved.user_id);

      const statusValidacao = isConfident ? 'VALIDADA' : 'PENDENTE_VALIDACAO';
      const validadoPor = isConfident ? (requestingUser?.id || 1) : null;
      const dataValidacao = isConfident ? new Date().toISOString() : null;

      // =========================================================================
      // PERSISTÊNCIA DIRETA NO SUPABASE (NUVEM) - SEM BUROCRACIA DE SINCRONIZAÇÃO
      // =========================================================================
      let savedCloudId = null;
      if (isSupabaseConfigured) {
        try {
          console.log(`[CorrectionController] Gravando redação no Supabase (${resolved.nome_aluno} | Status: ${statusValidacao})...`);
          const nextId = await getNextId('redacoes');

          const { data: insertedRow, error: insErr } = await supabase
            .from('redacoes')
            .insert({
              ...(nextId ? { id: nextId } : {}),
              user_id: resolved.user_id,
              nome_aluno: resolved.nome_aluno,
              turma_aluno: resolved.turma_aluno,
              nome_detectado: isNameDetected ? 1 : 0,
              data_captura: dataCaptura,
              tipo_input: tipoInput,
              imagem_base64: imagem_base64 || null,
              texto_digitado: texto_digitado || null,
              is_synced: 1,
              extracted_data: extractedData,
              nota_final: notaTotalEnem,
              status_validacao: statusValidacao,
              validado_por: validadoPor,
              data_validacao: dataValidacao
            })
            .select('id')
            .maybeSingle();

          if (insErr) {
            console.error('[CorrectionController] Erro ao gravar no Supabase:', insErr.message);
          } else if (insertedRow) {
            savedCloudId = insertedRow.id;
            console.log(`[CorrectionController] ✅ Redação salva no Supabase com ID ${savedCloudId}!`);
          }
        } catch (supabaseErr) {
          console.error('[CorrectionController] Exceção de rede no Supabase:', supabaseErr.message);
        }
      }

      // Persistência local no SQLite como redundância/cache
      if (db) {
        try {
          const stmt = db.prepare(`
            INSERT INTO redacoes (
              user_id, nome_aluno, turma_aluno, nome_detectado, data_captura,
              tipo_input, imagem_base64, texto_digitado, is_synced,
              extracted_data, nota_final, status_validacao, validado_por, data_validacao
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 'VALIDADA', ?, CURRENT_TIMESTAMP)
          `);
          const info = stmt.run(
            userId,
            finalStudentName,
            finalTurma,
            isNameDetected ? 1 : 0,
            dataCaptura,
            tipoInput,
            imagem_base64 || null,
            texto_digitado || null,
            JSON.stringify(extractedData),
            notaTotalEnem,
            validadoPor
          );
          if (!savedCloudId) {
            savedCloudId = info.lastInsertRowid;
          }
          console.log(`[CorrectionController] Gravado no SQLite com ID ${info.lastInsertRowid}`);
        } catch (sqliteErr) {
          console.warn('[CorrectionController] SQLite insert warning:', sqliteErr.message);
        }
      }

      results.push({
        id,
        supabase_id: savedCloudId,
        cloud_id: savedCloudId,
        status: 'success',
        extracted: {
          ...extractedData,
          id: savedCloudId || id,
          aluno: finalStudentName,
          turma: finalTurma,
          nota_final: notaTotalEnem
        },
        processed_at: new Date().toISOString()
      });

      if (i < itemsToProcess.length - 1) {
        await new Promise(r => setTimeout(r, 1000));
      }
    } catch (error) {
      console.error(`[CorrectionController] Erro ao processar redação ID ${id}:`, error.message);
      results.push({
        id,
        status: 'error',
        error: error.message
      });
    }
  }

  console.log(`[CorrectionController] Concluída avaliação e persistência de ${results.length} redação(ões).`);

  return res.status(200).json({
    message: 'Redações avaliadas e gravadas no banco de dados com sucesso.',
    results
  });
}
