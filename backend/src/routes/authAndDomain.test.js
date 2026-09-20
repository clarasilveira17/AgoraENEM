import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import app from '../../server.js';

describe('Auth & Domain Integration Tests (Fase 4 Backlog)', () => {
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

  it('deve retornar 400 Bad Request no login com campos ausentes', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: '' })
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('E-mail e senha são obrigatórios.');
  });

  it('deve retornar 401 Unauthorized no login com credenciais incorretas', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'usuario.inexistente@escola.ce.gov.br',
        senha: 'SenhaIncorreta@123'
      })
    });
    expect(res.status).toBe(401);
  });

  it('deve retornar 400 Bad Request no registro com dados incompletos', async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: 'Teste' })
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Nome, e-mail e senha são obrigatórios.');
  });

  it('deve retornar 403 Forbidden ao tentar cadastrar como ADMIN usando e-mail pessoal sem chave da escola válida', async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome: 'Tentativa Invasor',
        email: 'invasor@gmail.com',
        senha: 'SenhaForte@2026',
        role: 'ADMIN',
        codigoEscola: 'CHAVE_INVALIDA'
      })
    });
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain('Cadastro de Professor com e-mail pessoal não autorizado');
  });

  it('deve retornar 200 OK com array de ranking na rota pública /api/redacoes/ranking', async () => {
    const res = await fetch(`${baseUrl}/api/redacoes/ranking`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.ranking)).toBe(true);
  });
});
