import jwt from 'jsonwebtoken';
import db from '../config/db.js';
import { supabase, isSupabaseConfigured } from '../config/supabaseClient.js';

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('[Segurança Crítica] Variável de ambiente JWT_SECRET obrigatória não configurada.');
    }
    console.warn('[Segurança Alerta] JWT_SECRET não configurado no .env. Usando fallback temporário de desenvolvimento local.');
    return 'dev-insecure-secret-key-change-me-in-env';
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
    
    let user = null;

    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('users')
        .select('id, nome, email, role, turma')
        .eq('id', decoded.id)
        .maybeSingle();

      if (!error && data) {
        user = data;
      }
    }

    if (!user && db) {
      try {
        user = db.prepare('SELECT id, nome, email, role, turma FROM users WHERE id = ?').get(decoded.id);
      } catch (dbErr) {
        console.warn('[DB Authenticate Warning]:', dbErr.message);
      }
    }

    if (!user) {
      return res.status(401).json({ error: 'Usuário não encontrado ou inativo.' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido ou expirado.' });
  }
};

export const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Acesso negado. Requer privilégios de Administrador/Professor.' });
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
    let user = null;

    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('users')
        .select('id, nome, email, role, turma')
        .eq('id', decoded.id)
        .maybeSingle();

      if (!error && data) {
        user = data;
      }
    }

    if (!user && db) {
      try {
        user = db.prepare('SELECT id, nome, email, role, turma FROM users WHERE id = ?').get(decoded.id);
      } catch (dbErr) {
        console.warn('[DB Optional Authenticate Warning]:', dbErr.message);
      }
    }

    if (user) {
      req.user = user;
    }
  } catch (err) {
    // Continua sem usuário logado se token for inválido
  }
  next();
};

