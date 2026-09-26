-- =======================================================
-- ESQUEMA DO BANCO DE DADOS SUPABASE (PROJETO ÁGORA ENEM)
-- =======================================================

-- 1. Criação da Tabela de Usuários (Professores e Estudantes)
CREATE TABLE IF NOT EXISTS public.users (
  id BIGSERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  senha_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'ESTUDANTE',
  turma TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Criação da Tabela de Redações
CREATE TABLE IF NOT EXISTS public.redacoes (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
  nome_aluno TEXT,
  turma_aluno TEXT,
  nome_detectado INTEGER DEFAULT 0,
  data_captura TIMESTAMPTZ DEFAULT NOW(),
  tipo_input TEXT DEFAULT 'imagem',
  imagem_base64 TEXT,
  texto_digitado TEXT,
  is_synced INTEGER DEFAULT 1,
  extracted_data JSONB DEFAULT '{}'::jsonb,
  nota_final INTEGER,
  status_validacao TEXT NOT NULL DEFAULT 'VALIDADA',
  validado_por BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
  data_validacao TIMESTAMPTZ
);

-- 3. Índices de Performance para Consultas Rápidas
CREATE INDEX IF NOT EXISTS idx_redacoes_user_id ON public.redacoes(user_id);
CREATE INDEX IF NOT EXISTS idx_redacoes_status_validacao ON public.redacoes(status_validacao);
CREATE INDEX IF NOT EXISTS idx_redacoes_nota_final ON public.redacoes(nota_final DESC);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

-- 4. Desabilitar RLS para Acesso Direto via Chaves da Aplicação
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.redacoes DISABLE ROW LEVEL SECURITY;
