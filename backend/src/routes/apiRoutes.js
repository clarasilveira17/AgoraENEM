import express from 'express';
import { handleCorrection } from '../controllers/correctionController.js';
import { exportDatabase } from '../controllers/redacaoController.js';
import authRoutes from './authRoutes.js';
import redacaoRoutes from './redacaoRoutes.js';

import { authenticate, requireAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

// Direct Database Export Backup Route (/api/export-db) - Protegido apenas para Administradores
router.get('/export-db', authenticate, requireAdmin, exportDatabase);

// Auth routes (/api/auth/login, /api/auth/register, /api/auth/me, /api/auth/estudantes)
router.use('/auth', authRoutes);

// Redações routes (/api/redacoes, /api/redacoes/sync-legacy)
router.use('/redacoes', redacaoRoutes);

// AI Correction endpoint
router.post(['/corrigir', '/sync'], handleCorrection);

export default router;
