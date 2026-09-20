import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../config/db.js';
import { supabase, isSupabaseConfigured } from '../config/supabaseClient.js';
import { JWT_SECRET } from '../middleware/authMiddleware.js';

// POST /api/auth/login
export const login = async (req, res) => {
  try {
    const { email, senha } = req.body || {};

    if (!email || !senha) {
      return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
    }

    let user = null;
    const cleanEmail = String(email).trim().toLowerCase();

    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .ilike('email', cleanEmail)
        .maybeSingle();

      if (error) {
        console.error('[Supabase Auth Login Error]:', error.message);
      }
      user = data;
    }

    if (!user && db) {
      try {
        user = db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)').get(cleanEmail);
      } catch (dbErr) {
        console.warn('[DB Auth Login Fallback Warning]:', dbErr.message);
      }
    }

    if (!user) {
      return res.status(401).json({ error: 'Credenciais inválidas. Verifique seu e-mail e senha.' });
    }

    if (!user.senha_hash) {
      return res.status(401).json({ error: 'Usuário sem senha cadastrada. Por favor, redefina sua senha com a coordenação.' });
    }

    const isValidPassword = bcrypt.compareSync(String(senha), user.senha_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Credenciais inválidas. Verifique seu e-mail e senha.' });
    }

    const tokenPayload = {
      id: user.id,
      email: user.email,
      role: user.role
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '7d' });

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
    console.error('[Auth Error Login]:', error);
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

    if (isSupabaseConfigured) {
      const { data: existing } = await supabase
        .from('users')
        .select('id')
        .ilike('email', cleanEmail)
        .maybeSingle();

      if (existing) {
        return res.status(400).json({ error: 'Este e-mail já está cadastrado no sistema.' });
      }
    } else if (db) {
      try {
        const existingUser = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(cleanEmail);
        if (existingUser) {
          return res.status(400).json({ error: 'Este e-mail já está cadastrado no sistema.' });
        }
      } catch (dbErr) {
        console.warn('[DB Register Check Warning]:', dbErr.message);
      }
    }

    const senhaHash = bcrypt.hashSync(senha, 10);
    
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
      const isValidSchoolCode = Boolean(PROFESSOR_SECRET_KEY && codigoEscola && codigoEscola.trim() === PROFESSOR_SECRET_KEY);

      if (isAuthorizedByAdmin || isValidSchoolCode) {
        userRole = 'ADMIN';
      } else {
        return res.status(403).json({
          error: 'Cadastro de Professor com e-mail pessoal não autorizado. É necessário informar uma Chave da Escola válida ou ter convite de um Administrador.'
        });
      }
    }

    let newUser = null;

    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('users')
        .insert({
          nome: cleanNome,
          email: cleanEmail,
          senha_hash: senhaHash,
          role: userRole,
          turma: cleanTurma
        })
        .select('id, nome, email, role, turma')
        .single();

      if (error) {
        throw new Error(`Erro no Supabase Register: ${error.message}`);
      }
      newUser = data;
    } else if (db) {
      try {
        const result = db.prepare(`
          INSERT INTO users (nome, email, senha_hash, role, turma)
          VALUES (?, ?, ?, ?, ?)
        `).run(cleanNome, cleanEmail, senhaHash, userRole, cleanTurma);

        newUser = {
          id: result.lastInsertRowid,
          nome: cleanNome,
          email: cleanEmail,
          role: userRole,
          turma: cleanTurma
        };
      } catch (dbErr) {
        throw new Error(`Erro no SQLite Register: ${dbErr.message}`);
      }
    }

    const token = jwt.sign({ id: newUser.id, email: newUser.email, role: newUser.role }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      message: 'Cadastro realizado com sucesso!',
      token,
      user: newUser
    });
  } catch (error) {
    console.error('[Auth Error Register]:', error);
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
    let estudantes = [];

    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('users')
        .select('id, nome, email, turma, created_at')
        .eq('role', 'ESTUDANTE')
        .order('nome', { ascending: true });

      if (error) {
        console.error('[Supabase GetEstudantes Error]:', error.message);
      } else {
        estudantes = data || [];
      }
    }

    if (estudantes.length === 0 && db) {
      try {
        estudantes = db.prepare(`
          SELECT id, nome, email, turma, created_at 
          FROM users 
          WHERE role = 'ESTUDANTE' 
          ORDER BY nome ASC
        `).all() || [];
      } catch (dbErr) {
        console.warn('[DB GetEstudantes Warning]:', dbErr.message);
      }
    }

    res.status(200).json({ estudantes });
  } catch (error) {
    console.error('[Auth Error GetEstudantes]:', error);
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
    const senhaHash = bcrypt.hashSync(senhaFinal, 10);

    let newStudent = null;

    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('users')
        .upsert({
          nome: cleanNome,
          email: cleanEmail,
          turma: cleanTurma,
          role: 'ESTUDANTE',
          senha_hash: senhaHash
        }, { onConflict: 'email' })
        .select('id, nome, email, turma, role')
        .single();

      if (error) {
        console.error('[Supabase CreateEstudante Error]:', error.message);
        return res.status(400).json({ error: 'Erro ao cadastrar estudante no Supabase: ' + error.message });
      }
      newStudent = data;
    } else if (db) {
      const info = db.prepare(`
        INSERT INTO users (nome, email, senha_hash, role, turma)
        VALUES (?, ?, ?, 'ESTUDANTE', ?)
      `).run(cleanNome, cleanEmail, senhaHash, cleanTurma);
      newStudent = { id: info.lastInsertRowid, nome: cleanNome, email: cleanEmail, turma: cleanTurma, role: 'ESTUDANTE' };
    }

    res.status(201).json({
      message: 'Estudante cadastrado com sucesso!',
      estudante: newStudent
    });
  } catch (error) {
    console.error('[Auth CreateEstudante Error]:', error);
    res.status(500).json({ error: 'Erro ao cadastrar estudante.' });
  }
};
