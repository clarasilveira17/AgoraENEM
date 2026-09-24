import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../middleware/authMiddleware.js';
import { invalidateStudentCache } from '../utils/turmasUtils.js';
import userRepository from '../repositories/userRepository.js';
import logger from '../utils/logger.js';

function safeCompareStrings(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// POST /api/auth/login
export const login = async (req, res) => {
  try {
    const { email, senha } = req.body || {};

    if (!email || !senha) {
      return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanSenha = String(senha).trim();
    const user = await userRepository.findByEmail(cleanEmail);

    if (!user) {
      logger.warn(`[Login Falho]: Usuário não encontrado para email="${cleanEmail}"`, { requestId: req.id });
      return res.status(401).json({ error: 'Credenciais inválidas. Verifique seu e-mail e senha.' });
    }

    if (!user.senha_hash) {
      return res.status(401).json({ error: 'Usuário sem senha cadastrada. Por favor, redefina sua senha com a coordenação.' });
    }

    const isRawHashMatch = cleanSenha === user.senha_hash;
    let isBcryptMatch = false;
    try {
      isBcryptMatch = await bcrypt.compare(cleanSenha, user.senha_hash);
    } catch (e) {
      isBcryptMatch = false;
    }

    const isValidPassword = isRawHashMatch || isBcryptMatch;

    if (!isValidPassword) {
      logger.warn(`[Login Falho]: Senha incorreta para usuário ${user.email}`, { requestId: req.id });
      return res.status(401).json({ error: 'Credenciais inválidas. Verifique seu e-mail e senha.' });
    }

    const tokenPayload = {
      id: user.id,
      email: user.email,
      role: user.role
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '7d' });

    logger.info(`Usuário autenticado com sucesso: ${user.email} (${user.role})`, { requestId: req.id, userId: user.id });

    return res.status(200).json({
      message: 'Login realizado com sucesso!',
      token,
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        role: user.role,
        turma: user.turma
      }
    });
  } catch (error) {
    logger.error('Erro interno ao realizar login', { requestId: req.id, error });
    return res.status(500).json({ error: 'Erro interno ao realizar login.', details: error?.message });
  }
};

// POST /api/auth/register
export const register = async (req, res) => {
  try {
    const { nome, email, senha, role = 'ESTUDANTE', turma = '' } = req.body;

    if (!nome || !email || !senha) {
      return res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanNome = nome.trim();
    const cleanTurma = turma.trim();

    const existingUser = await userRepository.findByEmail(cleanEmail);
    if (existingUser) {
      return res.status(400).json({ error: 'Este e-mail já está cadastrado no sistema.' });
    }

    const senhaHash = await bcrypt.hash(senha, 10);
    
    // Lista estrita de domínios institucionais exclusivos de professores e gestores escolares da SEDUC/CE
    const strictTeacherDomains = [
      '@prof.ce.gov.br',
      '@professor.ce.gov.br',
      '@seduc.ce.gov.br',
      '@sobral.ce.gov.br',
      '@educacao.ce.gov.br'
    ];

    // Domínios estritos exclusivos de alunos (SEDUC-CE e municipais)
    const studentDomains = [
      '@aluno.ce.gov.br',
      '@estudante.ce.gov.br'
    ];

    const isStudentDomain = studentDomains.some(domain => cleanEmail.endsWith(domain));
    const isStrictTeacherDomain = strictTeacherDomains.some(domain => cleanEmail.endsWith(domain));
    const { codigoEscola } = req.body;
    const PROFESSOR_SECRET_KEY = process.env.PROFESSOR_SECRET_KEY;

    let userRole = 'ESTUDANTE';

    if (isStudentDomain) {
      userRole = 'ESTUDANTE';
    } else if (isStrictTeacherDomain) {
      userRole = 'ADMIN';
    } else if (role === 'ADMIN') {
      // Se solicitou papel de Professor com e-mail comum, exige chave da escola configurada no ambiente ou autorização por admin autenticado
      const isAuthorizedByAdmin = req.user?.role === 'ADMIN';
      const isValidSchoolCode = Boolean(
        PROFESSOR_SECRET_KEY &&
        codigoEscola &&
        safeCompareStrings(String(codigoEscola).trim(), String(PROFESSOR_SECRET_KEY).trim())
      );

      if (isAuthorizedByAdmin || isValidSchoolCode) {
        userRole = 'ADMIN';
      } else {
        return res.status(403).json({
          error: 'Cadastro de Professor com e-mail pessoal não autorizado. É necessário informar uma Chave da Escola válida ou ter convite de um Administrador.'
        });
      }
    }

    const newUser = await userRepository.createUser({
      nome: cleanNome,
      email: cleanEmail,
      senhaHash,
      role: userRole,
      turma: cleanTurma
    });

    const token = jwt.sign({ id: newUser.id, email: newUser.email, role: newUser.role }, JWT_SECRET, { expiresIn: '7d' });

    invalidateStudentCache();

    logger.info(`Novo usuário cadastrado: ${newUser.email} (${newUser.role})`, { requestId: req.id, userId: newUser.id });

    res.status(201).json({
      message: 'Cadastro realizado com sucesso!',
      token,
      user: newUser
    });
  } catch (error) {
    logger.error('Erro interno ao realizar cadastro', { requestId: req.id, error });
    res.status(500).json({ error: 'Erro interno ao realizar cadastro.' });
  }
};

// GET /api/auth/me
export const getMe = (req, res) => {
  res.status(200).json({ user: req.user });
};

// GET /api/auth/estudantes (Admin list of students for assignment)
export const getEstudantes = async (req, res) => {
  try {
    const estudantes = await userRepository.findStudents();
    res.status(200).json({ estudantes });
  } catch (error) {
    logger.error('Erro ao buscar estudantes', { requestId: req.id, error });
    res.status(500).json({ error: 'Erro ao buscar estudantes.' });
  }
};

// POST /api/auth/estudantes (Admin create new student on the fly)
export const createEstudante = async (req, res) => {
  try {
    const { nome, email, turma, senha } = req.body;
    if (!nome || !email) {
      return res.status(400).json({ error: 'Nome e e-mail institucional são obrigatórios.' });
    }

    const cleanNome = nome.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanTurma = (turma || 'Geral').trim();
    const senhaFinal = senha || 'Agora@2026';
    const senhaHash = await bcrypt.hash(senhaFinal, 10);

    const newStudent = await userRepository.upsertStudent({
      nome: cleanNome,
      email: cleanEmail,
      turma: cleanTurma,
      senhaHash
    });

    invalidateStudentCache();

    logger.info(`Estudante provisionado pela coordenação: ${newStudent.email}`, { requestId: req.id, userId: newStudent.id });

    res.status(201).json({
      message: 'Estudante cadastrado com sucesso!',
      estudante: newStudent
    });
  } catch (error) {
    logger.error('Erro ao cadastrar estudante', { requestId: req.id, error });
    res.status(500).json({ error: 'Erro ao cadastrar estudante.' });
  }
};
