import { resolveStudent } from '../utils/turmasUtils.js';
import redacaoRepository from '../repositories/redacaoRepository.js';
import userRepository from '../repositories/userRepository.js';
import { supabase } from '../config/supabaseClient.js';
import logger from '../utils/logger.js';

// GET /api/redacoes
export const getRedacoes = async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(200).json({ redacoes: [], pagination: { page: 1, limit: 25, total: 0, totalPages: 0 } });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    // Se explicitamente solicitado lote maior via limit ou all=true (máximo de 1000 por requisição)
    const limit = Math.min(1000, Math.max(1, parseInt(req.query.limit, 10) || (req.query.all === 'true' ? 1000 : 25)));
    const offset = (page - 1) * limit;

    const filters = {
      turma: req.query.turma || null,
      status: req.query.status || null,
      search: req.query.search ? req.query.search.trim() : null,
      minhas_alocadas: req.query.minhas_alocadas === 'true'
    };

    res.setHeader('Cache-Control', 'public, s-maxage=5, stale-while-revalidate=30');

    const { redacoes, total } = await redacaoRepository.findPaginated({
      user,
      offset,
      limit,
      filters
    });

    res.status(200).json({
      redacoes,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Erro ao buscar redações', { requestId: req.id, error });
    res.status(500).json({ error: 'Erro ao buscar redações.' });
  }
};

// GET /api/redacoes/ranking
export const getRanking = async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'public, s-maxage=15, stale-while-revalidate=60');
    const ranking = await redacaoRepository.findRanking();
    return res.status(200).json({ ranking });
  } catch (err) {
    logger.error('Erro ao carregar o ranking de notas', { requestId: req.id, error: err });
    return res.status(500).json({ error: 'Erro ao carregar o ranking de notas.' });
  }
};

// POST /api/redacoes
export const createRedacao = async (req, res) => {
  try {
    const {
      user_id,
      nome_aluno,
      turma_aluno,
      tipo_input,
      imagem_base64,
      imagem_url,
      texto_digitado,
      extracted_data,
      nota_final,
      status_validacao
    } = req.body;

    const initialStatus = status_validacao || (req.user?.role === 'ADMIN' ? 'VALIDADA' : 'PENDENTE_VALIDACAO');
    const validadoPor = initialStatus === 'VALIDADA' ? (req.user?.id || null) : null;
    const dataValidacao = initialStatus === 'VALIDADA' ? new Date().toISOString() : null;

    const resolved = await resolveStudent(user_id, nome_aluno, turma_aluno);

    const savedId = await redacaoRepository.create({
      user_id: resolved.user_id,
      nome_aluno: resolved.nome_aluno,
      turma_aluno: resolved.turma_aluno,
      nome_detectado: 1,
      tipo_input: tipo_input || 'imagem',
      imagem_base64: imagem_base64 || null,
      imagem_url: imagem_url || null,
      texto_digitado: texto_digitado || null,
      extracted_data: extracted_data || {},
      nota_final: nota_final || (extracted_data?.pontuacao_geral) || 0,
      status_validacao: initialStatus,
      validado_por: validadoPor,
      data_validacao: dataValidacao
    });

    logger.info(`Redação cadastrada ID #${savedId} (${resolved.nome_aluno})`, { requestId: req.id, redacaoId: savedId });

    res.status(201).json({
      message: 'Redação registrada com sucesso!',
      id: savedId,
      status_validacao: initialStatus,
      user_id: resolved.user_id,
      nome_aluno: resolved.nome_aluno,
      turma_aluno: resolved.turma_aluno
    });
  } catch (error) {
    logger.error('Erro ao salvar redação', { requestId: req.id, error });
    res.status(500).json({ error: 'Erro ao salvar redação.' });
  }
};

// PATCH /api/redacoes/:id/vincular
export const vincularAlunoRedacao = async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id, nome_aluno, turma_aluno } = req.body;

    const resolved = await resolveStudent(user_id, nome_aluno, turma_aluno);
    const validadoPor = req.user?.id || null;
    const dataValidacao = new Date().toISOString();

    const redacao = await redacaoRepository.findById(id);
    if (!redacao) {
      return res.status(404).json({ error: 'Redação não encontrada.' });
    }

    await redacaoRepository.update(id, {
      user_id: resolved.user_id,
      nome_aluno: resolved.nome_aluno,
      turma_aluno: resolved.turma_aluno,
      nome_detectado: 1,
      status_validacao: 'VALIDADA',
      validado_por: validadoPor,
      data_validacao: dataValidacao
    });

    logger.info(`Redação ID #${id} vinculada ao aluno ${resolved.nome_aluno}`, { requestId: req.id, redacaoId: id, studentId: resolved.user_id });

    res.status(200).json({
      message: `Redação ID #${id} vinculada ao aluno ${resolved.nome_aluno} com sucesso!`,
      user_id: resolved.user_id,
      nome_aluno: resolved.nome_aluno,
      turma_aluno: resolved.turma_aluno,
      status_validacao: 'VALIDADA',
      validado_por: validadoPor,
      data_validacao: dataValidacao
    });
  } catch (error) {
    logger.error('Erro ao vincular aluno à redação', { requestId: req.id, error });
    res.status(500).json({ error: 'Erro ao vincular aluno à redação.' });
  }
};

// PATCH /api/redacoes/:id/validar (Com Lock Otimista via versao_concorrencia)
export const validarRedacao = async (req, res) => {
  try {
    const { id } = req.params;
    const { nota_final, extracted_data, parecer_professor, versao_concorrencia } = req.body;

    const current = await redacaoRepository.findById(id);
    if (!current) {
      return res.status(404).json({ error: 'Redação não encontrada.' });
    }

    let updatedExtractedData = typeof current.extracted_data === 'string'
      ? JSON.parse(current.extracted_data || '{}')
      : (current.extracted_data || {});

    if (extracted_data) {
      updatedExtractedData = { ...updatedExtractedData, ...extracted_data };
    }
    if (parecer_professor) {
      updatedExtractedData.parecer_professor = parecer_professor;
    }

    const finalNota = typeof nota_final === 'number' ? nota_final : current.nota_final;

    const updatePayload = {
      status_validacao: 'VALIDADA',
      status_alocacao: 'CONCLUIDA',
      validado_por: req.user.id,
      data_validacao: new Date().toISOString(),
      nota_final: finalNota,
      extracted_data: updatedExtractedData
    };

    // Lock Otimista: se uma versão foi informada pelo cliente, confere
    if (versao_concorrencia !== undefined && versao_concorrencia !== null) {
      const lockResult = await redacaoRepository.updateWithLock(id, Number(versao_concorrencia), updatePayload);
      if (lockResult.conflict) {
        return res.status(409).json({
          error: 'Conflito de concorrência detectado: outro professor ou administrador validou ou modificou esta redação enquanto você a editava. Por favor, atualize a página para obter a versão mais recente e evitar perda de trabalho.'
        });
      }
    } else {
      await redacaoRepository.update(id, updatePayload);
    }

    // Registra no Audit Log
    if (supabase) {
      try {
        await supabase.from('audit_log').insert({
          user_id: req.user.id,
          acao: 'VALIDAR_REDACAO',
          entidade: 'redacoes',
          entidade_id: Number(id),
          metadata: { nota_final: finalNota, aluno: current.nome_aluno }
        });
      } catch (auditErr) {}
    }

    logger.info(`Redação ID #${id} validada pelo professor ID ${req.user.id}`, { requestId: req.id, redacaoId: id });

    return res.status(200).json({
      message: 'Correção validada com sucesso pelo professor! Liberada para o aluno.',
      status_validacao: 'VALIDADA',
      status_alocacao: 'CONCLUIDA'
    });
  } catch (error) {
    logger.error('Erro ao validar redação', { requestId: req.id, error });
    res.status(500).json({ error: 'Erro ao validar redação.' });
  }
};

// POST /api/redacoes/solicitar-lote (Alocação com Lease Lock para Professores)
export const solicitarLoteRedacoes = async (req, res) => {
  try {
    const professorId = req.user.id;
    const limite = Math.min(25, Math.max(1, parseInt(req.query.limite, 10) || 10));

    const lote = await redacaoRepository.solicitarLote(professorId, limite);

    return res.status(200).json({
      message: `${lote.length} redação(ões) sob sua responsabilidade de correção.`,
      redacoes: lote,
      total: lote.length
    });
  } catch (error) {
    logger.error('Erro ao solicitar lote de redações', { requestId: req.id, error });
    return res.status(500).json({ error: 'Falha ao solicitar lote de redações para correção.' });
  }
};

// POST /api/redacoes/:id/devolver (Devolve redação alocada de volta para a fila)
export const devolverRedacao = async (req, res) => {
  try {
    const { id } = req.params;
    const professorId = req.user.id;

    const liberada = await redacaoRepository.devolverRedacao(id, professorId);

    if (!liberada) {
      return res.status(400).json({ error: 'Não foi possível devolver esta redação (ela pode não estar atribuída a você).' });
    }

    return res.status(200).json({ message: 'Redação devolvida com sucesso para a fila geral!' });
  } catch (error) {
    logger.error('Erro ao devolver redação', { requestId: req.id, error });
    return res.status(500).json({ error: 'Falha ao devolver redação.' });
  }
};

// GET /api/redacoes/metricas-alocacao (Admin Only)
export const getMetricasAlocacao = async (req, res) => {
  try {
    const metricas = await redacaoRepository.getMetricasAlocacao();
    return res.status(200).json({ metricas });
  } catch (error) {
    logger.error('Erro ao obter métricas de alocação', { requestId: req.id, error });
    return res.status(500).json({ error: 'Falha ao obter métricas de alocação.' });
  }
};

// DELETE /api/redacoes/clear-all
export const deleteAllRedacoes = async (req, res) => {
  try {
    await redacaoRepository.deleteAll();
    logger.audit(`TODAS as redações foram apagadas pelo Administrador ID ${req.user.id}`, { requestId: req.id, adminId: req.user.id });
    return res.status(200).json({ message: 'Todas as redações foram apagadas com sucesso.' });
  } catch (error) {
    logger.error('Erro ao apagar redações', { requestId: req.id, error });
    res.status(500).json({ error: 'Erro ao apagar redações.' });
  }
};

// DELETE /api/redacoes/:id
export const deleteRedacao = async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.user) {
      return res.status(401).json({ error: 'Acesso não autorizado.' });
    }

    if (req.user.role !== 'ADMIN' && req.user.role !== 'PROFESSOR') {
      return res.status(403).json({ error: 'Apenas professores e administradores podem excluir redações.' });
    }

    await redacaoRepository.deleteById(id);
    logger.info(`Redação ID #${id} excluída pelo usuário ID ${req.user.id}`, { requestId: req.id, redacaoId: id });

    return res.status(200).json({ message: 'Redação excluída com sucesso do banco de dados.' });
  } catch (error) {
    logger.error('Erro ao excluir redação', { requestId: req.id, error });
    res.status(500).json({ error: 'Erro ao excluir redação.' });
  }
};

// GET /api/export-db
export const exportDatabase = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Apenas administradores podem exportar o banco de dados.' });
    }

    const users = await userRepository.exportAll();
    const redacoes = await redacaoRepository.exportAll();

    const backup = {
      exported_at: new Date().toISOString(),
      counts: {
        users: users.length,
        redacoes: redacoes.length
      },
      users,
      redacoes
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="agora-db-backup.json"');
    return res.status(200).send(JSON.stringify(backup, null, 2));
  } catch (error) {
    logger.error('Falha ao exportar banco de dados', { requestId: req.id, error });
    return res.status(500).json({ error: 'Falha ao exportar banco de dados.', details: error.message });
  }
};

// GET /api/redacoes/:id
export const getRedacaoById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    res.setHeader('Cache-Control', 'public, s-maxage=10, stale-while-revalidate=60');

    const redacao = await redacaoRepository.findById(id);

    if (!redacao) {
      return res.status(404).json({ error: 'Redação não encontrada.' });
    }

    if (!user) {
      return res.status(401).json({ error: 'Autenticação necessária para visualizar a redação.' });
    }

    if (user.role !== 'ADMIN' && user.role !== 'PROFESSOR') {
      const cleanStudentName = (user.nome || '').trim().toLowerCase();
      const alunoNome = (redacao.nome_aluno || '').trim().toLowerCase();
      const isOwner = (redacao.user_id && Number(redacao.user_id) === Number(user.id)) || (alunoNome && alunoNome === cleanStudentName);

      if (!isOwner) {
        const topRanking = await redacaoRepository.findRanking();
        const isTop3 = Array.isArray(topRanking) && topRanking.slice(0, 3).some(r => Number(r.id) === Number(id));
        if (!isTop3) {
          return res.status(403).json({ error: 'Você só tem permissão para visualizar suas próprias redações ou modelos do Top 3.' });
        }
      }
    }

    return res.status(200).json(redacao);
  } catch (error) {
    logger.error('Erro ao carregar detalhes da redação', { requestId: req.id, error: error.message });
    return res.status(500).json({ error: 'Erro ao carregar detalhes da redação.' });
  }
};
