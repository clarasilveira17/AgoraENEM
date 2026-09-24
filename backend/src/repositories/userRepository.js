import db from '../config/db.js';
import { supabase, isSupabaseConfigured } from '../config/supabaseClient.js';

export const userRepository = {
  async findByEmail(email) {
    let cleanEmail = String(email).trim().toLowerCase();

    // 1. Consulta o SQLite local primeiro (resposta instantânea em 0ms)
    if (db) {
      try {
        let user = db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)').get(cleanEmail);
        if (!user && !cleanEmail.includes('@')) {
          user = db.prepare('SELECT * FROM users WHERE LOWER(email) LIKE LOWER(?) OR LOWER(nome) = LOWER(?)').get(`${cleanEmail}@%`, cleanEmail);
        }
        if (user) return user;
      } catch (err) {
        console.warn('[userRepository.findByEmail SQLite Warning]:', err.message);
      }
    }

    // 2. Consulta o Supabase se configurado
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .ilike('email', cleanEmail)
          .maybeSingle();

        if (error) {
          console.warn(`[userRepository.findByEmail Supabase Warning]: ${error.message}`);
        } else if (data) {
          return data;
        }
      } catch (sbErr) {
        console.warn(`[userRepository.findByEmail Supabase Exception]: ${sbErr.message}`);
      }
    }

    return null;
  },

  async findById(id) {
    if (!id) return null;

    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('users')
        .select('id, nome, email, role, turma')
        .eq('id', id)
        .maybeSingle();

      if (!error && data) return data;
    }

    if (db) {
      try {
        return db.prepare('SELECT id, nome, email, role, turma FROM users WHERE id = ?').get(id) || null;
      } catch (err) {
        console.warn('[userRepository.findById SQLite Warning]:', err.message);
      }
    }

    return null;
  },

  async findStudents() {
    let estudantes = [];

    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('users')
        .select('id, nome, email, turma, created_at')
        .eq('role', 'ESTUDANTE')
        .order('nome', { ascending: true });

      if (!error && data) estudantes = data;
    }

    if (estudantes.length === 0 && db) {
      try {
        estudantes = db.prepare(`
          SELECT id, nome, email, turma, created_at 
          FROM users 
          WHERE role = 'ESTUDANTE' 
          ORDER BY nome ASC
        `).all() || [];
      } catch (err) {
        console.warn('[userRepository.findStudents SQLite Warning]:', err.message);
      }
    }

    return estudantes;
  },

  async getNextAvailableId() {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('id')
          .order('id', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!error && data && data.id) {
          return Number(data.id) + 1;
        }
      } catch (err) {
        console.warn('[userRepository] Falha ao consultar MAX(id):', err.message);
      }
    }
    return 1;
  },

  async createUser({ nome, email, senhaHash, role = 'ESTUDANTE', turma = '' }) {
    const cleanEmail = String(email).trim().toLowerCase();
    const cleanNome = String(nome).trim();
    const cleanTurma = String(turma).trim();

    if (isSupabaseConfigured) {
      try {
        let payload = {
          nome: cleanNome,
          email: cleanEmail,
          senha_hash: senhaHash,
          role,
          turma: cleanTurma
        };

        let { data, error } = await supabase
          .from('users')
          .insert(payload)
          .select('id, nome, email, role, turma')
          .single();

        // Fallback de sequence desincronizada do Postgres
        if (error && (error.code === '23505' || String(error.message).includes('users_pkey'))) {
          console.warn('[userRepository.createUser] Conflito de users_pkey detectado. Recuperando com MAX(id) + 1...');
          let attempts = 0;
          while (attempts < 3) {
            attempts++;
            const nextId = await this.getNextAvailableId() + (attempts - 1);
            const retryRes = await supabase
              .from('users')
              .insert({ ...payload, id: nextId })
              .select('id, nome, email, role, turma')
              .single();

            if (!retryRes.error && retryRes.data) {
              data = retryRes.data;
              error = null;
              break;
            } else {
              error = retryRes.error;
            }
          }
        }

        if (!error && data) return data;
        if (error) console.warn(`[userRepository.createUser Supabase Error]: ${error.message} - tentando fallback SQLite.`);
      } catch (sbErr) {
        console.warn(`[userRepository.createUser Supabase Exception]: ${sbErr.message} - tentando fallback SQLite.`);
      }
    }

    if (db) {
      const result = db.prepare(`
        INSERT INTO users (nome, email, senha_hash, role, turma)
        VALUES (?, ?, ?, ?, ?)
      `).run(cleanNome, cleanEmail, senhaHash, role, cleanTurma);

      return {
        id: result.lastInsertRowid,
        nome: cleanNome,
        email: cleanEmail,
        role,
        turma: cleanTurma
      };
    }

    throw new Error('Nenhum banco de dados disponível para criação de usuário.');
  },

  async upsertStudent({ nome, email, turma, senhaHash }) {
    const cleanEmail = String(email).trim().toLowerCase();
    const cleanNome = String(nome).trim();
    const cleanTurma = String(turma || 'Geral').trim();

    if (isSupabaseConfigured) {
      try {
        const { data: existing } = await supabase
          .from('users')
          .select('id')
          .ilike('email', cleanEmail)
          .maybeSingle();

        if (existing) {
          const { data, error } = await supabase
            .from('users')
            .update({
              nome: cleanNome,
              turma: cleanTurma,
              senha_hash: senhaHash
            })
            .eq('id', existing.id)
            .select('id, nome, email, turma, role')
            .single();

          if (!error && data) return data;
        } else {
          return await this.createUser({
            nome: cleanNome,
            email: cleanEmail,
            turma: cleanTurma,
            role: 'ESTUDANTE',
            senhaHash
          });
        }
      } catch (sbErr) {
        console.warn(`[userRepository.upsertStudent Supabase Exception]: ${sbErr.message} - tentando fallback SQLite.`);
      }
    }

    if (db) {
      const existing = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(cleanEmail);
      if (existing) {
        db.prepare('UPDATE users SET nome = ?, turma = ?, senha_hash = ? WHERE id = ?')
          .run(cleanNome, cleanTurma, senhaHash, existing.id);
        return {
          id: existing.id,
          nome: cleanNome,
          email: cleanEmail,
          turma: cleanTurma,
          role: 'ESTUDANTE'
        };
      } else {
        const info = db.prepare(`
          INSERT INTO users (nome, email, senha_hash, role, turma)
          VALUES (?, ?, ?, 'ESTUDANTE', ?)
        `).run(cleanNome, cleanEmail, senhaHash, cleanTurma);

        return {
          id: info.lastInsertRowid,
          nome: cleanNome,
          email: cleanEmail,
          turma: cleanTurma,
          role: 'ESTUDANTE'
        };
      }
    }

    throw new Error('Nenhum banco de dados disponível.');
  },

  async exportAll() {
    if (isSupabaseConfigured) {
      const { data } = await supabase.from('users').select('id, nome, email, role, turma, created_at');
      return data || [];
    }
    if (db) {
      return db.prepare('SELECT id, nome, email, role, turma, created_at FROM users').all() || [];
    }
    return [];
  }
};

export default userRepository;
