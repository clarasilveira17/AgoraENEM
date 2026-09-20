import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRoutes from './src/routes/apiRoutes.js';
import { generalLimiter } from './src/middleware/rateLimitMiddleware.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Disable ETag and configure no-cache headers to prevent stale 304 responses
app.set('etag', false);
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// Configure CORS to allow frontend communication
app.use(cors());

// General Rate Limiter for all API routes
app.use('/api', generalLimiter);

// Payload limit setup for image uploads (10mb safe limit)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Mount API routes
app.use('/api', apiRoutes);

// Root health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Ágora ENEM API Operational' });
});

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`==================================================`);
    console.log(`  Plataforma SaaS IA (ENEM x Sisedu - Agente Unificado)`);
    console.log(`  API Endpoint: http://localhost:${PORT}/api/corrigir`);
    console.log(`==================================================`);
  });
}

export default app;
