import express from 'express';
import {
  getRedacoes,
  getRedacaoById,
  getRanking,
  createRedacao,
  vincularAlunoRedacao,
  validarRedacao,
  solicitarLoteRedacoes,
  devolverRedacao,
  getMetricasAlocacao,
  deleteRedacao,
  deleteAllRedacoes,
  exportDatabase
} from '../controllers/redacaoController.js';
import { authenticate, requireAdmin, requireTeacherOrAdmin, optionalAuthenticate } from '../middleware/authMiddleware.js';
import { exportDbLimiter } from '../middleware/rateLimitMiddleware.js';

const router = express.Router();

router.get('/export-db', exportDbLimiter, authenticate, requireAdmin, exportDatabase);
router.get('/export', exportDbLimiter, authenticate, requireAdmin, exportDatabase);
router.get('/ranking', optionalAuthenticate, getRanking);
router.get('/metricas-alocacao', authenticate, requireAdmin, getMetricasAlocacao);

// Alocação e Gestão de Lotes de Correção (Professores)
router.post('/solicitar-lote', authenticate, requireTeacherOrAdmin, solicitarLoteRedacoes);
router.post('/:id/devolver', authenticate, requireTeacherOrAdmin, devolverRedacao);
router.get('/', optionalAuthenticate, getRedacoes);
router.get('/:id', optionalAuthenticate, getRedacaoById);
router.post('/', authenticate, requireTeacherOrAdmin, createRedacao);
router.patch('/:id/vincular', authenticate, requireTeacherOrAdmin, vincularAlunoRedacao);
router.patch('/:id/validar', authenticate, requireTeacherOrAdmin, validarRedacao);
router.delete('/clear-all', authenticate, requireAdmin, deleteAllRedacoes);
router.delete('/:id', authenticate, requireTeacherOrAdmin, deleteRedacao);

export default router;
