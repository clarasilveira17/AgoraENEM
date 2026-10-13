import express from 'express';
import {
  handleCorrection,
  reprocessEssay,
  reprocessAllFailed,
  getQueueStatus,
  getJobStatus,
  cronProcessJobs,
  cronCleanupLeases
} from '../controllers/correctionController.js';
import { exportDatabase } from '../controllers/redacaoController.js';
import authRoutes from './authRoutes.js';
import redacaoRoutes from './redacaoRoutes.js';

import { authenticate, requireAdmin, requireTeacherOrAdmin } from '../middleware/authMiddleware.js';
import { aiCorrectionLimiter, exportDbLimiter } from '../middleware/rateLimitMiddleware.js';

const router = express.Router();

// Direct Database Export Backup Route (/api/export-db)
router.get('/export-db', exportDbLimiter, authenticate, requireAdmin, exportDatabase);

// Auth routes (/api/auth/*)
router.use('/auth', authRoutes);

// Redações routes (/api/redacoes/*)
router.use('/redacoes', redacaoRoutes);

// Consulta de Job Assíncrono (/api/jobs/:id)
router.get('/jobs/:id', authenticate, getJobStatus);

// Queue Status Route (/api/queue/status)
router.get('/queue/status', authenticate, getQueueStatus);

// Vercel Cron Endpoints (Consumidos periodicamente)
router.get('/cron/process-jobs', cronProcessJobs);
router.get('/cron/cleanup-leases', cronCleanupLeases);

// Reprocessamento de Redações com Erro
router.post('/redacoes/reprocessar-erros', aiCorrectionLimiter, authenticate, requireTeacherOrAdmin, reprocessAllFailed);
router.post('/redacoes/:id/reprocessar', aiCorrectionLimiter, authenticate, requireTeacherOrAdmin, reprocessEssay);

// AI Correction endpoint (Enfileira ou avalia)
router.post(['/corrigir', '/sync'], aiCorrectionLimiter, authenticate, requireTeacherOrAdmin, handleCorrection);

export default router;
