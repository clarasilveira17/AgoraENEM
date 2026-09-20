import crypto from 'crypto';

/**
 * Middleware to apply HTTP Security Headers and generate Request Correlation ID
 */
export function securityHeadersMiddleware(req, res, next) {
  // 1. Assign or propagate Correlation ID for request tracing
  const incomingRequestId = req.headers['x-request-id'];
  const requestId = incomingRequestId || crypto.randomUUID();
  req.id = requestId;
  res.setHeader('X-Request-Id', requestId);

  // 2. Defensive HTTP Headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // 3. Strict Transport Security (HSTS) in production
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  next();
}
