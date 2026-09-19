import { db } from '../db/db';

const API_BASE = '/api';

export const authService = {
  getToken() {
    return localStorage.getItem('agora_token');
  },

  setToken(token) {
    if (token) {
      localStorage.setItem('agora_token', token);
    } else {
      localStorage.removeItem('agora_token');
    }
  },

  async login(email, senha) {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Falha ao realizar login.');
    }

    this.setToken(data.token);
    return data;
  },

  async register(userData) {
    const response = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Falha ao realizar cadastro.');
    }

    this.setToken(data.token);
    return data;
  },

  async getMe() {
    const token = this.getToken();
    if (!token) return null;

    const response = await fetch(`${API_BASE}/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      this.setToken(null);
      return null;
    }

    const data = await response.json();
    return data.user;
  },

  logout() {
    this.setToken(null);
  },

  async getEstudantes() {
    const token = this.getToken();
    if (!token) return [];

    const response = await fetch(`${API_BASE}/auth/estudantes`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) return [];
    const data = await response.json();
    return data.estudantes || [];
  },

  async fetchEstudantes() {
    return this.getEstudantes();
  },

  async createEstudante(studentData) {
    const token = this.getToken();
    if (!token) throw new Error('É necessário estar autenticado como Admin.');

    const response = await fetch(`${API_BASE}/auth/estudantes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(studentData)
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Erro ao cadastrar estudante.');
    }
    return data.estudante;
  },

  async syncLegacyToCloud(onProgress) {
    const token = this.getToken();
    if (!token) throw new Error('É necessário estar autenticado como Admin para subir as correções.');

    // Fetch all local IndexedDB redações
    const localRedacoes = await db.redacoes.toArray();
    if (localRedacoes.length === 0) {
      return { insertedCount: 0, message: 'Nenhuma correção local no IndexedDB encontrada.' };
    }

    let totalInserted = 0;
    let totalSkipped = 0;
    const total = localRedacoes.length;

    // Sincroniza item a item para evitar estourar o limite de 4.5MB de payload por requisição da Vercel (FUNCTION_PAYLOAD_TOO_LARGE)
    for (let i = 0; i < total; i++) {
      const item = localRedacoes[i];
      if (onProgress) {
        onProgress(i + 1, total);
      }

      // Failsafe de payload: se a imagem base64 de um único item for absurdamente grande (>3.5MB), omite a imagem para não estourar o limite da Vercel
      let itemToSend = item;
      const jsonStr = JSON.stringify({ redacoes: [itemToSend] });
      if (jsonStr.length > 3.5 * 1024 * 1024) {
        itemToSend = { ...item, imagem_base64: null };
      }

      const response = await fetch(`${API_BASE}/redacoes/sync-legacy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ redacoes: [itemToSend] })
      });

      let data;
      try {
        const text = await response.text();
        data = JSON.parse(text);
      } catch (e) {
        throw new Error(`Erro na sincronização (redação ${i + 1} de ${total}): o backend retornou uma página inválida em vez de dados (provavelmente está offline ou o servidor caiu).`);
      }

      if (!response.ok) {
        throw new Error(data.error || `Erro ao sincronizar a redação ${i + 1} de ${total}.`);
      }

      totalInserted += (data.insertedCount || 0);
      totalSkipped += (data.skippedCount || 0);
    }

    return {
      insertedCount: totalInserted,
      skippedCount: totalSkipped,
      message: `${totalInserted} correções locais sincronizadas e disponibilizadas com sucesso! (${totalSkipped} já existiam)`
    };
  },

  async fetchCloudRedacoes() {
    const token = this.getToken();
    const headers = {
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };

    try {
      const response = await fetch(`${API_BASE}/redacoes?_t=${Date.now()}`, { headers });
      if (!response.ok) return null;
      const data = await response.json();
      return data.redacoes || [];
    } catch (err) {
      console.warn('Erro ao buscar redações na nuvem:', err);
      return null;
    }
  },

  async fetchRankingRedacoes() {
    const token = this.getToken();
    const headers = {
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };

    try {
      const response = await fetch(`${API_BASE}/redacoes/ranking?_t=${Date.now()}`, { headers });
      if (!response.ok) return [];
      const data = await response.json();
      return data.ranking || [];
    } catch (err) {
      console.warn('Erro ao buscar ranking na nuvem:', err);
      return [];
    }
  },

  async fetchRedacaoById(id) {
    const token = this.getToken();
    const headers = {
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };

    try {
      const response = await fetch(`${API_BASE}/redacoes/${id}`, { headers });
      if (!response.ok) return null;
      return await response.json();
    } catch (err) {
      console.warn(`Erro ao buscar redação #${id}:`, err);
      return null;
    }
  },

  async validarRedacao(id, payload = {}) {
    const token = this.getToken();
    if (!token) throw new Error('Apenas professores autenticados podem validar correções.');

    const response = await fetch(`${API_BASE}/redacoes/${id}/validar`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Erro ao validar redação.');
    }

    return data;
  },

  async vincularAluno(id, payload = {}) {
    const token = this.getToken();
    if (!token) throw new Error('Apenas professores autenticados podem vincular redações.');

    const response = await fetch(`${API_BASE}/redacoes/${id}/vincular`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Erro ao vincular aluno.');
    }

    return data;
  },

  async deleteCloudRedacao(id) {
    const token = this.getToken();
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

    const response = await fetch(`${API_BASE}/redacoes/${id}`, {
      method: 'DELETE',
      headers
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'Erro ao excluir redação no servidor.');
    }

    return true;
  },

  async clearAllRedacoes() {
    const token = this.getToken();
    if (!token) throw new Error('Apenas professores autenticados podem apagar redações.');

    const response = await fetch(`${API_BASE}/redacoes/clear-all`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Erro ao apagar redações.');
    }

    return data;
  }
};

