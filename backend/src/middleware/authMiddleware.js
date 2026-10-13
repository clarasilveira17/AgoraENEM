import jwt from 'jsonwebtoken';
import userRepository from '../repositories/userRepository.js';

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    if (process.env.NODE_ENV === 'test') {
      return 'test-secret-key-vitest-only';
    }
    throw new Error('[Segurança Crítica] Variável de ambiente JWT_SECRET obrigatória não configurada. O boot do servidor foi interrompido.');
  }
  return secret;
};

export const JWT_SECRET = getJwtSecret();

export const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Acesso não autorizado. Token ausente.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await userRepository.findById(decoded.id);

    if (!user) {
      return res.status(401).json({ error: 'Usuário não encontrado.' });
    }

    if (user.is_ativo === false) {
      return res.status(401).json({ error: 'Esta conta foi desativada. Entre em contato com a coordenação.' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido ou expirado.' });
  }
};

export const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Acesso negado. Requer privilégios de Administrador Geral.' });
  }
  next();
};

export const requireTeacherOrAdmin = (req, res, next) => {
  if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'PROFESSOR')) {
    return res.status(403).json({ error: 'Acesso negado. Requer privilégios de Professor ou Administrador.' });
  }
  next();
};

export const optionalAuthenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await userRepository.findById(decoded.id);
    if (user && user.is_ativo !== false) {
      req.user = user;
    }
  } catch (err) {
    // Continua sem usuário logado se token for inválido
  }
  next();
};
