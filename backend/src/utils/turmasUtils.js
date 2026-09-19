/**
 * Turmas Oficiais da Escola (Conforme Lista Geral dos Alunos.xlsx)
 */
export const TURMAS_ESCOLA = [
  '1° A - INTEGRAL',
  '1° B - INTEGRAL',
  '1° C - INTEGRAL',
  '1° D - INTEGRAL',
  '1° E - INTEGRAL',
  '1° F - INTEGRAL',
  '2° A - MANHÃ',
  '2° B - MANHÃ',
  '2° C - MANHÃ',
  '2° D - TARDE',
  '2° E - TARDE',
  '2° F - TARDE',
  '3° A - MANHÃ',
  '3° B - MANHÃ',
  '3° C - MANHÃ',
  '3° D - MANHÃ',
  '3° E - TARDE',
  '3° F - TARDE',
  '3° G - TARDE'
];

/**
 * Normaliza qualquer texto livre, abreviação de OCR ou string legada para o padrão oficial da escola.
 */
export function normalizeTurma(raw) {
  if (!raw || typeof raw !== 'string') return '';
  const clean = raw.trim();
  if (TURMAS_ESCOLA.includes(clean)) return clean;

  const match = clean.match(/([1-3])\s*[°ºª"'\s]*\s*([A-Ga-g])/);
  if (match) {
    const year = match[1];
    const letter = match[2].toUpperCase();

    if (year === '1') {
      const canonical = `1° ${letter} - INTEGRAL`;
      if (TURMAS_ESCOLA.includes(canonical)) return canonical;
    } else if (year === '2') {
      if (['A', 'B', 'C'].includes(letter)) return `2° ${letter} - MANHÃ`;
      if (['D', 'E', 'F'].includes(letter)) return `2° ${letter} - TARDE`;
    } else if (year === '3') {
      if (['A', 'B', 'C', 'D'].includes(letter)) return `3° ${letter} - MANHÃ`;
      if (['E', 'F', 'G'].includes(letter)) return `3° ${letter} - TARDE`;
    }
  }

  return clean;
}

/**
 * Normaliza string removendo acentos, pontuações e espaçamentos extras para match robusto.
 */
export function normalizeStr(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Mapeamento manual para correções extremas de OCR se necessário
 */
export const MANUAL_OCR_NAME_MAP = {
  'Rita Marcela': 'RITA MARCELA DO NASCIMENTO SANTOS',
  'Fagner Ramos': 'FRANCISCO FAGNER DA SILVA RAMOS',
  'Mathaus Henrique B. Ferreira': 'MATHEUS HENRIQUE BARROS FERREIRA',
  'Ana Vivian Dutra Torreira': 'ANA WIVIAN DUTRA TORRES',
  'Yasmim Marques': 'YASMIM MARQUES DA ROCHA',
  'Derick Dheyson Brandão de Araújo': 'DERICK DHEYSON BRANDAO DE ARAUJO',
  'Mariana Emily': 'MARIANA EMILY SOUZA SILVA',
  'Rayssa Barrete Batalha do Nascimento': 'RAYSSA BARRETO BATALHA DO NASCIMENTO',
  'Fernando': 'FERNANDO MARQUES FERREIRA DE OLIVEIRA',
  'Diogo': 'FRANCISCO DIOGO SOUSA OLIVEIRA',
  'Cauã Rios Cavalcante': 'CAUA RIOS CAVALCANTE',
  'Eloci Sousa': 'ELOA DE SOUSA MATA',
  'Eyshylla Minter Silva': 'EYSHYLLA MINTER SILVA',
  'Emilly Vasconcelos': 'EMILLY VASCONCELOS BRANDAO',
  'Daphine Luise': 'DAFHINE LOUISE SILVA DE OLIVEIRA',
  'Lucinda Chaves Araújo': 'LUCINDA CHAVES ARAUJO',
  'Francisca Hedwiges': 'FRANCISCA HEDWIGES SILVA DE ARAUJO',
  'Evely Loviny Santos Pessoa': 'EVELY LAVINY SANTOS PESSOA'
};
