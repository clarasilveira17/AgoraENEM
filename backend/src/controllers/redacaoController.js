import { resolveStudent } from '../utils/turmasUtils.js';
import redacaoRepository from '../repositories/redacaoRepository.js';
import userRepository from '../repositories/userRepository.js';
import logger from '../utils/logger.js';

// POST /api/redacoes/sync-legacy
export const syncLegacyRedacoes = async (req, res) => {
  try {
    const { redacoes } = req.body;
    if (!Array.isArray(redacoes) || redacoes.length === 0) {
      return res.status(400).json({ error: 'Nenhuma redação fornecida para sincronização.' });
    }

    let insertedCount = 0;
    let skippedCount = 0;

    for (const item of redacoes) {
      const rawNome = item.nome_aluno || item.nomeAluno || 'Aluno Não Identificado';
      const rawTurma = item.turma_aluno || item.turmaAluno || 'Turma Geral';
      const dataCaptura = item.data_captura || item.dataCaptura || new Date().toISOString();

      let extractedDataObj = {};
      if (typeof item.extracted_data === 'string') {
        try { extractedDataObj = JSON.parse(item.extracted_data || '{}'); } catch(e) {}
      } else {
        extractedDataObj = item.extracted_data || item.resultado || {};
      }

      const notaFinal = item.nota_final || item.notaFinal || (extractedDataObj?.avaliacoes?.enem?.nota_total_enem) || (extractedDataObj?.pontuacao_geral) || 0;
      const imagemBase64 = item.imagem_base64 || item.imagemBase64 || null;
      const textoDigitado = item.texto_digitado || item.textoDigitado || null;
      const tipoInput = item.tipo_input || item.tipoInput || 'imagem';
      const statusValidacao = item.status_validacao || 'VALIDADA';
      const validadoPor = req.user?.id || 1;
      const dataValidacao = item.data_validacao || new Date().toISOString();

      const resolved = await resolveStudent(item.user_id, rawNome, rawTurma);

      const savedId = await redacaoRepository.create({
        user_id: resolved.user_id,
        nome_aluno: resolved.nome_aluno,
        turma_aluno: resolved.turma_aluno,
        nome_detectado: 1,
        data_captura: dataCaptura,
        tipo_input: tipoInput,
        imagem_base64: imagemBase64,
        texto_digitado: textoDigitado,
        extracted_data: extractedDataObj,
        nota_final: notaFinal,
        status_validacao: statusValidacao,
        validado_por: validadoPor,
        data_validacao: dataValidacao
      });

      if (savedId) {
        insertedCount++;
      } else {
        skippedCount++;
      }
    }

    logger.info(`Sincronização de redações concluída: ${insertedCount} salvas, ${skippedCount} ignoradas`, { requestId: req.id });

    res.status(200).json({
      message: `${insertedCount} correções locais sincronizadas e disponibilizadas com sucesso! (${skippedCount} já existiam)`,
      insertedCount,
      skippedCount
    });
  } catch (error) {
    logger.error('Falha ao sincronizar correções com a nuvem', { requestId: req.id, error });
    res.status(500).json({ error: 'Falha ao sincronizar correções com a nuvem.' });
  }
};

// GET /api/redacoes
export const getRedacoes = async (req, res) => {
  try {
    const user = req.user;
    const includeImage = req.query.include_image === 'true';

    if (!user) {
      return res.status(200).json({ redacoes: [] });
    }

    res.setHeader('Cache-Control', 'public, s-maxage=5, stale-while-revalidate=30');

    const formatted = await redacaoRepository.findAll({ user, includeImage });
    res.status(200).json({ redacoes: formatted });
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
      texto_digitado,
      extracted_data,
      nota_final,
      status_validacao
    } = req.body;

    const initialStatus = status_validacao || (req.user?.role === 'ADMIN' ? 'VALIDADA' : 'PENDENTE_VALIDACAO');
    const validadoPor = initialStatus === 'VALIDADA' ? (req.user?.id || 1) : null;
    const dataValidacao = initialStatus === 'VALIDADA' ? new Date().toISOString() : null;

    const resolved = await resolveStudent(user_id, nome_aluno, turma_aluno);

    const savedId = await redacaoRepository.create({
      user_id: resolved.user_id,
      nome_aluno: resolved.nome_aluno,
      turma_aluno: resolved.turma_aluno,
      nome_detectado: 1,
      tipo_input: tipo_input || 'imagem',
      imagem_base64: imagem_base64 || null,
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
    const validadoPor = req.user?.id || 1;
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

// PATCH /api/redacoes/:id/validar
export const validarRedacao = async (req, res) => {
  try {
    const { id } = req.params;
    const { nota_final, extracted_data, parecer_professor } = req.body;

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

    await redacaoRepository.update(id, {
      status_validacao: 'VALIDADA',
      validado_por: req.user.id,
      data_validacao: new Date().toISOString(),
      nota_final: finalNota,
      extracted_data: updatedExtractedData
    });

    logger.info(`Redação ID #${id} validada pelo professor ID ${req.user.id}`, { requestId: req.id, redacaoId: id });

    return res.status(200).json({
      message: 'Correção validada com sucesso pelo professor! Liberada para o aluno.',
      status_validacao: 'VALIDADA'
    });
  } catch (error) {
    logger.error('Erro ao validar redação', { requestId: req.id, error });
    res.status(500).json({ error: 'Erro ao validar redação.' });
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
      return res.status(401).json({ error: 'Acesso não autorizado. Autenticação necessária.' });
    }

    if (req.user.role !== 'ADMIN' && req.user.role !== 'PROFESSOR') {
      return res.status(403).json({ error: 'Apenas professores e administradores podem excluir redações.' });
    }

    await redacaoRepository.deleteById(id);
    logger.info(`Redação ID #${id} excluída pelo usuário ID ${req.user.id} (${req.user.role})`, { requestId: req.id, redacaoId: id });

    return res.status(200).json({ message: 'Redação excluída com sucesso do banco de dados.' });
  } catch (error) {
    logger.error('Erro ao excluir redação', { requestId: req.id, error });
    res.status(500).json({ error: 'Erro ao excluir redação.' });
  }
};

// GET /api/export-db or /api/redacoes/export-db
export const exportDatabase = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Acesso não autorizado.' });
    }
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Apenas administradores podem exportar o banco de dados.' });
    }

    logger.audit(`Exportação integral da base solicitada por Administrador ID ${req.user.id} (${req.user.email}) - IP: ${req.ip || 'N/A'}`, {
      requestId: req.id,
      adminId: req.user.id,
      adminEmail: req.user.email,
      ip: req.ip
    });

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
        // Permite visualização se for redação modelo do Top 3
        const topRanking = await redacaoRepository.getRanking(3);
        const isTop3 = Array.isArray(topRanking) && topRanking.some(r => Number(r.id) === Number(id));
        if (!isTop3) {
          return res.status(403).json({ error: 'Você só tem permissão para visualizar suas próprias redações ou as redações modelo do Top 3.' });
        }
      }
    }

    return res.status(200).json(redacao);
  } catch (error) {
    logger.error('Erro ao carregar detalhes da redação', { requestId: req.id, error });
    return res.status(500).json({ error: 'Erro ao carregar detalhes da redação.' });
  }
};
