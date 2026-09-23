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

  it('should sanitize unescaped control characters like tabs, raw newlines and invalid escapes inside strings', () => {
    const rawWithRawNewline = `{\n  "texto_transcrito": "Linha 1 da redacao\nLinha 2 da redacao\tcom tabulacao",\n  "aluno": "Maria Silva"\n}`;
    const parsed = cleanAndParseJSON(rawWithRawNewline);
    expect(parsed.aluno).toBe('Maria Silva');
    expect(parsed.texto_transcrito).toContain('Linha 1 da redacao');
    expect(parsed.texto_transcrito).toContain('Linha 2 da redacao');
  });

  it('should auto-repair unescaped inner double quotes in string property values', () => {
    const raw = '{\n  "aluno": "Ana Livia",\n  "citacao_texto": "A obra "Quarto de Despejo" relata a fome",\n  "nota": 800\n}';
    const parsed = cleanAndParseJSON(raw);
    expect(parsed.aluno).toBe('Ana Livia');
    expect(parsed.nota).toBe(800);
    expect(parsed.citacao_texto).toContain('Quarto de Despejo');
  });

  it('should handle extra non-whitespace character after JSON (e.g. trailing commentary or second block)', () => {
    const raw = '{\n  "devolutiva_enem": "Visão Geral: Bom texto.",\n  "devolutiva_sisedu": "Diagnóstico: Adequado."\n}\nObservações adicionais do modelo: Foi atribuída nota 800 { "extra": true }';
    const parsed = cleanAndParseJSON(raw);
    expect(parsed.devolutiva_enem).toContain('Visão Geral');
    expect(parsed.devolutiva_sisedu).toContain('Diagnóstico');
  });

  it('should handle markdown block with trailing commentary after code fence', () => {
    const raw = '```json\n{\n  "c1": { "nota": 160 },\n  "c2": { "nota": 200 }\n}\n```\nAqui está a avaliação completa!';
    const parsed = cleanAndParseJSON(raw);
    expect(parsed.c1.nota).toBe(160);
    expect(parsed.c2.nota).toBe(200);
  });

  it('should generate valid mock ENEM evaluations when API key is missing', () => {
    const mock = getMockENEMEvaluation(1, 'Texto de teste', 'Pedro Alvares', '3º B');
    expect(mock.aluno).toBe('Pedro Alvares');
    expect(mock.turma).toBe('3º B');
    expect(mock.avaliacoes.enem.nota_total_enem).toBe(920);
    expect(mock.avaliacoes.enem.competencia_1.citacao_texto).toBeDefined();
    expect(mock.avaliacoes.enem.competencia_5.elementos_finais.agente).toBe(true);
  });
});

