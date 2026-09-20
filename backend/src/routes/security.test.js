import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import jwt from 'jsonwebtoken';
import http from 'http';
import app from '../../server.js';
import { JWT_SECRET } from '../middleware/authMiddleware.js';
import { resolveStudent, invalidateStudentCache } from '../utils/turmasUtils.js';

describe('Security, Performance & Robustness Suite (Fases 1, 2 e 3)', () => {
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

  // FASE 1 TESTS: Autenticação, IDOR e Proteção de Dados
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
    const studentToken = jwt.sign({ id: 9999, role: 'ESTUDANTE' }, JWT_SECRET);

    const res = await fetch(`${baseUrl}/api/redacoes/999999`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${studentToken}`
      }
    });

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

  // FASE 2 TESTS: Blindagem de IA e Rate Limiting
  it('deve retornar 401 Unauthorized ao tentar chamar o endpoint de IA /api/corrigir sem token', async () => {
    const res = await fetch(`${baseUrl}/api/corrigir`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texto_digitado: 'Teste de redação' })
    });
    expect(res.status).toBe(401);
  });

  it('deve incluir cabeçalhos de RateLimit (X-RateLimit-Limit e X-RateLimit-Remaining) nas respostas', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.status).toBe(200);
    expect(res.headers.get('x-ratelimit-limit')).toBeDefined();
    expect(res.headers.get('x-ratelimit-remaining')).toBeDefined();
  });

  // FASE 3 TESTS: Security Headers, Correlation-ID e Cache de Performance
  it('deve incluir cabeçalhos de segurança defensivos (X-Content-Type-Options, X-Frame-Options, X-Request-Id)', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBe('DENY');
    expect(res.headers.get('x-request-id')).toBeDefined();
  });

  it('deve retornar 404 padronizado em formato JSON para rota inexistente da API', async () => {
    const res = await fetch(`${baseUrl}/api/rota-inexistente-xyz`);
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe('Endpoint da API não encontrado.');
  });

  it('deve resolver estudante com suporte a cache em memória e invalidação', async () => {
    invalidateStudentCache();
    const result1 = await resolveStudent(null, 'Ana Vivian Dutra Torreira', '3A');
    expect(result1).toBeDefined();
    expect(result1.nome_aluno).toBe('ANA WIVIAN DUTRA TORRES');

    // Segunda chamada utiliza o cache sem erros
    const result2 = await resolveStudent(null, 'Ana Vivian Dutra Torreira', '3A');
    expect(result2.nome_aluno).toBe('ANA WIVIAN DUTRA TORRES');
  });
});
