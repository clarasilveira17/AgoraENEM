import express from 'express';
import {
  login,
  register,
  getMe,
  alterarSenha,
  atualizarPerfil,
  esqueciSenha,
  redefinirSenha,
  desativarConta,
  getEstudantes,
  createEstudante,
  listarUsuariosAdmin,
  atualizarUsuarioAdmin,
  resetarSenhaUsuarioAdmin
} from '../controllers/authController.js';
import { authenticate, requireAdmin, requireTeacherOrAdmin } from '../middleware/authMiddleware.js';
import { loginLimiter } from '../middleware/rateLimitMiddleware.js';

const router = express.Router();

// Autenticação Pública
router.post('/login', loginLimiter, login);
router.post('/register', loginLimiter, register);
router.post('/esqueci-senha', loginLimiter, esqueciSenha);
router.post('/redefinir-senha', loginLimiter, redefinirSenha);

// Perfil do Usuário Autenticado
router.get('/me', authenticate, getMe);
router.patch('/alterar-senha', authenticate, alterarSenha);
router.patch('/perfil', authenticate, atualizarPerfil);
router.post('/desativar-conta', authenticate, desativarConta);

// Gestão de Estudantes (Professores e Admin)
router.get('/estudantes', authenticate, requireTeacherOrAdmin, getEstudantes);
router.post('/estudantes', authenticate, requireTeacherOrAdmin, createEstudante);

// Gestão Geral de Usuários (Apenas Admin)
router.get('/usuarios', authenticate, requireAdmin, listarUsuariosAdmin);
router.patch('/usuarios/:id', authenticate, requireAdmin, atualizarUsuarioAdmin);
router.post('/usuarios/:id/resetar-senha', authenticate, requireAdmin, resetarSenhaUsuarioAdmin);

export default router;
