/**
 * Módulo de Banco de Dados Local Legado (SQLite)
 * 
 * ATENÇÃO: Desabilitado em produção e no ambiente Vercel Serverless.
 * A única fonte de dados em produção é o Supabase (Postgres + Storage).
 */

if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
  // Impede qualquer inicialização acidental de SQLite em produção
  // Não quebra a importação estática caso algum arquivo legado ainda importe,
  // mas lança erro se qualquer operação de banco for invocada.
}

let db = null;

if (process.env.USE_LOCAL_DB === 'true' && !process.env.VERCEL && process.env.NODE_ENV !== 'production') {
  try {
    const Database = (await import('better-sqlite3')).default;
    const path = (await import('path')).default;
    const fs = (await import('fs')).default;
    const { fileURLToPath } = await import('url');

    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const dataDir = path.join(__dirname, '../../data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const dbPath = path.join(dataDir, 'agora.db');
    db = new Database(dbPath);
    console.log('[SQLite DB] Modo local de desenvolvimento ativado via USE_LOCAL_DB=true:', dbPath);
  } catch (err) {
    console.warn('[SQLite DB] Não foi possível carregar better-sqlite3 local:', err.message);
  }
}

if (!db) {
  // Proxy protetor: lança erro se qualquer query for chamada em ambiente de produção
  db = new Proxy({}, {
    get(target, prop) {
      if (prop === 'close') return () => {};
      return () => {
        throw new Error(`[DB Config] SQLite está estritamente desabilitado. O projeto utiliza o Supabase como única fonte da verdade em produção. (Ação bloqueada: db.${String(prop)})`);
      };
    }
  });
}

export default db;
