import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRoutes from './src/routes/apiRoutes.js';
import { generalLimiter } from './src/middleware/rateLimitMiddleware.js';
import { securityHeadersMiddleware } from './src/middleware/securityHeadersMiddleware.js';
import db from './src/config/db.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// 1. Security Headers & Correlation ID (X-Request-Id)
app.use(securityHeadersMiddleware);

// 2. Disable ETag and configure no-cache headers to prevent stale responses
app.set('etag', false);
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// 3. Configure CORS with configurable origin whitelist
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : null;

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests or any origin if no whitelist is specified
    if (!origin || !allowedOrigins || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      return callback(null, true);
    }
    return callback(new Error('Origem não permitida pela política de CORS.'));
  },
  credentials: true
}));

// 4. Rate Limiter for all API routes
app.use('/api', generalLimiter);

// 5. Payload limit setup for image uploads (10mb safe limit)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// 6. Mount API routes
app.use('/api', apiRoutes);

// 7. Root health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Ágora ENEM API Operational',
    timestamp: new Date().toISOString(),
    requestId: req.id
  });
});

// 8. 404 Handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'Endpoint da API não encontrado.' });
});

// 9. Global Error Handler Middleware
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  console.error(`[Global Error] [ReqID: ${req.id || 'N/A'}] ${err.message}`, err.stack);
  res.status(status).json({
    error: err.message || 'Erro interno do servidor.',
    requestId: req.id
  });
});

// Process safety and Graceful Shutdown (Standalone Node environment)
if (!process.env.VERCEL && process.env.NODE_ENV !== 'test') {
  const server = app.listen(PORT, () => {
    console.log(`==================================================`);
    console.log(`  Plataforma SaaS IA (ENEM x Sisedu - Agente Unificado)`);
    console.log(`  API Endpoint: http://localhost:${PORT}/api/corrigir`);
    console.log(`==================================================`);
  });

  const shutdown = (signal) => {
    console.log(`\n[Process] Recebido sinal ${signal}. Encerrando conexões com segurança...`);
    server.close(() => {
      if (db && typeof db.close === 'function') {
        try {
          db.close();
          console.log('[SQLite DB] Conexão com banco local fechada.');
        } catch (e) {}
      }
      console.log('[Process] Servidor encerrado com sucesso.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Process Unhandled Rejection]:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[Process Uncaught Exception]:', error);
});

export default app;
