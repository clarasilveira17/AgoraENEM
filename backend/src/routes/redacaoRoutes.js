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
import { authenticate, requireAdmin, requireTeacherOrAdmin, optionalAuthenticate } from '../middleware/authMiddleware.js';
import { exportDbLimiter } from '../middleware/rateLimitMiddleware.js';

const router = express.Router();

router.get('/export-db', exportDbLimiter, authenticate, requireAdmin, exportDatabase);
router.get('/export', exportDbLimiter, authenticate, requireAdmin, exportDatabase);
router.get('/ranking', optionalAuthenticate, getRanking);
router.post('/sync-legacy', authenticate, requireTeacherOrAdmin, syncLegacyRedacoes);
router.get('/', optionalAuthenticate, getRedacoes);
router.get('/:id', optionalAuthenticate, getRedacaoById);
router.post('/', authenticate, requireTeacherOrAdmin, createRedacao);
router.patch('/:id/vincular', authenticate, requireTeacherOrAdmin, vincularAlunoRedacao);
router.patch('/:id/validar', authenticate, requireTeacherOrAdmin, validarRedacao);
router.delete('/clear-all', authenticate, requireAdmin, deleteAllRedacoes);
router.delete('/:id', authenticate, requireTeacherOrAdmin, deleteRedacao);

export default router;

