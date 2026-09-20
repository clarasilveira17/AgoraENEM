import db from '../config/db.js';
import { supabase, isSupabaseConfigured } from '../config/supabaseClient.js';
import { resolveStudent } from '../utils/turmasUtils.js';

export const redacaoRepository = {
  async findAll({ user, includeImage = false }) {
    if (!user) return [];

    let formatted = [];

    if (isSupabaseConfigured) {
      const selectFields = includeImage
        ? '*'
        : 'id, user_id, nome_aluno, turma_aluno, nome_detectado, data_captura, tipo_input, texto_digitado, is_synced, extracted_data, nota_final, status_validacao, validado_por, data_validacao';

      let query = supabase
        .from('redacoes')
        .select(selectFields)
        .order('data_captura', { ascending: false });

      if (user.role !== 'ADMIN') {
        const cleanStudentName = (user.nome || '').trim();
        query = query.eq('status_validacao', 'VALIDADA').or(`user_id.eq.${user.id},nome_aluno.ilike.${cleanStudentName}`);
      }

      const { data, error } = await query;
      if (!error && data) {
        formatted = data.map(r => ({
          ...r,
          nome_detectado: Boolean(r.nome_detectado),
          is_synced: Boolean(r.is_synced),
          extracted_data: typeof r.extracted_data === 'string' ? JSON.parse(r.extracted_data || '{}') : (r.extracted_data || {}),
          status_validacao: r.status_validacao || 'VALIDADA'
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

      formatted = rows.map(row => ({
        ...row,
        nome_detectado: Boolean(row.nome_detectado),
        is_synced: Boolean(row.is_synced),
        extracted_data: typeof row.extracted_data === 'string' ? JSON.parse(row.extracted_data || '{}') : (row.extracted_data || {}),
        status_validacao: row.status_validacao || 'VALIDADA',
        imagem_base64: null
      }));
    }

    return formatted;
  },

  async findById(id) {
    let redacao = null;

    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('redacoes')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (!error && data) {
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

    return redacao;
  },

  async findRanking() {
    let formatted = [];

    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('redacoes')
        .select('id, user_id, nome_aluno, turma_aluno, nota_final, data_captura, status_validacao, extracted_data, is_synced')
        .eq('status_validacao', 'VALIDADA')
        .order('nota_final', { ascending: false });

      if (!error && data) {
        formatted = data.map(r => ({
          ...r,
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

    // Critérios oficiais de desempate ENEM (C1, C4, C3, C2, C5, Alfabética)
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

    return formatted;
  },

  async getNextAvailableId() {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('redacoes')
          .select('id')
          .order('id', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!error && data && data.id) {
          return Number(data.id) + 1;
        }
      } catch (err) {
        console.warn('[redacaoRepository] Falha ao consultar MAX(id):', err.message);
      }
    }
    return 1;
  },

  async create(data) {
    let savedId = null;

    if (isSupabaseConfigured) {
      const payload = {
        user_id: data.user_id,
        nome_aluno: data.nome_aluno,
        turma_aluno: data.turma_aluno,
        nome_detectado: data.nome_detectado ?? 1,
        data_captura: data.data_captura || new Date().toISOString(),
        tipo_input: data.tipo_input || 'imagem',
        imagem_base64: data.imagem_base64 || null,
        texto_digitado: data.texto_digitado || null,
        is_synced: 1,
        extracted_data: data.extracted_data || {},
        nota_final: data.nota_final || 0,
        status_validacao: data.status_validacao || 'VALIDADA',
        validado_por: data.validado_por || null,
        data_validacao: data.data_validacao || null
      };

      // 1. Primeira tentativa: inserção padrão usando a sequence do PostgreSQL
      let { data: inserted, error } = await supabase
        .from('redacoes')
        .insert(payload)
        .select('id')
        .single();

      // 2. Fallback de sequence desincronizada: se houver conflito de redacoes_pkey, calcula MAX(id) + 1 e insere com ID explícito
      if (error && (error.code === '23505' || String(error.message).includes('redacoes_pkey'))) {
        console.warn('[redacaoRepository.create] Conflito de redacoes_pkey detectado. Recuperando sequence com MAX(id) + 1...');
        
        let attempts = 0;
        let success = false;
        
        while (attempts < 3 && !success) {
          attempts++;
          const nextId = await this.getNextAvailableId() + (attempts - 1);
          const retryRes = await supabase
            .from('redacoes')
            .insert({ ...payload, id: nextId })
            .select('id')
            .single();

          if (!retryRes.error && retryRes.data) {
            inserted = retryRes.data;
            error = null;
            success = true;
            break;
          } else {
            error = retryRes.error;
          }
        }
      }

      if (error) {
        console.error('[redacaoRepository.create] Erro ao inserir no Supabase:', error);
        throw new Error(error.message || 'Erro ao persistir redação no Supabase');
      }

      if (inserted) {
        savedId = inserted.id;
      }
    }

    if (db) {
      try {
        let sqliteUserId = data.user_id ? Number(data.user_id) : null;
        let sqliteValidadoPor = data.validado_por ? Number(data.validado_por) : null;

        // Verifica integridade referencial no SQLite antes de inserir para evitar 'FOREIGN KEY constraint failed'
        if (sqliteUserId) {
          const userRow = db.prepare('SELECT id FROM users WHERE id = ?').get(sqliteUserId);
          if (!userRow) sqliteUserId = null;
        }

        if (sqliteValidadoPor) {
          const valRow = db.prepare('SELECT id FROM users WHERE id = ?').get(sqliteValidadoPor);
          if (!valRow) sqliteValidadoPor = null;
        }

        const extractedDataStr = typeof data.extracted_data === 'string'
          ? data.extracted_data
          : JSON.stringify(data.extracted_data || {});

        const result = db.prepare(`
          INSERT INTO redacoes (
            user_id, nome_aluno, turma_aluno, nome_detectado, data_captura,
            tipo_input, imagem_base64, texto_digitado, is_synced, extracted_data, nota_final,
            status_validacao, validado_por, data_validacao
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
        `).run(
          sqliteUserId,
          data.nome_aluno,
          data.turma_aluno,
          data.nome_detectado ?? 1,
          data.data_captura || new Date().toISOString(),
          data.tipo_input || 'imagem',
          data.imagem_base64 || null,
          data.texto_digitado || null,
          extractedDataStr,
          data.nota_final || 0,
          data.status_validacao || 'VALIDADA',
          sqliteValidadoPor,
          data.data_validacao || null
        );

        if (!savedId) savedId = result.lastInsertRowid;
      } catch (sqliteErr) {
        console.warn('[redacaoRepository.create SQLite Warning]:', sqliteErr.message);
        if (!savedId && !isSupabaseConfigured) {
          throw sqliteErr;
        }
      }
    }

    return savedId;
  },

  async update(id, updates) {
    if (isSupabaseConfigured) {
      const { error } = await supabase.from('redacoes').update(updates).eq('id', id);
      if (error) console.error('[redacaoRepository.update Supabase Error]:', error.message);
    }

    if (db) {
      try {
        const fields = [];
        const values = [];
        for (const [k, v] of Object.entries(updates)) {
          fields.push(`${k} = ?`);
          values.push(typeof v === 'object' && v !== null ? JSON.stringify(v) : v);
        }
        values.push(id);
        db.prepare(`UPDATE redacoes SET ${fields.join(', ')} WHERE id = ?`).run(...values);
      } catch (err) {
        console.warn('[redacaoRepository.update SQLite Warning]:', err.message);
      }
    }
  },

  async deleteById(id) {
    if (isSupabaseConfigured) {
      const { error } = await supabase.from('redacoes').delete().eq('id', id);
      if (error) throw error;
    }

    if (db) {
      db.prepare('DELETE FROM redacoes WHERE id = ?').run(id);
    }
  },

  async deleteAll() {
    if (isSupabaseConfigured) {
      const { error } = await supabase.from('redacoes').delete().neq('id', 0);
      if (error) throw error;
    }

    if (db) {
      db.prepare('DELETE FROM redacoes').run();
    }
  },

  async exportAll() {
    if (isSupabaseConfigured) {
      const { data } = await supabase.from('redacoes').select('*');
      return (data || []).map(r => ({
        ...r,
        extracted_data: typeof r.extracted_data === 'string' ? JSON.parse(r.extracted_data || '{}') : (r.extracted_data || {})
      }));
    }
    if (db) {
      const rows = db.prepare('SELECT * FROM redacoes').all();
      return rows.map(r => ({
        ...r,
        extracted_data: typeof r.extracted_data === 'string' ? JSON.parse(r.extracted_data || '{}') : (r.extracted_data || {})
      }));
    }
    return [];
  }
};

export default redacaoRepository;
