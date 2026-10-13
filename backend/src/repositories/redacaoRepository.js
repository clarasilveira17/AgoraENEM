import { supabase, isSupabaseConfigured, uploadEssayImageToStorage } from '../config/supabaseClient.js';

export const redacaoRepository = {
  /**
   * Busca paginada de redações com filtros completos e RBAC estrito
   */
  async findPaginated({ user, offset = 0, limit = 25, filters = {} }) {
    if (!user || !isSupabaseConfigured) {
      return { redacoes: [], total: 0 };
    }

    const selectFields = 'id, user_id, nome_aluno, turma_aluno, nome_detectado, data_captura, tipo_input, imagem_url, imagens_urls, texto_digitado, is_synced, extracted_data, nota_final, status_validacao, validado_por, data_validacao, corretor_id, status_alocacao, alocado_em, versao_concorrencia';

    let query = supabase
      .from('redacoes')
      .select(selectFields, { count: 'exact' });

    // RBAC: Estudante só pode ver suas próprias redações validadas
    if (user.role !== 'ADMIN' && user.role !== 'PROFESSOR') {
      const cleanStudentName = (user.nome || '').trim();
      query = query
        .eq('status_validacao', 'VALIDADA')
        .or(`user_id.eq.${user.id},nome_aluno.ilike.%${cleanStudentName}%`);
    } else if (filters.minhas_alocadas && user.role === 'PROFESSOR') {
      // Filtro para o professor ver apenas as que foram alocadas a ele
      query = query.eq('corretor_id', user.id);
    }

    // Filtros adicionais opcionais
    if (filters.turma && filters.turma !== 'todas') {
      query = query.eq('turma_aluno', filters.turma);
    }

    if (filters.status && filters.status !== 'todas') {
      if (filters.status === 'conferidas') {
        query = query.eq('status_validacao', 'VALIDADA');
      } else if (filters.status === 'pendentes') {
        query = query.eq('status_validacao', 'PENDENTE_VALIDACAO');
      } else if (filters.status === 'erro') {
        query = query.eq('status_validacao', 'ERRO_PROCESSAMENTO');
      } else {
        query = query.eq('status_validacao', filters.status);
      }
    }

    if (filters.status_alocacao) {
      query = query.eq('status_alocacao', filters.status_alocacao);
    }

    if (filters.search && filters.search.trim()) {
      const s = filters.search.trim();
      if (!isNaN(Number(s))) {
        query = query.or(`id.eq.${Number(s)},nome_aluno.ilike.%${s}%,turma_aluno.ilike.%${s}%`);
      } else {
        query = query.or(`nome_aluno.ilike.%${s}%,turma_aluno.ilike.%${s}%`);
      }
    }

    query = query
      .order('data_captura', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      console.warn('[redacaoRepository.findPaginated Error]:', error.message);
      return { redacoes: [], total: 0 };
    }

    const formatted = (data || []).map(r => ({
      ...r,
      nome_detectado: Boolean(r.nome_detectado),
      is_synced: Boolean(r.is_synced),
      extracted_data: typeof r.extracted_data === 'string' ? JSON.parse(r.extracted_data || '{}') : (r.extracted_data || {}),
      status_validacao: r.status_validacao || 'VALIDADA',
      versao_concorrencia: r.versao_concorrencia || 1
    }));

    return {
      redacoes: formatted,
      total: count || 0
    };
  },

  /**
   * Mantido para compatibilidade, com limite de segurança para não explodir a memória
   */
  async findAll({ user, includeImage = false }) {
    const result = await this.findPaginated({
      user,
      offset: 0,
      limit: 100 // Limite defensivo para chamadas legadas
    });
    return result.redacoes;
  },

  /**
   * Busca redação por ID
   */
  async findById(id) {
    if (!id || !isSupabaseConfigured) return null;

    try {
      const { data, error } = await supabase
        .from('redacoes')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error || !data) return null;

      return {
        ...data,
        nome_detectado: Boolean(data.nome_detectado),
        is_synced: Boolean(data.is_synced),
        extracted_data: typeof data.extracted_data === 'string' ? JSON.parse(data.extracted_data || '{}') : (data.extracted_data || {}),
        status_validacao: data.status_validacao || 'VALIDADA',
        versao_concorrencia: data.versao_concorrencia || 1
      };
    } catch (err) {
      console.warn('[redacaoRepository.findById Exception]:', err.message);
      return null;
    }
  },

  /**
   * Busca e consolida o ranking oficial (Critérios ENEM C1, C4, C3, C2, C5)
   */
  async findRanking() {
    if (!isSupabaseConfigured) return [];

    try {
      const { data, error } = await supabase
        .from('redacoes')
        .select('id, user_id, nome_aluno, turma_aluno, nota_final, data_captura, status_validacao, extracted_data, is_synced')
        .eq('status_validacao', 'VALIDADA')
        .order('nota_final', { ascending: false })
        .limit(200);

      if (error || !data) return [];

      const formatted = data.map(r => ({
        ...r,
        extracted_data: typeof r.extracted_data === 'string' ? JSON.parse(r.extracted_data || '{}') : (r.extracted_data || {}),
        is_synced: true
      }));

      // Critérios oficiais de desempate ENEM
      formatted.sort((a, b) => {
        if ((b.nota_final || 0) !== (a.nota_final || 0)) {
          return (b.nota_final || 0) - (a.nota_final || 0);
        }
        const getComp = (item, key) => item.extracted_data?.avaliacoes?.enem?.[key]?.nota || 0;
        const bC1 = getComp(b, 'competencia_1');
        const aC1 = getComp(a, 'competencia_1');
        if (bC1 !== aC1) return bC1 - aC1;

        const bC4 = getComp(b, 'competencia_4');
        const aC4 = getComp(a, 'competencia_4');
        if (bC4 !== aC4) return bC4 - aC4;

        const bC3 = getComp(b, 'competencia_3');
        const aC3 = getComp(a, 'competencia_3');
        if (bC3 !== aC3) return bC3 - aC3;

        const bC2 = getComp(b, 'competencia_2');
        const aC2 = getComp(a, 'competencia_2');
        if (bC2 !== aC2) return bC2 - aC2;

        const bC5 = getComp(b, 'competencia_5');
        const aC5 = getComp(a, 'competencia_5');
        if (bC5 !== aC5) return bC5 - aC5;

        const aName = (a.nome_aluno || '').trim().toLowerCase();
        const bName = (b.nome_aluno || '').trim().toLowerCase();
        return aName.localeCompare(bName);
      });

      return formatted;
    } catch (err) {
      console.warn('[redacaoRepository.findRanking Exception]:', err.message);
      return [];
    }
  },

  /**
   * Persiste uma nova redação no Supabase utilizando BIGSERIAL nativo (sem geração manual de ID)
   * Se imagem em base64 for fornecida, sobe automaticamente para o Supabase Storage.
   */
  async create(data) {
    if (!isSupabaseConfigured) throw new Error('Supabase não configurado para gravação de redação.');

    let imagemUrl = data.imagem_url || null;

    // Se a imagem veio em base64, salva no Supabase Storage para poupar a tabela
    if (!imagemUrl && data.imagem_base64 && data.imagem_base64.length > 500) {
      try {
        imagemUrl = await uploadEssayImageToStorage(data.imagem_base64, data.nome_aluno);
      } catch (uploadErr) {
        console.warn('[redacaoRepository.create Storage Warning]:', uploadErr.message);
      }
    }

    const payload = {
      user_id: data.user_id || null,
      nome_aluno: data.nome_aluno || 'Não identificado',
      turma_aluno: data.turma_aluno || null,
      nome_detectado: data.nome_detectado ?? 1,
      data_captura: data.data_captura || new Date().toISOString(),
      tipo_input: data.tipo_input || 'imagem',
      imagem_url: imagemUrl,
      imagens_urls: Array.isArray(data.imagens_urls) && data.imagens_urls.length > 0 ? data.imagens_urls : (imagemUrl ? [imagemUrl] : []),
      imagem_base64: imagemUrl ? null : (data.imagem_base64 || null), // Oprime base64 no banco se já temos a URL do Storage
      texto_digitado: data.texto_digitado || null,
      is_synced: 1,
      extracted_data: data.extracted_data || {},
      nota_final: data.nota_final || 0,
      status_validacao: data.status_validacao || 'PENDENTE_VALIDACAO',
      validado_por: data.validado_por || null,
      data_validacao: data.data_validacao || null,
      corretor_id: data.corretor_id || null,
      status_alocacao: data.status_alocacao || 'DISPONIVEL',
      alocado_em: data.alocado_em || null,
      versao_concorrencia: 1
    };

    const { data: inserted, error } = await supabase
      .from('redacoes')
      .insert(payload)
      .select('id')
      .single();

    if (error) {
      console.error('[redacaoRepository.create Error]:', error.message);
      throw new Error(error.message || 'Erro ao persistir redação no Supabase.');
    }

    return inserted?.id;
  },

  /**
   * Atualização com Lock Otimista (versao_concorrencia) para impedir sobrescrita de correções
   */
  async updateWithLock(id, expectedVersion, updates) {
    if (!isSupabaseConfigured) throw new Error('Supabase não configurado.');

    const newVersion = (expectedVersion || 1) + 1;
    const updatePayload = {
      ...updates,
      versao_concorrencia: newVersion
    };

    let query = supabase
      .from('redacoes')
      .update(updatePayload)
      .eq('id', id);

    // Se uma versão esperada foi informada, aplica a verificação de concorrência
    if (expectedVersion !== undefined && expectedVersion !== null) {
      query = query.eq('versao_concorrencia', expectedVersion);
    }

    const { data, error } = await query.select('id, versao_concorrencia');

    if (error) {
      console.error('[redacaoRepository.updateWithLock Error]:', error.message);
      throw new Error(error.message);
    }

    // Se nenhuma linha foi atualizada, outro professor salvou antes!
    if (!data || data.length === 0) {
      return { success: false, conflict: true };
    }

    return { success: true, newVersion };
  },

  /**
   * Atualização simples
   */
  async update(id, updates) {
    if (!isSupabaseConfigured) return;

    const { error } = await supabase
      .from('redacoes')
      .update(updates)
      .eq('id', id);

    if (error) console.error('[redacaoRepository.update Error]:', error.message);
  },

  /**
   * Solicita um lote de redações disponíveis e aloca atomicamente para o professor
   */
  async solicitarLote(professorId, tamanhoLote = 10) {
    if (!isSupabaseConfigured) throw new Error('Supabase não configurado.');

    // 1. Limpa leases expirados (> 90 minutos)
    await this.limparLeasesExpirados(90);

    // 2. Busca redações que o professor já tem alocadas em aberto
    const { data: existentes } = await supabase
      .from('redacoes')
      .select('id, user_id, nome_aluno, turma_aluno, data_captura, tipo_input, nota_final, status_validacao, alocado_em, versao_concorrencia')
      .eq('corretor_id', professorId)
      .eq('status_alocacao', 'EM_CORRECAO')
      .order('data_captura', { ascending: true });

    const jaAlocadas = existentes || [];
    const vagas = tamanhoLote - jaAlocadas.length;

    if (vagas > 0) {
      // 3. Busca redações pendentes disponíveis
      const { data: disponiveis } = await supabase
        .from('redacoes')
        .select('id')
        .eq('status_alocacao', 'DISPONIVEL')
        .neq('status_validacao', 'VALIDADA')
        .order('data_captura', { ascending: true })
        .limit(vagas);

      if (disponiveis && disponiveis.length > 0) {
        const ids = disponiveis.map(d => d.id);
        const agora = new Date().toISOString();

        await supabase
          .from('redacoes')
          .update({
            corretor_id: professorId,
            status_alocacao: 'EM_CORRECAO',
            alocado_em: agora
          })
          .in('id', ids)
          .eq('status_alocacao', 'DISPONIVEL');
      }
    }

    // Retorna o lote completo atual do professor
    const { data: loteFinal } = await supabase
      .from('redacoes')
      .select('id, user_id, nome_aluno, turma_aluno, data_captura, tipo_input, imagem_url, nota_final, status_validacao, alocado_em, versao_concorrencia')
      .eq('corretor_id', professorId)
      .eq('status_alocacao', 'EM_CORRECAO')
      .order('data_captura', { ascending: true });

    return loteFinal || [];
  },

  /**
   * Devolve uma redação alocada de volta para a fila geral disponível
   */
  async devolverRedacao(id, professorId) {
    if (!isSupabaseConfigured) return false;

    const { error } = await supabase
      .from('redacoes')
      .update({
        corretor_id: null,
        status_alocacao: 'DISPONIVEL',
        alocado_em: null
      })
      .eq('id', id)
      .eq('corretor_id', professorId);

    return !error;
  },

  /**
   * Limpa leases expirados (> maxMinutes) liberando redações de volta para a fila
   */
  async limparLeasesExpirados(maxMinutes = 90) {
    if (!isSupabaseConfigured) return 0;

    const limiteExpiracao = new Date(Date.now() - maxMinutes * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('redacoes')
      .update({
        corretor_id: null,
        status_alocacao: 'DISPONIVEL',
        alocado_em: null
      })
      .eq('status_alocacao', 'EM_CORRECAO')
      .lt('alocado_em', limiteExpiracao)
      .select('id');

    if (error) {
      console.warn('[redacaoRepository.limparLeasesExpirados Error]:', error.message);
      return 0;
    }

    return (data || []).length;
  },

  /**
   * Métricas de alocação para o painel administrativo
   */
  async getMetricasAlocacao() {
    if (!isSupabaseConfigured) return null;

    const [disponiveisRes, emCorrecaoRes, concluidasRes, totalRes] = await Promise.all([
      supabase.from('redacoes').select('id', { count: 'exact', head: true }).eq('status_alocacao', 'DISPONIVEL'),
      supabase.from('redacoes').select('id', { count: 'exact', head: true }).eq('status_alocacao', 'EM_CORRECAO'),
      supabase.from('redacoes').select('id', { count: 'exact', head: true }).eq('status_validacao', 'VALIDADA'),
      supabase.from('redacoes').select('id', { count: 'exact', head: true })
    ]);

    // Redações travadas há mais de 2 horas
    const limite2h = new Date(Date.now() - 120 * 60 * 1000).toISOString();
    const { count: travadasCount } = await supabase
      .from('redacoes')
      .select('id', { count: 'exact', head: true })
      .eq('status_alocacao', 'EM_CORRECAO')
      .lt('alocado_em', limite2h);

    return {
      total: totalRes.count || 0,
      disponiveis: disponiveisRes.count || 0,
      emCorrecao: emCorrecaoRes.count || 0,
      concluidas: concluidasRes.count || 0,
      travadas2h: travadasCount || 0
    };
  },

  /**
   * Exclusão de redação
   */
  async deleteById(id) {
    if (!isSupabaseConfigured) return;
    const { error } = await supabase.from('redacoes').delete().eq('id', id);
    if (error) throw error;
  },

  async deleteAll() {
    if (!isSupabaseConfigured) return;
    const { error } = await supabase.from('redacoes').delete().neq('id', 0);
    if (error) throw error;
  },

  /**
   * Exportação integral para backup administrativo
   */
  async exportAll() {
    if (!isSupabaseConfigured) return [];
    const { data } = await supabase.from('redacoes').select('*').order('id', { ascending: true });
    return (data || []).map(r => ({
      ...r,
      extracted_data: typeof r.extracted_data === 'string' ? JSON.parse(r.extracted_data || '{}') : (r.extracted_data || {})
    }));
  }
};

export default redacaoRepository;
