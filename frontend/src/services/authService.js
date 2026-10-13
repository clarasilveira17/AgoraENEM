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

  async alterarSenha(senhaAtual, novaSenha) {
    const token = this.getToken();
    if (!token) throw new Error('Autenticação necessária.');

    const response = await fetch(`${API_BASE}/auth/alterar-senha`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ senhaAtual, novaSenha })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Falha ao alterar senha.');
    }
    return data;
  },

  async atualizarPerfil(nome, avatar_url) {
    const token = this.getToken();
    if (!token) throw new Error('Autenticação necessária.');

    const response = await fetch(`${API_BASE}/auth/perfil`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ nome, avatar_url })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Falha ao atualizar perfil.');
    }
    return data.user;
  },

  async esqueciSenha(email) {
    const response = await fetch(`${API_BASE}/auth/esqueci-senha`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Falha ao solicitar redefinição.');
    }
    return data;
  },

  async redefinirSenha(token, novaSenha) {
    const response = await fetch(`${API_BASE}/auth/redefinir-senha`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, novaSenha })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Falha ao redefinir senha.');
    }
    return data;
  },

  async desativarConta() {
    const token = this.getToken();
    if (!token) throw new Error('Autenticação necessária.');

    const response = await fetch(`${API_BASE}/auth/desativar-conta`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Falha ao desativar conta.');
    }
    this.logout();
    return data;
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
    if (!token) throw new Error('É necessário estar autenticado.');

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

  // Gestão de Usuários (Admin)
  async fetchUsuariosAdmin({ role = '', is_ativo = '', search = '', page = 1, limit = 20 } = {}) {
    const token = this.getToken();
    if (!token) throw new Error('Acesso restrito ao Administrador.');

    const params = new URLSearchParams();
    if (role) params.set('role', role);
    if (is_ativo !== '') params.set('is_ativo', is_ativo);
    if (search) params.set('search', search);
    params.set('page', page);
    params.set('limit', limit);

    const response = await fetch(`${API_BASE}/auth/usuarios?${params.toString()}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Falha ao listar usuários.');
    }
    return await response.json();
  },

  async atualizarUsuarioAdmin(userId, updates) {
    const token = this.getToken();
    if (!token) throw new Error('Acesso restrito ao Administrador.');

    const response = await fetch(`${API_BASE}/auth/usuarios/${userId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(updates)
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Falha ao atualizar usuário.');
    return data;
  },

  async resetarSenhaUsuarioAdmin(userId, novaSenha) {
    const token = this.getToken();
    if (!token) throw new Error('Acesso restrito ao Administrador.');

    const response = await fetch(`${API_BASE}/auth/usuarios/${userId}/resetar-senha`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ novaSenha })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Falha ao resetar senha.');
    return data;
  },

  // Alocação de Redações
  async solicitarLote(limite = 10) {
    const token = this.getToken();
    if (!token) throw new Error('Apenas professores autenticados podem solicitar lotes.');

    const response = await fetch(`${API_BASE}/redacoes/solicitar-lote?limite=${limite}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Falha ao solicitar lote de redações.');
    return data;
  },

  async devolverRedacao(id) {
    const token = this.getToken();
    if (!token) throw new Error('Autenticação necessária.');

    const response = await fetch(`${API_BASE}/redacoes/${id}/devolver`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Falha ao devolver redação.');
    return data;
  },

  async fetchMetricasAlocacao() {
    const token = this.getToken();
    if (!token) return null;

    const response = await fetch(`${API_BASE}/redacoes/metricas-alocacao`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.metricas;
  },

  async fetchCloudRedacoes(options = {}) {
    const token = this.getToken();
    const headers = {
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };

    const params = new URLSearchParams();
    if (options.page) params.set('page', options.page);
    params.set('limit', options.limit || 1000);
    if (options.all !== false) params.set('all', 'true');
    if (options.turma && options.turma !== 'todas') params.set('turma', options.turma);
    if (options.status && options.status !== 'todas') params.set('status', options.status);
    if (options.search) params.set('search', options.search);
    if (options.minhas_alocadas) params.set('minhas_alocadas', 'true');
    params.set('_t', Date.now());

    try {
      const response = await fetch(`${API_BASE}/redacoes?${params.toString()}`, { headers });
      if (!response.ok) return [];
      const data = await response.json();
      const list = Array.isArray(data) ? data : (data.redacoes || []);
      if (data.pagination) list.pagination = data.pagination;
      return list;
    } catch (err) {
      console.warn('Erro ao buscar redações na nuvem:', err);
      return [];
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
      if (response.status === 409) {
        throw new Error(data.error || 'Conflito de concorrência: esta redação foi alterada por outro usuário.');
      }
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
    if (!token) throw new Error('Apenas administradores podem apagar redações.');

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
