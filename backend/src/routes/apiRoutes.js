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

// Migração Administrativa sob demanda (Vercel Deploy / Setup)
import('../config/migrate.js').then(({ runMigrations }) => {
  router.all('/admin/run-migration', async (req, res) => {
    const secret = req.query.secret || req.headers['x-admin-key'] || req.body?.secret;
    const expectedSecret = process.env.PROFESSOR_SECRET_KEY || 'AGORA2026';

    if (!secret || String(secret).trim() !== String(expectedSecret).trim()) {
      return res.status(403).json({
        error: 'Acesso não autorizado. Informe a chave secreta (?secret=AGORA2026).'
      });
    }

    const customDbUrl = req.query.db_url || req.body?.db_url || null;
    const result = await runMigrations(customDbUrl);
    return res.status(result.success ? 200 : (result.skipped ? 200 : 500)).json(result);
  });
});

export default router;
