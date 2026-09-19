import db from '../config/db.js';
import { supabase, isSupabaseConfigured, getNextId } from '../config/supabaseClient.js';
import { TURMAS_ESCOLA, normalizeTurma, normalizeStr, MANUAL_OCR_NAME_MAP, resolveStudent } from '../utils/turmasUtils.js';

// POST /api/redacoes/sync-legacy
// Migrates legacy IndexedDB local evaluations to central cloud DB (Supabase/SQLite)
export const syncLegacyRedacoes = async (req, res) => {
  try {
    const { redacoes } = req.body;
    if (!Array.isArray(redacoes) || redacoes.length === 0) {
      return res.status(400).json({ error: 'Nenhuma redação fornecida para sincronização.' });
    }

    let insertedCount = 0;
    let skippedCount = 0;

    if (isSupabaseConfigured) {
      for (const item of redacoes) {
        const rawNome = item.nome_aluno || item.nomeAluno || 'Aluno Não Identificado';
        const rawTurma = item.turma_aluno || item.turmaAluno || 'Turma Geral';
        const dataCaptura = item.data_captura || item.dataCaptura || new Date().toISOString();

        let extractedDataObj = {};
        if (typeof item.extracted_data === 'string') {
          try { extractedDataObj = JSON.parse(item.extracted_data || '{}'); } catch(e) {}
        } else {
          extractedDataObj = item.extracted_data || item.resultado || {};
        }

        const notaFinal = item.nota_final || item.notaFinal || (extractedDataObj?.avaliacoes?.enem?.nota_total_enem) || (extractedDataObj?.pontuacao_geral) || 0;
        const imagemBase64 = item.imagem_base64 || item.imagemBase64 || null;
        const textoDigitado = item.texto_digitado || item.textoDigitado || null;
        const tipoInput = item.tipo_input || item.tipoInput || 'imagem';
        const nomeDetectado = 1;
        const statusValidacao = item.status_validacao || 'VALIDADA';
        const validadoPor = req.user?.id || 1;
        const dataValidacao = item.data_validacao || new Date().toISOString();

        const resolved = await resolveStudent(item.user_id, rawNome, rawTurma);

        const { data: existing } = await supabase
          .from('redacoes')
          .select('id')
          .eq('nome_aluno', resolved.nome_aluno)
          .eq('data_captura', dataCaptura)
          .maybeSingle();

        if (existing) {
          await supabase.from('redacoes').update({
            user_id: resolved.user_id,
            nome_aluno: resolved.nome_aluno,
            turma_aluno: resolved.turma_aluno,
            extracted_data: extractedDataObj,
            nota_final: notaFinal,
            status_validacao: statusValidacao,
            imagem_base64: imagemBase64,
            texto_digitado: textoDigitado,
            validado_por: validadoPor,
            data_validacao: dataValidacao,
            is_synced: 1
          }).eq('id', existing.id);
          insertedCount++;
          continue;
        }

        const nextId = await getNextId('redacoes');
        const { error: insErr } = await supabase.from('redacoes').insert({
          ...(nextId ? { id: nextId } : {}),
          user_id: resolved.user_id,
          nome_aluno: resolved.nome_aluno,
          turma_aluno: resolved.turma_aluno,
          nome_detectado: nomeDetectado,
          data_captura: dataCaptura,
          tipo_input: tipoInput,
          imagem_base64: imagemBase64,
          texto_digitado: textoDigitado,
          is_synced: 1,
          extracted_data: extractedDataObj,
          nota_final: notaFinal,
          status_validacao: statusValidacao,
          validado_por: validadoPor,
          data_validacao: dataValidacao
        });

        if (insErr) {
          console.error('[Supabase Sync Insert Error]:', insErr.message);
        } else {
          insertedCount++;
        }
      }
    } else {
      const checkStmt = db.prepare(`
        SELECT id FROM redacoes 
        WHERE nome_aluno = ? AND data_captura = ?
      `);

      const findUserStmt = db.prepare(`
        SELECT id FROM users 
        WHERE LOWER(TRIM(nome)) = LOWER(TRIM(?)) AND role = 'ESTUDANTE'
      `);

      const insertStmt = db.prepare(`
        INSERT INTO redacoes (
          user_id, nome_aluno, turma_aluno, nome_detectado, data_captura,
          tipo_input, imagem_base64, texto_digitado, is_synced, extracted_data, nota_final,
          status_validacao, validado_por, data_validacao
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
      `);

      const syncTransaction = db.transaction((items) => {
        for (const item of items) {
          const nomeAluno = item.nome_aluno || item.nomeAluno || 'Aluno Não Identificado';
          const dataCaptura = item.data_captura || item.dataCaptura || new Date().toISOString();

          const existing = checkStmt.get(nomeAluno, dataCaptura);
          if (existing) {
            skippedCount++;
            continue;
          }

          let userId = item.user_id || null;
          if (!userId && nomeAluno && nomeAluno.trim().length >= 3) {
            const matchedUser = findUserStmt.get(nomeAluno.trim());
            if (matchedUser) userId = matchedUser.id;
          }

          const extractedDataStr = typeof item.extracted_data === 'string'
            ? item.extracted_data
            : JSON.stringify(item.extracted_data || item.resultado || {});

          const notaFinal = item.nota_final || item.notaFinal || (item.extracted_data?.pontuacao_geral) || 0;
          const imagemBase64 = item.imagem_base64 || item.imagemBase64 || null;
          const textoDigitado = item.texto_digitado || item.textoDigitado || null;
          const tipoInput = item.tipo_input || item.tipoInput || 'imagem';
          const turmaAluno = item.turma_aluno || item.turmaAluno || 'Turma Geral';
          const nomeDetectado = item.nome_detectado ? 1 : 0;
          const statusValidacao = item.status_validacao || 'VALIDADA';
          const validadoPor = req.user?.id || null;
          const dataValidacao = new Date().toISOString();

          insertStmt.run(
            userId,
            nomeAluno,
            turmaAluno,
            nomeDetectado,
            dataCaptura,
            tipoInput,
            imagemBase64,
            textoDigitado,
            extractedDataStr,
            notaFinal,
            statusValidacao,
            validadoPor,
            dataValidacao
          );
          insertedCount++;
        }
      });

      syncTransaction(redacoes);
    }

    res.status(200).json({
      message: `${insertedCount} correções locais sincronizadas e disponibilizadas com sucesso! (${skippedCount} já existiam)`,
      insertedCount,
      skippedCount
    });
  } catch (error) {
    console.error('[Redacao Sync Error]:', error);
    res.status(500).json({ error: 'Falha ao sincronizar correções com a nuvem.' });
  }
};

// GET /api/redacoes
export const getRedacoes = async (req, res) => {
  try {
    const user = req.user;
    const includeImage = req.query.include_image === 'true';
    let formatted = [];

    // Se não houver usuário autenticado, não expõe lista de redações
    if (!user) {
      return res.status(200).json({ redacoes: [] });
    }

    // Enable Vercel Edge caching with stale-while-revalidate
    res.setHeader('Cache-Control', 'public, s-maxage=5, stale-while-revalidate=30');

    if (isSupabaseConfigured) {
      const selectFields = includeImage
        ? '*'
        : 'id, user_id, nome_aluno, turma_aluno, nome_detectado, data_captura, tipo_input, texto_digitado, is_synced, extracted_data, nota_final, status_validacao, validado_por, data_validacao';

      let query = supabase
        .from('redacoes')
        .select(selectFields)
        .order('data_captura', { ascending: false });

      // Estudante só recebe suas próprias redações validadas
      if (user.role !== 'ADMIN') {
        const cleanStudentName = (user.nome || '').trim();
        query = query.eq('status_validacao', 'VALIDADA').or(`user_id.eq.${user.id},nome_aluno.ilike.${cleanStudentName}`);
      }

      const { data, error } = await query;
      if (error) {
        console.error('[Supabase GetRedacoes Error]:', error.message);
      } else {
        formatted = (data || []).map(r => ({
          id: r.id,
          user_id: r.user_id,
          nome_aluno: r.nome_aluno,
          turma_aluno: r.turma_aluno,
          nome_detectado: Boolean(r.nome_detectado),
          data_captura: r.data_captura,
          tipo_input: r.tipo_input,
          imagem_base64: r.imagem_base64 || null,
          texto_digitado: r.texto_digitado,
          is_synced: Boolean(r.is_synced),
          extracted_data: typeof r.extracted_data === 'string' ? JSON.parse(r.extracted_data || '{}') : (r.extracted_data || {}),
          nota_final: r.nota_final,
          status_validacao: r.status_validacao || 'VALIDADA',
          validado_por: r.validado_por,
          data_validacao: r.data_validacao
        }));
      }
    }

    if (formatted.length === 0 && !isSupabaseConfigured && db) {
      let rows;
      if (user.role === 'ADMIN') {
        rows = db.prepare(`
          SELECT r.id, r.user_id, r.nome_aluno, r.turma_aluno, r.nome_detectado, r.data_captura,
                 r.tipo_input, r.texto_digitado, r.is_synced, r.extracted_data, r.nota_final,
                 r.status_validacao, r.validado_por, r.data_validacao,
                 u.email as user_email, v.nome as nome_validador
          FROM redacoes r
          LEFT JOIN users u ON r.user_id = u.id
          LEFT JOIN users v ON r.validado_por = v.id
          ORDER BY r.data_captura DESC
        `).all();
      } else {
        const cleanStudentName = (user.nome || '').trim();
        rows = db.prepare(`
          SELECT r.id, r.user_id, r.nome_aluno, r.turma_aluno, r.nome_detectado, r.data_captura,
                 r.tipo_input, r.texto_digitado, r.is_synced, r.extracted_data, r.nota_final,
                 r.status_validacao, r.validado_por, r.data_validacao,
                 u.email as user_email, v.nome as nome_validador
          FROM redacoes r
          LEFT JOIN users u ON r.user_id = u.id
          LEFT JOIN users v ON r.validado_por = v.id
          WHERE (r.user_id = ? 
             OR (r.user_id IS NULL AND LOWER(TRIM(r.nome_aluno)) = LOWER(TRIM(?))))
            AND r.status_validacao = 'VALIDADA'
          ORDER BY r.data_captura DESC
        `).all(user.id, cleanStudentName);
      }

      formatted = rows.map(row => {
        let extractedData = {};
        try {
          extractedData = JSON.parse(row.extracted_data || '{}');
        } catch (e) {
          extractedData = {};
        }

        return {
          id: row.id,
          user_id: row.user_id,
          nome_aluno: row.nome_aluno,
          turma_aluno: row.turma_aluno,
          nome_detectado: Boolean(row.nome_detectado),
          data_captura: row.data_captura,
          tipo_input: row.tipo_input,
          imagem_base64: null,
          texto_digitado: row.texto_digitado,
          is_synced: Boolean(row.is_synced),
          extracted_data: extractedData,
          nota_final: row.nota_final,
          status_validacao: row.status_validacao || 'VALIDADA',
          validado_por: row.validado_por,
          nome_validador: row.nome_validador,
          data_validacao: row.data_validacao,
          user_email: row.user_email
        };
      });
    }

    res.status(200).json({ redacoes: formatted });
  } catch (error) {
    console.error('[Get Redacoes Error]:', error);
    res.status(500).json({ error: 'Erro ao buscar redações.' });
  }
};

// GET /api/redacoes/ranking
// Retorna as redações validadas ordenadas por pontuação e critérios de desempate ENEM
export const getRanking = async (req, res) => {
  try {
    let formatted = [];

    // Cache CDN na borda por 15 segundos com background revalidation
    res.setHeader('Cache-Control', 'public, s-maxage=15, stale-while-revalidate=60');

    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('redacoes')
        .select('id, user_id, nome_aluno, turma_aluno, nota_final, data_captura, status_validacao, extracted_data, is_synced')
        .eq('status_validacao', 'VALIDADA')
        .order('nota_final', { ascending: false });

      if (error) {
        console.error('[Supabase GetRanking Error]:', error.message);
      } else {
        formatted = (data || []).map(r => ({
          id: r.id,
          user_id: r.user_id,
          nome_aluno: r.nome_aluno,
          turma_aluno: r.turma_aluno,
          nota_final: r.nota_final,
          data_captura: r.data_captura,
          status_validacao: r.status_validacao,
          extracted_data: typeof r.extracted_data === 'string' ? JSON.parse(r.extracted_data || '{}') : (r.extracted_data || {}),
          is_synced: true
        }));
      }
    }

    if (formatted.length === 0 && !isSupabaseConfigured && db) {
      const rows = db.prepare(`
        SELECT id, user_id, nome_aluno, turma_aluno, nota_final, data_captura, status_validacao, extracted_data, is_synced
        FROM redacoes
        WHERE status_validacao = 'VALIDADA'
        ORDER BY nota_final DESC
      `).all();

      formatted = rows.map(r => ({
        ...r,
        extracted_data: typeof r.extracted_data === 'string' ? JSON.parse(r.extracted_data || '{}') : (r.extracted_data || {}),
        is_synced: true
      }));
    }

    // Ordenação com critérios oficiais de desempate ENEM:
    // 1. Nota Final Total
    // 2. Competência 1: Norma Culta
    // 3. Competência 4: Coesão
    // 4. Competência 3: Coerência & Argumentação
    // 5. Competência 2: Tema & Repertório
    // 6. Competência 5: Proposta de Intervenção
    formatted.sort((a, b) => {
      if ((b.nota_final || 0) !== (a.nota_final || 0)) {
        return (b.nota_final || 0) - (a.nota_final || 0);
      }
      const getComp = (item, key) => {
        const ext = item.extracted_data || {};
        return ext?.avaliacoes?.enem?.[key]?.nota || 0;
      };
      const bC1 = getComp(b, 'competencia_1');
      const aC1 = getComp(a, 'competencia_1');
      if (bC1 !== aC1) return bC1 - aC1;

      const bC4 = getComp(b, 'competencia_4');
      const aC4 = getComp(a, 'competencia_4');
      if (bC4 !== aC4) return bC4 - aC4;

      const bC3 = getComp(b, 'competencia_3');
      const aC3 = getComp(a, 'competencia_3');
      if (bC3 !== aC3) return bC3 - aC3;

      const bC2 = getComp(b, 'competencia_2');
      const aC2 = getComp(a, 'competencia_2');
      if (bC2 !== aC2) return bC2 - aC2;

      const bC5 = getComp(b, 'competencia_5');
      const aC5 = getComp(a, 'competencia_5');
      if (bC5 !== aC5) return bC5 - aC5;

      const aName = (a.nome_aluno || '').trim().toLowerCase();
      const bName = (b.nome_aluno || '').trim().toLowerCase();
      return aName.localeCompare(bName);
    });

    return res.status(200).json({ ranking: formatted });
  } catch (err) {
    console.error('[GetRanking Error]:', err);
    return res.status(500).json({ error: 'Erro ao carregar o ranking de notas.' });
  }
};

// POST /api/redacoes
export const createRedacao = async (req, res) => {
  try {
    const {
      user_id,
      nome_aluno,
      turma_aluno,
      tipo_input,
      imagem_base64,
      texto_digitado,
      extracted_data,
      nota_final,
      status_validacao
    } = req.body;

    const initialStatus = status_validacao || (req.user?.role === 'ADMIN' ? 'VALIDADA' : 'PENDENTE_VALIDACAO');
    const validadoPor = initialStatus === 'VALIDADA' ? (req.user?.id || 1) : null;
    const dataValidacao = initialStatus === 'VALIDADA' ? new Date().toISOString() : null;

    const resolved = await resolveStudent(user_id, nome_aluno, turma_aluno);

    if (isSupabaseConfigured) {
      const nextId = await getNextId('redacoes');
      const { data, error } = await supabase
        .from('redacoes')
        .insert({
          ...(nextId ? { id: nextId } : {}),
          user_id: resolved.user_id,
          nome_aluno: resolved.nome_aluno,
          turma_aluno: resolved.turma_aluno,
          nome_detectado: 1,
          tipo_input: tipo_input || 'imagem',
          imagem_base64: imagem_base64 || null,
          texto_digitado: texto_digitado || null,
          is_synced: 1,
          extracted_data: extracted_data || {},
          nota_final: nota_final || (extracted_data?.pontuacao_geral) || 0,
          status_validacao: initialStatus,
          validado_por: validadoPor,
          data_validacao: dataValidacao
        })
        .select('id')
        .single();

      if (error) throw error;

      return res.status(201).json({
        message: 'Redação registrada com sucesso!',
        id: data.id,
        status_validacao: initialStatus,
        user_id: resolved.user_id,
        nome_aluno: resolved.nome_aluno,
        turma_aluno: resolved.turma_aluno
      });
    }

    const extractedDataStr = typeof extracted_data === 'string'
      ? extracted_data
      : JSON.stringify(extracted_data || {});

    const result = db.prepare(`
      INSERT INTO redacoes (
        user_id, nome_aluno, turma_aluno, nome_detectado, data_captura,
        tipo_input, imagem_base64, texto_digitado, is_synced, extracted_data, nota_final,
        status_validacao, validado_por, data_validacao
      ) VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP, ?, ?, ?, 1, ?, ?, ?, ?, ?)
    `).run(
      resolved.user_id,
      resolved.nome_aluno,
      resolved.turma_aluno,
      tipo_input || 'imagem',
      imagem_base64 || null,
      texto_digitado || null,
      extractedDataStr,
      nota_final || (extracted_data?.pontuacao_geral) || 0,
      initialStatus,
      validadoPor,
      dataValidacao
    );

    res.status(201).json({
      message: 'Redação registrada com sucesso!',
      id: result.lastInsertRowid,
      status_validacao: initialStatus,
      user_id: resolved.user_id,
      nome_aluno: resolved.nome_aluno,
      turma_aluno: resolved.turma_aluno
    });
  } catch (error) {
    console.error('[Create Redacao Error]:', error);
    res.status(500).json({ error: 'Erro ao salvar redação.' });
  }
};

// PATCH /api/redacoes/:id/vincular
export const vincularAlunoRedacao = async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id, nome_aluno, turma_aluno } = req.body;

    const resolved = await resolveStudent(user_id, nome_aluno, turma_aluno);
    const validadoPor = req.user?.id || 1;
    const dataValidacao = new Date().toISOString();

    if (isSupabaseConfigured) {
      const { error } = await supabase
        .from('redacoes')
        .update({
          user_id: resolved.user_id,
          nome_aluno: resolved.nome_aluno,
          turma_aluno: resolved.turma_aluno,
          nome_detectado: 1,
          status_validacao: 'VALIDADA',
          validado_por: validadoPor,
          data_validacao: dataValidacao
        })
        .eq('id', id);

      if (error) throw error;

      return res.status(200).json({
        message: `Redação ID #${id} vinculada ao aluno ${resolved.nome_aluno} com sucesso!`,
        user_id: resolved.user_id,
        nome_aluno: resolved.nome_aluno,
        turma_aluno: resolved.turma_aluno,
        status_validacao: 'VALIDADA',
        validado_por: validadoPor,
        data_validacao: dataValidacao
      });
    }

    const redacao = db.prepare('SELECT * FROM redacoes WHERE id = ?').get(id);
    if (!redacao) {
      return res.status(404).json({ error: 'Redação não encontrada.' });
    }

    db.prepare(`
      UPDATE redacoes 
      SET user_id = ?, nome_aluno = ?, turma_aluno = ?, nome_detectado = 1,
          status_validacao = 'VALIDADA', validado_por = ?, data_validacao = ?
      WHERE id = ?
    `).run(resolved.user_id, resolved.nome_aluno, resolved.turma_aluno, validadoPor, dataValidacao, id);

    res.status(200).json({
      message: `Redação ID #${id} vinculada com sucesso!`,
      user_id: resolved.user_id,
      nome_aluno: resolved.nome_aluno,
      turma_aluno: resolved.turma_aluno,
      status_validacao: 'VALIDADA',
      validado_por: validadoPor,
      data_validacao: dataValidacao
    });
  } catch (error) {
    console.error('[Vincular Redacao Error]:', error);
    res.status(500).json({ error: 'Erro ao vincular aluno à redação.' });
  }
};

// PATCH /api/redacoes/:id/validar
export const validarRedacao = async (req, res) => {
  try {
    const { id } = req.params;
    const { nota_final, extracted_data, parecer_professor } = req.body;

    if (isSupabaseConfigured) {
      const { data: current } = await supabase
        .from('redacoes')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (!current) {
        return res.status(404).json({ error: 'Redação não encontrada.' });
      }

      let updatedExtractedData = typeof current.extracted_data === 'string'
        ? JSON.parse(current.extracted_data || '{}')
        : (current.extracted_data || {});

      if (extracted_data) {
        updatedExtractedData = { ...updatedExtractedData, ...extracted_data };
      }
      if (parecer_professor) {
        updatedExtractedData.parecer_professor = parecer_professor;
      }

      const finalNota = typeof nota_final === 'number' ? nota_final : current.nota_final;

      const { error } = await supabase
        .from('redacoes')
        .update({
          status_validacao: 'VALIDADA',
          validado_por: req.user.id,
          data_validacao: new Date().toISOString(),
          nota_final: finalNota,
          extracted_data: updatedExtractedData
        })
        .eq('id', id);

      if (error) throw error;

      return res.status(200).json({
        message: 'Correção validada com sucesso pelo professor! Liberada para o aluno.',
        status_validacao: 'VALIDADA'
      });
    }

    const current = db.prepare('SELECT * FROM redacoes WHERE id = ?').get(id);
    if (!current) {
      return res.status(404).json({ error: 'Redação não encontrada.' });
    }

    let updatedExtractedData = {};
    try {
      updatedExtractedData = JSON.parse(current.extracted_data || '{}');
    } catch (e) {
      updatedExtractedData = {};
    }

    if (extracted_data) {
      updatedExtractedData = { ...updatedExtractedData, ...extracted_data };
    }

    if (parecer_professor) {
      updatedExtractedData.parecer_professor = parecer_professor;
    }

    const finalNota = typeof nota_final === 'number' ? nota_final : current.nota_final;
    const extractedDataStr = JSON.stringify(updatedExtractedData);

    db.prepare(`
      UPDATE redacoes
      SET status_validacao = 'VALIDADA',
          validado_por = ?,
          data_validacao = CURRENT_TIMESTAMP,
          nota_final = ?,
          extracted_data = ?
      WHERE id = ?
    `).run(req.user.id, finalNota, extractedDataStr, id);

    res.status(200).json({
      message: 'Correção validada com sucesso pelo professor! Liberada para o aluno.',
      status_validacao: 'VALIDADA'
    });
  } catch (error) {
    console.error('[Validar Redacao Error]:', error);
    res.status(500).json({ error: 'Erro ao validar redação.' });
  }
};

// DELETE /api/redacoes/clear-all (Admin wipes all redações)
export const deleteAllRedacoes = async (req, res) => {
  try {
    if (isSupabaseConfigured) {
      const { error } = await supabase.from('redacoes').delete().neq('id', 0);
      if (error) throw error;
      return res.status(200).json({ message: 'Todas as redações foram apagadas com sucesso.' });
    }

    const result = db.prepare('DELETE FROM redacoes').run();
    res.status(200).json({
      message: 'Todas as redações foram apagadas com sucesso.',
      count: result.changes
    });
  } catch (error) {
    console.error('[Delete All Redacoes Error]:', error);
    res.status(500).json({ error: 'Erro ao apagar redações.' });
  }
};

// DELETE /api/redacoes/:id
export const deleteRedacao = async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user && req.user.role === 'ESTUDANTE') {
      return res.status(403).json({ error: 'Apenas professores/administradores podem excluir redações.' });
    }

    if (isSupabaseConfigured) {
      const { error } = await supabase.from('redacoes').delete().eq('id', id);
      if (error) {
        console.error('[Delete Redacao Supabase Error]:', error.message);
        throw error;
      }
    }

    if (db) {
      try {
        db.prepare('DELETE FROM redacoes WHERE id = ?').run(id);
      } catch (dbErr) {
        console.warn('[Delete Redacao SQLite Warning]:', dbErr.message);
      }
    }

    return res.status(200).json({ message: 'Redação excluída com sucesso do banco de dados.' });
  } catch (error) {
    console.error('[Delete Redacao Error]:', error);
    res.status(500).json({ error: 'Erro ao excluir redação.' });
  }
};

// GET /api/export-db or /api/redacoes/export-db
export const exportDatabase = async (req, res) => {
  try {
    let users = [];
    let redacoes = [];

    if (isSupabaseConfigured) {
      const { data: uData } = await supabase.from('users').select('*');
      const { data: rData } = await supabase.from('redacoes').select('*');
      users = uData || [];
      redacoes = rData || [];
    } else {
      users = db.prepare('SELECT id, nome, email, senha_hash, role, turma, created_at FROM users').all();
      redacoes = db.prepare('SELECT * FROM redacoes').all();
    }

    const formattedRedacoes = redacoes.map(r => {
      let ext = r.extracted_data;
      if (typeof ext === 'string') {
        try { ext = JSON.parse(ext); } catch(e) {}
      }
      return {
        ...r,
        extracted_data: ext
      };
    });

    const backup = {
      exported_at: new Date().toISOString(),
      counts: {
        users: users.length,
        redacoes: formattedRedacoes.length
      },
      users,
      redacoes: formattedRedacoes
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="agora-db-backup.json"');
    return res.status(200).send(JSON.stringify(backup, null, 2));
  } catch (error) {
    console.error('[Export DB Error]:', error);
    return res.status(500).json({ error: 'Falha ao exportar banco de dados.', details: error.message });
  }
};

// GET /api/redacoes/:id
// Retorna os dados completos de uma redação, incluindo imagem_base64 sob demanda
export const getRedacaoById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    res.setHeader('Cache-Control', 'public, s-maxage=10, stale-while-revalidate=60');

    let redacao = null;

    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('redacoes')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        console.error('[Supabase GetRedacaoById Error]:', error.message);
      } else if (data) {
        redacao = {
          ...data,
          nome_detectado: Boolean(data.nome_detectado),
          is_synced: Boolean(data.is_synced),
          extracted_data: typeof data.extracted_data === 'string' ? JSON.parse(data.extracted_data || '{}') : (data.extracted_data || {}),
          status_validacao: data.status_validacao || 'VALIDADA'
        };
      }
    }

    if (!redacao && db) {
      const row = db.prepare(`
        SELECT r.*, u.email as user_email, v.nome as nome_validador
        FROM redacoes r
        LEFT JOIN users u ON r.user_id = u.id
        LEFT JOIN users v ON r.validado_por = v.id
        WHERE r.id = ?
      `).get(id);

      if (row) {
        redacao = {
          ...row,
          nome_detectado: Boolean(row.nome_detectado),
          is_synced: Boolean(row.is_synced),
          extracted_data: typeof row.extracted_data === 'string' ? JSON.parse(row.extracted_data || '{}') : (row.extracted_data || {}),
          status_validacao: row.status_validacao || 'VALIDADA'
        };
      }
    }

    if (!redacao) {
      return res.status(404).json({ error: 'Redação não encontrada.' });
    }

    // Controle de acesso estrito: apenas o próprio estudante ou professores/admins podem ver o texto integral e a imagem
    if (!user) {
      return res.status(401).json({ error: 'Autenticação necessária para visualizar a redação.' });
    }

    if (user.role !== 'ADMIN') {
      const cleanStudentName = (user.nome || '').trim().toLowerCase();
      const alunoNome = (redacao.nome_aluno || '').trim().toLowerCase();
      const isOwner = (redacao.user_id && Number(redacao.user_id) === Number(user.id)) || (alunoNome && alunoNome === cleanStudentName);
      if (!isOwner) {
        return res.status(403).json({ error: 'Você só tem permissão para visualizar suas próprias redações.' });
      }
    }

    return res.status(200).json(redacao);
  } catch (error) {
    console.error('[Get Redacao By Id Error]:', error);
    return res.status(500).json({ error: 'Erro ao carregar detalhes da redação.' });
  }
};

