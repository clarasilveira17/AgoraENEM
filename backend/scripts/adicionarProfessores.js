import bcrypt from 'bcryptjs';
import { supabase, isSupabaseConfigured } from '../src/config/supabaseClient.js';
import db from '../src/config/db.js';

const professores = [
  {
    nome: 'Prof. João Castro',
    email: 'joao.castro3@prof.ce.gov.br',
    role: 'ADMIN',
    turma: 'Coordenação Pedagógica'
  },
  {
    nome: 'Profa. Francisca Albuquerque',
    email: 'francisca.albuquerque1@prof.ce.gov.br',
    role: 'ADMIN',
    turma: 'Coordenação Pedagógica'
  },
  {
    nome: 'Prof. Janailson Silveira',
    email: 'janailson.silveira@prof.ce.gov.br',
    role: 'ADMIN',
    turma: 'Coordenação Pedagógica'
  },
  {
    nome: 'Prof. Janailson Silveira',
    email: 'janailson.silveira@prof.ce.gov',
    role: 'ADMIN',
    turma: 'Coordenação Pedagógica'
  }
];

const DEFAULT_PASSWORD = 'Agora@2026';
const senhaHash = bcrypt.hashSync(DEFAULT_PASSWORD, 10);

async function getNextSupabaseId() {
  const { data, error } = await supabase
    .from('users')
    .select('id')
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!error && data && data.id) {
    return Number(data.id) + 1;
  }
  return 1;
}

async function cadastrarProfessores() {
  console.log('=== CADASTRANDO PROFESSORES NO SISTEMA ===\n');

  for (const prof of professores) {
    const cleanEmail = prof.email.trim().toLowerCase();
    const cleanNome = prof.nome.trim();
    const cleanRole = prof.role;
    const cleanTurma = prof.turma;

    console.log(`\n--- Processando: ${cleanNome} (${cleanEmail}) ---`);

    // 1. Supabase
    if (isSupabaseConfigured) {
      try {
        const { data: existing, error: checkErr } = await supabase
          .from('users')
          .select('id, email, nome')
          .ilike('email', cleanEmail)
          .maybeSingle();

        if (checkErr) {
          console.warn(`[Supabase Check Error]: ${checkErr.message}`);
        }

        if (existing) {
          console.log(`Usuário já existe no Supabase (ID: ${existing.id}). Atualizando...`);
          const { data, error } = await supabase
            .from('users')
            .update({
              nome: cleanNome,
              role: cleanRole,
              turma: cleanTurma,
              senha_hash: senhaHash
            })
            .eq('id', existing.id)
            .select('id, nome, email, role, turma')
            .single();

          if (error) console.error(`[Supabase Update Error]: ${error.message}`);
          else console.log(`✅ Supabase atualizado com sucesso:`, data);
        } else {
          let { data, error } = await supabase
            .from('users')
            .insert({
              nome: cleanNome,
              email: cleanEmail,
              senha_hash: senhaHash,
              role: cleanRole,
              turma: cleanTurma
            })
            .select('id, nome, email, role, turma')
            .single();

          if (error && (error.code === '23505' || String(error.message).includes('users_pkey'))) {
            const nextId = await getNextSupabaseId();
            const retry = await supabase
              .from('users')
              .insert({
                id: nextId,
                nome: cleanNome,
                email: cleanEmail,
                senha_hash: senhaHash,
                role: cleanRole,
                turma: cleanTurma
              })
              .select('id, nome, email, role, turma')
              .single();

            data = retry.data;
            error = retry.error;
          }

          if (error) console.error(`[Supabase Insert Error]: ${error.message}`);
          else console.log(`✅ Supabase inserido com sucesso:`, data);
        }
      } catch (sbErr) {
        console.error(`[Supabase Exception]: ${sbErr.message}`);
      }
    }

    // 2. SQLite Local
    if (db) {
      try {
        const localExisting = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(cleanEmail);
        if (localExisting) {
          db.prepare('UPDATE users SET nome = ?, role = ?, turma = ?, senha_hash = ? WHERE id = ?')
            .run(cleanNome, cleanRole, cleanTurma, senhaHash, localExisting.id);
          console.log(`✅ SQLite local atualizado (ID: ${localExisting.id})`);
        } else {
          const info = db.prepare(`
            INSERT INTO users (nome, email, senha_hash, role, turma)
            VALUES (?, ?, ?, ?, ?)
          `).run(cleanNome, cleanEmail, senhaHash, cleanRole, cleanTurma);
          console.log(`✅ SQLite local inserido (ID: ${info.lastInsertRowid})`);
        }
      } catch (dbErr) {
        console.error(`[SQLite Error]: ${dbErr.message}`);
      }
    }
  }

  console.log('\n=== PROCESSO CONCLUÍDO COM SUCESSO ===');
}

cadastrarProfessores();
