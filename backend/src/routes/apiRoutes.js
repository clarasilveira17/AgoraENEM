import express from 'express';
import { handleCorrection, reprocessEssay, reprocessAllFailed, getQueueStatus } from '../controllers/correctionController.js';
import { exportDatabase } from '../controllers/redacaoController.js';
import authRoutes from './authRoutes.js';
import redacaoRoutes from './redacaoRoutes.js';

import { authenticate, requireAdmin } from '../middleware/authMiddleware.js';
import { aiCorrectionLimiter, exportDbLimiter } from '../middleware/rateLimitMiddleware.js';

const router = express.Router();

// Direct Database Export Backup Route (/api/export-db) - Protegido por Autenticação, RBAC Admin e Rate Limiter Estrito
router.get('/export-db', exportDbLimiter, authenticate, requireAdmin, exportDatabase);

// Auth routes (/api/auth/login, /api/auth/register, /api/auth/me, /api/auth/estudantes)
router.use('/auth', authRoutes);

// Redações routes (/api/redacoes, /api/redacoes/sync-legacy)
router.use('/redacoes', redacaoRoutes);

// Queue Status Route (/api/queue/status)
router.get('/queue/status', authenticate, getQueueStatus);

// Reprocessamento de Redações com Erro (/api/redacoes/:id/reprocessar e /api/redacoes/reprocessar-erros)
router.post('/redacoes/reprocessar-erros', aiCorrectionLimiter, authenticate, requireAdmin, reprocessAllFailed);
router.post('/redacoes/:id/reprocessar', aiCorrectionLimiter, authenticate, requireAdmin, reprocessEssay);

// AI Correction endpoint (Protegido por Autenticação + Rate Limiter de IA)
router.post(['/corrigir', '/sync'], aiCorrectionLimiter, authenticate, handleCorrection);

export default router;
