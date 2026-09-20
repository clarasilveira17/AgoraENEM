/**
 * Structured Logger utility supporting Request Correlation IDs and JSON output in production
 */
const isProduction = process.env.NODE_ENV === 'production';

export const logger = {
  info(message, meta = {}) {
    this._log('INFO', message, meta);
  },
  warn(message, meta = {}) {
    this._log('WARN', message, meta);
  },
  error(message, errorOrMeta = {}) {
    const meta = errorOrMeta instanceof Error
      ? { error: errorOrMeta.message, stack: errorOrMeta.stack }
      : errorOrMeta;
    this._log('ERROR', message, meta);
  },
  audit(message, meta = {}) {
    this._log('AUDIT', message, meta);
  },
  _log(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const requestId = meta.requestId || 'N/A';

    if (isProduction) {
      console.log(JSON.stringify({
        timestamp,
        level,
        requestId,
        message,
        ...meta
      }));
    } else {
      const prefix = `[${timestamp}] [${level}] [ReqID: ${requestId}]`;
      if (level === 'ERROR') {
        console.error(`${prefix} ${message}`, Object.keys(meta).length > 1 ? meta : '');
      } else if (level === 'WARN') {
        console.warn(`${prefix} ${message}`, Object.keys(meta).length > 1 ? meta : '');
      } else if (level === 'AUDIT') {
        console.log(`🔒 ${prefix} ${message}`, Object.keys(meta).length > 1 ? meta : '');
      } else {
        console.log(`${prefix} ${message}`, Object.keys(meta).length > 1 ? meta : '');
      }
    }
  }
};

export default logger;
