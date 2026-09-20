import { describe, it, expect } from 'vitest';
import { cleanAndParseJSON, getMockENEMEvaluation } from './aiService.js';

describe('AI Service - JSON Cleaning & Parsing', () => {
  it('should clean markdown ```json wrappers correctly', () => {
    const raw = '```json\n{"aluno": "Test Student", "nota": 800}\n```';
    const parsed = cleanAndParseJSON(raw);
    expect(parsed.aluno).toBe('Test Student');
    expect(parsed.nota).toBe(800);
  });

  it('should extract JSON embedded inside extra commentary text', () => {
    const raw = 'Aqui está o resultado da avaliação:\n{"aluno": "João", "turma": "3A"}\nEspero ter ajudado!';
    const parsed = cleanAndParseJSON(raw);
    expect(parsed.aluno).toBe('João');
    expect(parsed.turma).toBe('3A');
  });

  it('should sanitize unescaped control characters like tabs and invalid escapes inside strings', () => {
    const raw = '{\n  "texto": "Linha 1 \\x00 Linha 2",\n  "aluno": "Maria"\n}';
    const parsed = cleanAndParseJSON(raw);
    expect(parsed.aluno).toBe('Maria');
  });

  it('should auto-repair unescaped inner double quotes in string property values', () => {
    const raw = '{\n  "aluno": "Ana Livia",\n  "citacao_texto": "A obra "Quarto de Despejo" relata a fome",\n  "nota": 800\n}';
    const parsed = cleanAndParseJSON(raw);
    expect(parsed.aluno).toBe('Ana Livia');
    expect(parsed.nota).toBe(800);
    expect(parsed.citacao_texto).toContain('Quarto de Despejo');
  });

  it('should generate valid mock ENEM evaluations when API key is missing', () => {
    const mock = getMockENEMEvaluation(1, 'Texto de teste', 'Pedro Alvares', '3º B');
    expect(mock.aluno).toBe('Pedro Alvares');
    expect(mock.turma).toBe('3º B');
    expect(mock.avaliacoes.enem.nota_total_enem).toBeGreaterThan(0);
    expect(mock.avaliacoes.enem.competencia_1.citacao_texto).toBeDefined();
  });
});
