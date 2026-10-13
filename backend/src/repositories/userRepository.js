import { supabase, isSupabaseConfigured } from '../config/supabaseClient.js';

export const userRepository = {
  /**
   * Busca usuário por e-mail para exibição segura (SEM expor senha_hash)
   */
  async findByEmail(email) {
    if (!email || !isSupabaseConfigured) return null;
    const cleanEmail = String(email).trim().toLowerCase();

    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, nome, email, role, turma, avatar_url, is_ativo, created_at')
        .ilike('email', cleanEmail)
        .maybeSingle();

      if (error) {
        console.warn(`[userRepository.findByEmail Supabase Error]: ${error.message}`);
        return null;
      }
      return data;
    } catch (sbErr) {
      console.warn(`[userRepository.findByEmail Exception]: ${sbErr.message}`);
      return null;
    }
  },

  /**
   * Busca usuário por e-mail COM senha_hash EXCLUSIVAMENTE para conferência de login
   */
  async findByEmailWithPassword(email) {
    if (!email || !isSupabaseConfigured) return null;
    const cleanEmail = String(email).trim().toLowerCase();

    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, nome, email, senha_hash, role, turma, avatar_url, is_ativo')
        .ilike('email', cleanEmail)
        .maybeSingle();

      if (error) {
        console.warn(`[userRepository.findByEmailWithPassword Error]: ${error.message}`);
        return null;
      }
      return data;
    } catch (err) {
      console.warn(`[userRepository.findByEmailWithPassword Exception]: ${err.message}`);
      return null;
    }
  },

  /**
   * Busca usuário por ID (SEM expor senha_hash)
   */
  async findById(id) {
    if (!id || !isSupabaseConfigured) return null;

    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, nome, email, role, turma, avatar_url, is_ativo, created_at')
        .eq('id', id)
        .maybeSingle();

      if (!error && data) return data;
      return null;
    } catch (err) {
      console.warn(`[userRepository.findById Exception]: ${err.message}`);
      return null;
    }
  },

  /**
   * Busca usuário por ID com hash da senha exclusivamente para checagem em alteração de senha
   */
  async findByIdWithPassword(id) {
    if (!id || !isSupabaseConfigured) return null;

    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, nome, email, senha_hash, role, turma, is_ativo')
        .eq('id', id)
        .maybeSingle();

      if (!error && data) return data;
      return null;
    } catch (err) {
      return null;
    }
  },

  /**
   * Lista todos os estudantes ativos cadastrados
   */
  async findStudents() {
    if (!isSupabaseConfigured) return [];

    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, nome, email, turma, created_at, is_ativo')
        .eq('role', 'ESTUDANTE')
        .eq('is_ativo', true)
        .order('nome', { ascending: true });

      if (!error && data) return data;
      return [];
    } catch (err) {
      return [];
    }
  },

  /**
   * Cria novo usuário no banco Supabase utilizando a sequence nativa do Postgres (BIGSERIAL)
   */
  async createUser({ nome, email, senhaHash, role = 'ESTUDANTE', turma = '', avatarUrl = null }) {
    if (!isSupabaseConfigured) throw new Error('Supabase não configurado para criação de usuário.');

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanNome = String(nome).trim();
    const cleanTurma = String(turma).trim();

    const payload = {
      nome: cleanNome,
      email: cleanEmail,
      senha_hash: senhaHash,
      role,
      turma: cleanTurma,
      avatar_url: avatarUrl,
      is_ativo: true
    };

    const { data, error } = await supabase
      .from('users')
      .insert(payload)
      .select('id, nome, email, role, turma, avatar_url, is_ativo, created_at')
      .single();

    if (error) {
      console.error('[userRepository.createUser Supabase Error]:', error.message);
      throw new Error(error.message || 'Erro ao persistir novo usuário no Supabase.');
    }

    return data;
  },

  /**
   * Atualização ou criação de estudante pela coordenação
   */
  async upsertStudent({ nome, email, turma, senhaHash }) {
    if (!isSupabaseConfigured) throw new Error('Supabase não configurado.');

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanNome = String(nome).trim();
    const cleanTurma = String(turma || 'Geral').trim();

    const existing = await this.findByEmail(cleanEmail);
    if (existing) {
      const { data, error } = await supabase
        .from('users')
        .update({
          nome: cleanNome,
          turma: cleanTurma,
          senha_hash: senhaHash,
          is_ativo: true
        })
        .eq('id', existing.id)
        .select('id, nome, email, turma, role, avatar_url, is_ativo')
        .single();

      if (error) throw new Error(error.message);
      return data;
    }

    return await this.createUser({
      nome: cleanNome,
      email: cleanEmail,
      senhaHash,
      role: 'ESTUDANTE',
      turma: cleanTurma
    });
  },

  /**
   * Atualiza a senha de um usuário
   */
  async updatePassword(userId, novaSenhaHash) {
    if (!isSupabaseConfigured) throw new Error('Supabase não configurado.');

    const { error } = await supabase
      .from('users')
      .update({
        senha_hash: novaSenhaHash,
        reset_token_hash: null,
        reset_token_expires: null
      })
      .eq('id', userId);

    if (error) throw new Error(error.message);
    return true;
  },

  /**
   * Atualiza informações do próprio perfil (Nome e Avatar)
   */
  async updateProfile(userId, { nome, avatar_url }) {
    if (!isSupabaseConfigured) throw new Error('Supabase não configurado.');

    const updates = {};
    if (nome) updates.nome = String(nome).trim();
    if (avatar_url !== undefined) updates.avatar_url = avatar_url;

    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select('id, nome, email, role, turma, avatar_url, is_ativo, created_at')
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  /**
   * Salva token de redefinição de senha com validade
   */
  async setResetToken(userId, tokenHash, expiresAt) {
    if (!isSupabaseConfigured) throw new Error('Supabase não configurado.');

    const { error } = await supabase
      .from('users')
      .update({
        reset_token_hash: tokenHash,
        reset_token_expires: expiresAt
      })
      .eq('id', userId);

    if (error) throw new Error(error.message);
    return true;
  },

  /**
   * Busca usuário por token de reset válido
   */
  async findByResetToken(tokenHash) {
    if (!isSupabaseConfigured || !tokenHash) return null;

    const { data, error } = await supabase
      .from('users')
      .select('id, nome, email, reset_token_expires')
      .eq('reset_token_hash', tokenHash)
      .gt('reset_token_expires', new Date().toISOString())
      .maybeSingle();

    if (error || !data) return null;
    return data;
  },

  /**
   * Desativação suave de conta (soft-delete)
   */
  async deactivateUser(userId) {
    if (!isSupabaseConfigured) throw new Error('Supabase não configurado.');

    const { error } = await supabase
      .from('users')
      .update({ is_ativo: false })
      .eq('id', userId);

    if (error) throw new Error(error.message);
    return true;
  },

  /**
   * Atualização administrativa de usuário (papel, ativação, turma)
   */
  async updateUserAdmin(userId, updates) {
    if (!isSupabaseConfigured) throw new Error('Supabase não configurado.');

    const allowed = {};
    if (updates.role) allowed.role = updates.role;
    if (updates.turma !== undefined) allowed.turma = updates.turma;
    if (updates.is_ativo !== undefined) allowed.is_ativo = Boolean(updates.is_ativo);
    if (updates.nome) allowed.nome = updates.nome.trim();

    const { data, error } = await supabase
      .from('users')
      .update(allowed)
      .eq('id', userId)
      .select('id, nome, email, role, turma, avatar_url, is_ativo, created_at')
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  /**
   * Listagem administrativa de usuários paginada
   */
  async listUsersAdmin({ role = null, is_ativo = null, search = null, page = 1, limit = 20 }) {
    if (!isSupabaseConfigured) return { users: [], total: 0 };

    const offset = (page - 1) * limit;
    let query = supabase
      .from('users')
      .select('id, nome, email, role, turma, avatar_url, is_ativo, created_at', { count: 'exact' });

    if (role) query = query.eq('role', role);
    if (is_ativo !== null && is_ativo !== undefined) query = query.eq('is_ativo', Boolean(is_ativo));
    if (search) {
      query = query.or(`nome.ilike.%${search}%,email.ilike.%${search}%,turma.ilike.%${search}%`);
    }

    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

    const { data, count, error } = await query;
    if (error) {
      console.error('[userRepository.listUsersAdmin Error]:', error.message);
      return { users: [], total: 0 };
    }

    return {
      users: data || [],
      total: count || 0
    };
  },

  /**
   * Exportação segura para backup do Administrador (NUNCA exporta senha_hash)
   */
  async exportAll() {
    if (!isSupabaseConfigured) return [];

    const { data } = await supabase
      .from('users')
      .select('id, nome, email, role, turma, avatar_url, is_ativo, created_at')
      .order('id', { ascending: true });

    return data || [];
  }
};

export default userRepository;
