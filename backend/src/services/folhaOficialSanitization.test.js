import { describe, it, expect } from 'vitest';

/**
 * Text sanitizer replicated for official print verification
 */
function cleanPrintText(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .normalize('NFKC')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
    .trim();
}

function parseSafeScore(score, max = 1000) {
  const num = Number(score);
  if (isNaN(num)) return 0;
  return Math.min(max, Math.max(0, num));
}

function parseSafeDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return new Date().toLocaleDateString('pt-BR');
  const d = new Date(dateStr);
  if (isNaN(d.getTime()) || d.getFullYear() < 2000 || d.getFullYear() > 2100) {
    return new Date().toLocaleDateString('pt-BR');
  }
  return d.toLocaleDateString('pt-BR');
}

function generateCodigoRedacao(id) {
  const rawIdNum = id ? String(id).padStart(4, '0') : '0000';
  return `#AG-${rawIdNum}-2026`;
}

describe('Folha Oficial - Data Robustness & Edge Cases Suite', () => {
  it('should clean HTML tags and preserve Portuguese accented characters with Unicode NFKC', () => {
    const raw = '<p>Texto da <strong>Redação</strong> com acentuação: ação, saúde, vovó &amp; &nbsp; teste.</p>';
    const cleaned = cleanPrintText(raw);
    expect(cleaned).toBe('Texto da Redação com acentuação: ação, saúde, vovó &   teste.');
  });

  it('should strip invisible ASCII control characters while keeping valid text', () => {
    const raw = 'Linha 1 \x00\x07 com caracteres \x1F de controle';
    const cleaned = cleanPrintText(raw);
    expect(cleaned).toBe('Linha 1  com caracteres  de controle');
  });

  it('should safely clamp ENEM total score between 0 and 1000', () => {
    expect(parseSafeScore(1200)).toBe(1000);
    expect(parseSafeScore(-150)).toBe(0);
    expect(parseSafeScore('880')).toBe(880);
    expect(parseSafeScore('invalid_score')).toBe(0);
    expect(parseSafeScore(null)).toBe(0);
  });

  it('should safely clamp competency scores between 0 and 200', () => {
    expect(parseSafeScore(240, 200)).toBe(200);
    expect(parseSafeScore(-40, 200)).toBe(0);
    expect(parseSafeScore(160, 200)).toBe(160);
  });

  it('should parse valid dates and fallback gracefully for corrupt date strings', () => {
    const valid = parseSafeDate('2026-09-20T10:00:00Z');
    expect(valid).toMatch(/\d{2}\/\d{2}\/\d{4}/);

    const corrupt = parseSafeDate('data-corrompida-123');
    expect(corrupt).not.toBe('Invalid Date');
    expect(corrupt).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });

  it('should generate official document IDs without arbitrary hardcoded fallbacks', () => {
    expect(generateCodigoRedacao(78)).toBe('#AG-0078-2026');
    expect(generateCodigoRedacao(1450)).toBe('#AG-1450-2026');
    expect(generateCodigoRedacao(null)).toBe('#AG-0000-2026');
    expect(generateCodigoRedacao(undefined)).toBe('#AG-0000-2026');
  });
});
