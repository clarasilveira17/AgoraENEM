/**
 * Lightweight, in-memory sliding-window Rate Limiter middleware for Express
 * Protects against Denial of Service (DoS) and API quota exhaustion.
 */
export function createRateLimiter({ windowMs = 60 * 1000, max = 60, message = 'Muitas requisições. Por favor, tente novamente mais tarde.' } = {}) {
  const hits = new Map();

  // Periodic cleanup of expired entries every 2 minutes
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of hits.entries()) {
      if (now - record.startTime > windowMs) {
        hits.delete(key);
      }
    }
  }, 2 * 60 * 1000);

  // Unref interval so it doesn't hold open process in tests
  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }

  return (req, res, next) => {
    // Determine client identifier: authenticated user ID or remote IP
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown-ip';
    const key = req.user?.id ? `user_${req.user.id}` : `ip_${ip}`;
    const now = Date.now();

    let record = hits.get(key);

    if (!record || (now - record.startTime > windowMs)) {
      record = { count: 1, startTime: now };
      hits.set(key, record);
    } else {
      record.count += 1;
    }

    const remaining = Math.max(0, max - record.count);
    const resetTime = Math.ceil((record.startTime + windowMs - now) / 1000);

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', resetTime);

    if (record.count > max) {
      res.setHeader('Retry-After', resetTime);
      return res.status(429).json({
        error: message,
        retryAfterSeconds: resetTime
      });
    }

    next();
  };
}

// Limiter geral para API (60 reqs / minuto)
export const generalLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 60,
  message: 'Limite de requisições excedido. Aguarde um momento.'
});

// Limiter restrito para chamadas de IA e OCR (15 reqs / minuto)
export const aiCorrectionLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 15,
  message: 'Limite de avaliações de IA por minuto atingido para proteger sua cota. Aguarde alguns instantes antes de enviar novas redações.'
});

// Limiter restrito para Exportação de Banco de Dados (5 reqs / hora)
export const exportDbLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'Limite de exportações de banco de dados por hora atingido por motivos de segurança e conformidade LGPD.'
});

