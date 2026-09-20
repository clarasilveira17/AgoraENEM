import express from 'express';
import {
  syncLegacyRedacoes,
  getRedacoes,
  getRedacaoById,
  getRanking,
  createRedacao,
  vincularAlunoRedacao,
  validarRedacao,
  deleteRedacao,
  deleteAllRedacoes,
  exportDatabase
} from '../controllers/redacaoController.js';
import { authenticate, requireAdmin, optionalAuthenticate } from '../middleware/authMiddleware.js';
import { exportDbLimiter } from '../middleware/rateLimitMiddleware.js';

const router = express.Router();

router.get('/export-db', exportDbLimiter, authenticate, requireAdmin, exportDatabase);
router.get('/export', exportDbLimiter, authenticate, requireAdmin, exportDatabase);
router.get('/ranking', optionalAuthenticate, getRanking);
router.post('/sync-legacy', authenticate, syncLegacyRedacoes);
router.get('/', optionalAuthenticate, getRedacoes);
router.get('/:id', optionalAuthenticate, getRedacaoById);
router.post('/', authenticate, createRedacao);
router.patch('/:id/vincular', authenticate, requireAdmin, vincularAlunoRedacao);
router.patch('/:id/validar', authenticate, requireAdmin, validarRedacao);
router.delete('/clear-all', authenticate, requireAdmin, deleteAllRedacoes);
router.delete('/:id', authenticate, requireAdmin, deleteRedacao);

export default router;

