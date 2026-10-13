let Ratelimit = null;
let Redis = null;
let redis = null;

try {
  const ratelimitPkg = await import('@upstash/ratelimit');
  const redisPkg = await import('@upstash/redis');
  Ratelimit = ratelimitPkg.Ratelimit;
  Redis = redisPkg.Redis;

  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN
    });
    console.log('[RateLimiter] Upstash Redis configurado com sucesso para rate limiting distribuído.');
  }
} catch (err) {
  // Caso os pacotes ainda não estejam instalados localmente, usa fallback seguro em memória
}

/**
 * Cria um middleware de rate limit distribuído serverless (Upstash) com fallback seguro
 */
export function createRateLimiter({
  max = 60,
  windowDuration = '1 m',
  windowMs = 60 * 1000,
  message = 'Muitas requisições. Por favor, aguarde alguns instantes.'
} = {}) {
  let upstashLimiter = null;

  if (redis) {
    try {
      upstashLimiter = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(max, windowDuration),
        analytics: true,
        prefix: 'agora_enem_ratelimit'
      });
    } catch (e) {
      console.warn('[RateLimiter Upstash Fallback]:', e.message);
    }
  }

  // Fallback local caso Upstash não esteja conectado ainda
  const memoryHits = new Map();

  return async (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
    const email = req.body?.email ? String(req.body.email).toLowerCase().trim() : '';
    const identifier = req.user?.id
      ? `user_${req.user.id}`
      : email
      ? `login_${ip}_${email}`
      : `ip_${ip}`;

    if (upstashLimiter) {
      try {
        const { success, limit, remaining, reset } = await upstashLimiter.limit(identifier);

        res.setHeader('X-RateLimit-Limit', limit);
        res.setHeader('X-RateLimit-Remaining', remaining);
        res.setHeader('X-RateLimit-Reset', reset);

        if (!success) {
          const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
          res.setHeader('Retry-After', retryAfter);
          return res.status(429).json({
            error: message,
            retryAfterSeconds: retryAfter
          });
        }
        return next();
      } catch (err) {
        console.warn('[RateLimiter Upstash Exec Error]:', err.message);
        // Prossegue para o fallback em caso de falha de rede do Redis
      }
    }

    // Fallback in-memory
    const now = Date.now();
    let record = memoryHits.get(identifier);

    if (!record || (now - record.startTime > windowMs)) {
      record = { count: 1, startTime: now };
      memoryHits.set(identifier, record);
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

// 1. Limiter Geral para API (60 reqs / min)
export const generalLimiter = createRateLimiter({
  max: 60,
  windowDuration: '1 m',
  windowMs: 60 * 1000,
  message: 'Limite de requisições excedido. Por favor, aguarde um minuto.'
});

// 2. Limiter Estrito de Autenticação / Login (5 reqs / min)
export const loginLimiter = createRateLimiter({
  max: 5,
  windowDuration: '1 m',
  windowMs: 60 * 1000,
  message: 'Muitas tentativas de login ou recuperação de senha. Por segurança, aguarde 1 minuto antes de tentar novamente.'
});

// 3. Limiter para Avaliação com IA (20 reqs / min)
export const aiCorrectionLimiter = createRateLimiter({
  max: 20,
  windowDuration: '1 m',
  windowMs: 60 * 1000,
  message: 'Limite de correções por minuto atingido. Aguarde alguns instantes para envio de novos lotes.'
});

// 4. Limiter para Exportação de Banco de Dados (5 reqs / hora)
export const exportDbLimiter = createRateLimiter({
  max: 5,
  windowDuration: '1 h',
  windowMs: 60 * 60 * 1000,
  message: 'Limite de exportações de dados por hora atingido por segurança.'
});
