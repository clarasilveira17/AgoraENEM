import db from '../config/db.js';
import { supabase, isSupabaseConfigured } from '../config/supabaseClient.js';

export const userRepository = {
  async findByEmail(email) {
    const cleanEmail = String(email).trim().toLowerCase();

    if (isSupabaseConfigured) {
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
    }

    if (db) {
      try {
        return db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)').get(cleanEmail) || null;
      } catch (err) {
        console.warn('[userRepository.findByEmail SQLite Warning]:', err.message);
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

  async createUser({ nome, email, senhaHash, role = 'ESTUDANTE', turma = '' }) {
    const cleanEmail = String(email).trim().toLowerCase();
    const cleanNome = String(nome).trim();
    const cleanTurma = String(turma).trim();

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('users')
          .insert({
            nome: cleanNome,
            email: cleanEmail,
            senha_hash: senhaHash,
            role,
            turma: cleanTurma
          })
          .select('id, nome, email, role, turma')
          .single();

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
        const { data, error } = await supabase
          .from('users')
          .upsert({
            nome: cleanNome,
            email: cleanEmail,
            turma: cleanTurma,
            role: 'ESTUDANTE',
            senha_hash: senhaHash
          }, { onConflict: 'email' })
          .select('id, nome, email, turma, role')
          .single();

        if (!error && data) return data;
        if (error) console.warn(`[userRepository.upsertStudent Supabase Error]: ${error.message} - tentando fallback SQLite.`);
      } catch (sbErr) {
        console.warn(`[userRepository.upsertStudent Supabase Exception]: ${sbErr.message} - tentando fallback SQLite.`);
      }
    }

    if (db) {
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
