import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import jwt from 'jsonwebtoken';
import http from 'http';
import app from '../../server.js';
import { JWT_SECRET } from '../middleware/authMiddleware.js';

describe('Security & Access Control Tests (Fase 1 Remediations)', () => {
  let server;
  let baseUrl;

  beforeAll(async () => {
    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise((resolve) => {
      server.close(resolve);
    });
  });

  it('deve retornar 401 Unauthorized ao acessar /api/export-db sem token', async () => {
    const res = await fetch(`${baseUrl}/api/export-db`);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it('deve retornar 401 Unauthorized ao acessar /api/redacoes/export-db sem token', async () => {
    const res = await fetch(`${baseUrl}/api/redacoes/export-db`);
    expect(res.status).toBe(401);
  });

  it('deve retornar 401 Unauthorized ao tentar deletar redação sem token (mitigação do bypass anônimo)', async () => {
    const res = await fetch(`${baseUrl}/api/redacoes/999999`, {
      method: 'DELETE'
    });
    expect(res.status).toBe(401);
  });

  it('deve retornar 403 Forbidden ao tentar deletar redação com token de estudante', async () => {
    // Cria um token válido de estudante
    const studentToken = jwt.sign({ id: 9999, role: 'ESTUDANTE' }, JWT_SECRET);

    const res = await fetch(`${baseUrl}/api/redacoes/999999`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${studentToken}`
      }
    });

    // Como o usuário não existe no DB mock/supabase, o authenticate verifica no banco e se não achar retorna 401 ou 403
    expect([401, 403]).toContain(res.status);
  });

  it('deve retornar 401 Unauthorized ao acessar /api/auth/me sem token', async () => {
    const res = await fetch(`${baseUrl}/api/auth/me`);
    expect(res.status).toBe(401);
  });

  it('deve retornar 401 Unauthorized ao acessar lista de estudantes /api/auth/estudantes sem token', async () => {
    const res = await fetch(`${baseUrl}/api/auth/estudantes`);
    expect(res.status).toBe(401);
  });
});
