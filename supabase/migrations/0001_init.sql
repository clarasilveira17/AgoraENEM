-- ==============================================================================
-- MIGRAÇÃO DE BANCO DE DADOS: ÁGORA ENEM (SUPABASE / POSTGRESQL 15+)
-- Migração 0001_init: Esquema Completo & Compatibilidade com Banco Existente
-- ==============================================================================

-- 1. EXTENSÕES NECESSÁRIAS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. TABELA DE USUÁRIOS (users)
CREATE TABLE IF NOT EXISTS public.users (
  id BIGSERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  senha_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'ESTUDANTE' CHECK (role IN ('ESTUDANTE', 'PROFESSOR', 'ADMIN')),
  turma TEXT,
  avatar_url TEXT,
  reset_token_hash TEXT,
  reset_token_expires TIMESTAMPTZ,
  is_ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Garantir colunas novas caso a tabela 'users' já existisse com esquema legado
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS reset_token_hash TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_ativo BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS turma TEXT;

-- 3. TABELA DE REDAÇÕES (redacoes)
CREATE TABLE IF NOT EXISTS public.redacoes (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
  nome_aluno TEXT,
  turma_aluno TEXT,
  nome_detectado INTEGER DEFAULT 0,
  data_captura TIMESTAMPTZ DEFAULT NOW(),
  tipo_input TEXT DEFAULT 'imagem' CHECK (tipo_input IN ('imagem', 'texto')),
  imagem_url TEXT,
  imagens_urls JSONB DEFAULT '[]'::jsonb,
  imagem_base64 TEXT,
  texto_digitado TEXT,
  is_synced INTEGER DEFAULT 1,
  extracted_data JSONB DEFAULT '{}'::jsonb,
  nota_final INTEGER DEFAULT 0,
  status_validacao TEXT NOT NULL DEFAULT 'PENDENTE_VALIDACAO',
  validado_por BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
  data_validacao TIMESTAMPTZ,
  corretor_id BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
  status_alocacao TEXT NOT NULL DEFAULT 'DISPONIVEL',
  alocado_em TIMESTAMPTZ,
  versao_concorrencia INTEGER NOT NULL DEFAULT 1
);

-- Garantir colunas novas caso a tabela 'redacoes' já existisse com esquema legado
ALTER TABLE public.redacoes ADD COLUMN IF NOT EXISTS imagem_url TEXT;
ALTER TABLE public.redacoes ADD COLUMN IF NOT EXISTS imagens_urls JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.redacoes ADD COLUMN IF NOT EXISTS imagem_base64 TEXT;
ALTER TABLE public.redacoes ADD COLUMN IF NOT EXISTS corretor_id BIGINT REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.redacoes ADD COLUMN IF NOT EXISTS status_alocacao TEXT NOT NULL DEFAULT 'DISPONIVEL';
ALTER TABLE public.redacoes ADD COLUMN IF NOT EXISTS alocado_em TIMESTAMPTZ;
ALTER TABLE public.redacoes ADD COLUMN IF NOT EXISTS versao_concorrencia INTEGER NOT NULL DEFAULT 1;

-- Validações de constraints caso ainda não existam
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'redacoes_status_alocacao_check'
  ) THEN 
    ALTER TABLE public.redacoes 
      ADD CONSTRAINT redacoes_status_alocacao_check 
      CHECK (status_alocacao IN ('DISPONIVEL', 'EM_CORRECAO', 'CONCLUIDA'));
  END IF;
END $$;

-- 4. TABELA DE JOBS ASSÍNCRONOS (jobs)
CREATE TABLE IF NOT EXISTS public.jobs (
  id BIGSERIAL PRIMARY KEY,
  tipo TEXT NOT NULL DEFAULT 'CORRECAO_IA',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'PROCESSANDO', 'CONCLUIDO', 'ERRO')),
  tentativas INTEGER NOT NULL DEFAULT 0,
  resultado JSONB,
  erro TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TABELA DE AUDITORIA (audit_log)
CREATE TABLE IF NOT EXISTS public.audit_log (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
  acao TEXT NOT NULL,
  entidade TEXT NOT NULL,
  entidade_id BIGINT,
  metadata JSONB DEFAULT '{}'::jsonb,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- 6. ÍNDICES DE PERFORMANCE E ESCALABILIDADE (800+ REGISTROS)
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_role_ativo ON public.users(role, is_ativo);

CREATE INDEX IF NOT EXISTS idx_redacoes_user_id ON public.redacoes(user_id);
CREATE INDEX IF NOT EXISTS idx_redacoes_turma_aluno ON public.redacoes(turma_aluno);
CREATE INDEX IF NOT EXISTS idx_redacoes_data_captura ON public.redacoes(data_captura DESC);
CREATE INDEX IF NOT EXISTS idx_redacoes_status_validacao ON public.redacoes(status_validacao);
CREATE INDEX IF NOT EXISTS idx_redacoes_nota_final ON public.redacoes(nota_final DESC);
CREATE INDEX IF NOT EXISTS idx_redacoes_corretor_status ON public.redacoes(corretor_id, status_alocacao);
CREATE INDEX IF NOT EXISTS idx_redacoes_fila_disponivel ON public.redacoes(status_alocacao, data_captura ASC) WHERE status_alocacao = 'DISPONIVEL';

CREATE INDEX IF NOT EXISTS idx_jobs_status_pendente ON public.jobs(status, criado_em ASC) WHERE status = 'PENDENTE';
CREATE INDEX IF NOT EXISTS idx_audit_log_user_criado ON public.audit_log(user_id, criado_em DESC);

-- 7. ATIVAÇÃO DE ROW LEVEL SECURITY (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- 8. POLÍTICAS RLS (Garante segurança e isolamento por papel)
-- No Supabase, o backend com Service Role Key possui BYPASS RLS automático.
-- Políticas para acesso autenticado:

DROP POLICY IF EXISTS "Usuarios podem ver seu perfil" ON public.users;
CREATE POLICY "Usuarios podem ver seu perfil" ON public.users
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Leitura de redacoes" ON public.redacoes;
CREATE POLICY "Leitura de redacoes" ON public.redacoes
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Acesso restrito jobs" ON public.jobs;
CREATE POLICY "Acesso restrito jobs" ON public.jobs
  FOR ALL
  USING (true);

DROP POLICY IF EXISTS "Acesso restrito audit" ON public.audit_log;
CREATE POLICY "Acesso restrito audit" ON public.audit_log
  FOR ALL
  USING (true);
