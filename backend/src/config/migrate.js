import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';
import dotenv from 'dotenv';

const { Client } = pkg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Carrega variáveis de ambiente
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'backend/.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

/**
 * Extrai o Project Ref a partir da URL do Supabase
 * Ex: https://erfnplylylasjgbpdcyc.supabase.co -> erfnplylylasjgbpdcyc
 */
function getProjectRef(url) {
  if (!url) return null;
  const match = url.match(/https?:\/\/([a-z0-9-]+)\.supabase\.co/i);
  return match ? match[1] : null;
}

/**
 * Lê o arquivo SQL da migração
 */
function getMigrationSql() {
  const candidatePaths = [
    path.resolve(__dirname, '../migrations/0001_init.sql'),
    path.resolve(__dirname, '../../../supabase/migrations/0001_init.sql'),
    path.resolve(process.cwd(), 'supabase/migrations/0001_init.sql'),
    path.resolve(process.cwd(), 'backend/src/migrations/0001_init.sql')
  ];

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      return fs.readFileSync(p, 'utf8');
    }
  }

  throw new Error('Arquivo de migração 0001_init.sql não encontrado.');
}

/**
 * Executa a migração no Postgres via pg.Client
 */
async function runWithPg(connectionString, sql) {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  try {
    console.log('[Migration] Conectado ao PostgreSQL. Executando 0001_init.sql...');
    await client.query(sql);
    console.log('[Migration] ✅ 0001_init.sql executada com sucesso!');
    return { success: true, message: 'Migração 0001_init.sql executada com sucesso no PostgreSQL!' };
  } finally {
    await client.end().catch(() => {});
  }
}

/**
 * Executa a migração via Supabase Management API caso access token esteja configurado
 */
async function runWithManagementApi(projectRef, token, sql) {
  console.log(`[Migration] Tentando executar via Supabase Management API para o projeto ${projectRef}...`);
  const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: sql })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Supabase Management API Error (${response.status}): ${errorText}`);
  }

  console.log('[Migration] ✅ 0001_init.sql executada com sucesso via Management API!');
  return { success: true, message: 'Migração executada com sucesso via Supabase Management API!' };
}

/**
 * Orquestrador principal de migração
 * Suporta execução automática na inicialização e chamada manual
 */
export async function runMigrations(customConnectionString = null) {
  try {
    const sql = getMigrationSql();
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const projectRef = getProjectRef(supabaseUrl);

    // 1. Conexão direta via string de conexão
    let connectionString = customConnectionString
      || process.env.DATABASE_URL
      || process.env.POSTGRES_URL
      || process.env.POSTGRES_PRISMA_URL
      || process.env.POSTGRES_URL_NON_POOLING
      || process.env.SUPABASE_DB_URL;

    // 2. Se não houver URL completa, mas houver senha do Postgres configurada
    const dbPassword = process.env.POSTGRES_PASSWORD
      || process.env.DATABASE_PASSWORD
      || process.env.SUPABASE_DB_PASSWORD
      || process.env.DB_PASSWORD;

    if (!connectionString && dbPassword && projectRef) {
      connectionString = `postgresql://postgres:${encodeURIComponent(dbPassword)}@db.${projectRef}.supabase.co:5432/postgres`;
    }

    if (connectionString) {
      return await runWithPg(connectionString, sql);
    }

    // 3. Fallback: Supabase Management API Token
    const mgmtToken = process.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_MGMT_TOKEN;
    if (mgmtToken && projectRef) {
      return await runWithManagementApi(projectRef, mgmtToken, sql);
    }

    // 4. Sem credenciais de DDL direto
    const infoMsg = '[Migration Info] Nenhuma URL direta do PostgreSQL detectada (DATABASE_URL/POSTGRES_URL). O sistema continuará operando normalmente através do Supabase Client.';
    console.log(infoMsg);
    return {
      success: false,
      skipped: true,
      message: infoMsg
    };
  } catch (err) {
    console.error('[Migration Falhou]:', err.message);
    return {
      success: false,
      error: err.message
    };
  }
}

// Se executado diretamente via terminal (`node migrate.js`)
if (process.argv[1] && process.argv[1].endsWith('migrate.js')) {
  const customArg = process.argv[2] || null;
  runMigrations(customArg).then((res) => {
    console.log('[Migration Resultado]:', res);
    process.exit(res.success || res.skipped ? 0 : 1);
  });
}
