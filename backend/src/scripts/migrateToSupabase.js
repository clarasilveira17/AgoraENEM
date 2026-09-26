import db from '../config/db.js';
import { supabase } from '../config/supabaseClient.js';
import fs from 'fs';
import path from 'path';

export async function migrateAllData() {
  console.log('=== INICIANDO MIGRAÇÃO PARA O SUPABASE ===');

  if (!supabase) {
    console.error('Supabase client não está inicializado.');
    return;
  }

  // 1. Migrar Usuários do SQLite
  console.log('\n--- 1. Migrando Usuários ---');
  const validUserIds = new Set();
  if (db) {
    const users = db.prepare('SELECT * FROM users').all();
    console.log(`Encontrados ${users.length} usuários no SQLite local.`);
    for (const u of users) {
      try {
        const { data, error } = await supabase.from('users').upsert({
          id: u.id,
          nome: u.nome,
          email: u.email,
          senha_hash: u.senha_hash,
          role: u.role,
          turma: u.turma
        }, { onConflict: 'id' }).select('id').single();
        if (error) console.warn(`Erro ao migrar usuário ${u.email}:`, error.message);
        else {
          validUserIds.add(u.id);
          console.log(`[OK] Usuário migrado: ID ${u.id} - ${u.email}`);
        }
      } catch (e) {
        console.warn(`Exceção ao migrar usuário ${u.email}:`, e.message);
      }
    }
  }

  // Consulta todos os IDs de usuários no Supabase para integridade referencial
  try {
    const { data: supaUsers } = await supabase.from('users').select('id');
    if (supaUsers) {
      supaUsers.forEach(u => validUserIds.add(u.id));
    }
  } catch (e) {}

  // 2. Migrar Redações do SQLite e Backup JSON
  console.log('\n--- 2. Migrando Redações ---');
  let redacoesToMigrate = [];

  if (db) {
    const sqliteRedacoes = db.prepare('SELECT * FROM redacoes').all();
    console.log(`Encontradas ${sqliteRedacoes.length} redações no SQLite local.`);
    redacoesToMigrate.push(...sqliteRedacoes.map(r => ({
      ...r,
      extracted_data: typeof r.extracted_data === 'string' ? JSON.parse(r.extracted_data || '{}') : (r.extracted_data || {})
    })));
  }

  // Tenta carregar backup.json se existir
  try {
    const backupPath = path.resolve(process.cwd(), '../backup.json');
    if (fs.existsSync(backupPath)) {
      const backupRaw = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
      const backupData = backupRaw.redacoes || (Array.isArray(backupRaw) ? backupRaw : []);
      if (Array.isArray(backupData)) {
        console.log(`Encontradas ${backupData.length} redações no backup.json.`);
        const existingIds = new Set(redacoesToMigrate.map(r => r.id));
        for (const item of backupData) {
          if (!existingIds.has(item.id)) {
            redacoesToMigrate.push(item);
            existingIds.add(item.id);
          }
        }
      }
    }
  } catch (e) {
    console.warn('Não foi possível ler backup.json:', e.message);
  }

  console.log(`Total de redações únicas para migrar: ${redacoesToMigrate.length}`);

  let successCount = 0;
  for (const r of redacoesToMigrate) {
    try {
      const validUserId = (r.user_id && validUserIds.has(Number(r.user_id))) ? Number(r.user_id) : null;
      const validValidadorId = (r.validado_por && validUserIds.has(Number(r.validado_por))) ? Number(r.validado_por) : null;

      const payload = {
        id: r.id,
        user_id: validUserId,
        nome_aluno: r.nome_aluno || null,
        turma_aluno: r.turma_aluno || null,
        nome_detectado: r.nome_detectado ? 1 : 0,
        data_captura: r.data_captura || new Date().toISOString(),
        tipo_input: r.tipo_input || 'imagem',
        imagem_base64: r.imagem_base64 || null,
        texto_digitado: r.texto_digitado || null,
        is_synced: 1,
        extracted_data: typeof r.extracted_data === 'string' ? JSON.parse(r.extracted_data || '{}') : (r.extracted_data || {}),
        nota_final: r.nota_final || 0,
        status_validacao: r.status_validacao || 'VALIDADA',
        validado_por: validValidadorId,
        data_validacao: r.data_validacao || null
      };

      const { error } = await supabase.from('redacoes').upsert(payload, { onConflict: 'id' });
      if (error) {
        console.warn(`Erro ao migrar redação #${r.id}:`, error.message);
      } else {
        successCount++;
        if (successCount % 10 === 0 || successCount === redacoesToMigrate.length) {
          console.log(`[Progresso] ${successCount}/${redacoesToMigrate.length} redações migradas com sucesso.`);
        }
      }
    } catch (e) {
      console.warn(`Exceção ao migrar redação #${r.id}:`, e.message);
    }
  }

  console.log(`\n=== MIGRAÇÃO CONCLUÍDA: ${successCount} de ${redacoesToMigrate.length} redações salvas no Supabase! ===`);
}

if (process.argv[1]?.endsWith('migrateToSupabase.js')) {
  migrateAllData().then(() => process.exit(0));
}
