import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let Database = null;
try {
  Database = (await import('better-sqlite3')).default;
} catch (err) {
  console.warn('[SQLite DB] better-sqlite3 não pôde ser carregado nativamente (ambiente Serverless/Vercel):', err.message);
}

let db = null;

if (Database) {
  let dbPath;
  try {
    if (process.env.VERCEL) {
      dbPath = '/tmp/agora.db';
    } else {
      const dataDir = path.join(__dirname, '../../data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      dbPath = path.join(dataDir, 'agora.db');
    }
  } catch (err) {
    console.warn('[SQLite DB] Fallback para /tmp/agora.db:', err.message);
    dbPath = '/tmp/agora.db';
  }

  try {
    db = new Database(dbPath);
  } catch (err) {
    console.error('[SQLite DB] Erro ao abrir banco SQLite em:', dbPath, err.message);
    try {
      db = new Database('/tmp/agora.db');
    } catch (fallbackErr) {
      console.error('[SQLite DB] Usando banco de dados em memória (:memory:):', fallbackErr.message);
      try {
        db = new Database(':memory:');
      } catch (memErr) {
        console.error('[SQLite DB] Não foi possível inicializar SQLite em memória:', memErr.message);
      }
    }
  }
}

if (db) {
  // Enable WAL mode when not on Vercel
  try {
    if (!process.env.VERCEL) {
      db.pragma('journal_mode = WAL');
    }
  } catch (e) {
    console.log('[SQLite DB] PRAGMA journal_mode ignorado.');
  }

  // Initialize Database Schemas
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        senha_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'ESTUDANTE',
        turma TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS redacoes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        nome_aluno TEXT,
        turma_aluno TEXT,
        nome_detectado INTEGER DEFAULT 0,
        data_captura DATETIME DEFAULT CURRENT_TIMESTAMP,
        tipo_input TEXT DEFAULT 'imagem',
        imagem_base64 TEXT,
        texto_digitado TEXT,
        is_synced INTEGER DEFAULT 0,
        extracted_data TEXT,
        nota_final INTEGER,
        status_validacao TEXT NOT NULL DEFAULT 'VALIDADA',
        validado_por INTEGER,
        data_validacao DATETIME,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY(validado_por) REFERENCES users(id) ON DELETE SET NULL
      );
    `);
  } catch (schemaErr) {
    console.warn('[SQLite DB Schema Error]:', schemaErr.message);
  }

  // Migration helper to add status_validacao to existing DB tables if missing
  try {
    const pragma = db.pragma('table_info(redacoes)');
    const hasStatusCol = pragma.some(col => col.name === 'status_validacao');
    if (!hasStatusCol) {
      db.exec("ALTER TABLE redacoes ADD COLUMN status_validacao TEXT NOT NULL DEFAULT 'VALIDADA'");
      db.exec("ALTER TABLE redacoes ADD COLUMN validado_por INTEGER");
      db.exec("ALTER TABLE redacoes ADD COLUMN data_validacao DATETIME");
      console.log('[SQLite DB] Coluna status_validacao adicionada à tabela redacoes.');
    }
  } catch (e) {
    console.log('[SQLite DB] Migração de colunas concluída ou não necessária.');
  }

  // Seed / Sync Initial Admin user (Apenas se configurado via variáveis de ambiente)
  const ADMIN_INIT_EMAIL = process.env.ADMIN_INIT_EMAIL;
  const ADMIN_INIT_PASSWORD = process.env.ADMIN_INIT_PASSWORD;

  if (ADMIN_INIT_EMAIL && ADMIN_INIT_PASSWORD) {
    try {
      const adminPasswordHash = bcrypt.hashSync(ADMIN_INIT_PASSWORD, 10);
      const existingAdmin = db.prepare("SELECT id FROM users WHERE LOWER(email) = LOWER(?)").get(ADMIN_INIT_EMAIL);
      if (!existingAdmin) {
        db.prepare(`
          INSERT INTO users (nome, email, senha_hash, role, turma)
          VALUES (?, ?, ?, ?, ?)
        `).run('Administrador', ADMIN_INIT_EMAIL, adminPasswordHash, 'ADMIN', 'Coordenação Pedagógica');
        console.log(`[SQLite DB] Usuário admin inicial provisionado a partir do ambiente: ${ADMIN_INIT_EMAIL}`);
      }
    } catch (err) {
      console.error('[SQLite DB] Erro ao provisionar usuário admin inicial:', err.message);
    }
  }
} else {
  // Safe Fallback Mock DB object so calling db.prepare / db.exec doesn't throw null reference error
  db = {
    prepare: () => ({
      get: () => null,
      all: () => [],
      run: () => ({ lastInsertRowid: 0, changes: 0 })
    }),
    exec: () => {},
    pragma: () => [],
    transaction: (fn) => fn
  };
}

export default db;

