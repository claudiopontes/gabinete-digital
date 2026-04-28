-- =============================================================
-- Supabase schema - Dimensoes de Receita (SQL Server)
-- Fontes:
--  - APC.referencias.NATUREZA_RECEITA_ORCAMENTARIA
--  - APC.referencias.GRUPO_FONTE_RECURSO
--  - APC.contacorrente.FONTE_DESTINACAO_RECURSO
-- =============================================================

CREATE TABLE IF NOT EXISTS public.aux_dim_natureza_receita_orcamentaria (
  id_natureza BIGINT PRIMARY KEY,
  numero BIGINT NOT NULL,
  data_criacao TIMESTAMPTZ NULL,
  codigo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  nivel INTEGER NOT NULL,
  nome TEXT NOT NULL,
  tipo TEXT NULL,
  ativo BOOLEAN NULL,
  especificacao TEXT NULL,
  destinacao_legal TEXT NULL,
  norma TEXT NULL,
  amparo TEXT NULL,
  ano_inicio INTEGER NOT NULL,
  ano_fim INTEGER NOT NULL,
  id_natureza_pai BIGINT NULL,
  extensao INTEGER NULL,
  rubrica TEXT NULL,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_aux_dim_natureza_numero_ano_inicio
  ON public.aux_dim_natureza_receita_orcamentaria (numero, ano_inicio);

CREATE INDEX IF NOT EXISTS idx_aux_dim_natureza_codigo
  ON public.aux_dim_natureza_receita_orcamentaria (codigo);

CREATE INDEX IF NOT EXISTS idx_aux_dim_natureza_tipo
  ON public.aux_dim_natureza_receita_orcamentaria (tipo);

CREATE INDEX IF NOT EXISTS idx_aux_dim_natureza_pai
  ON public.aux_dim_natureza_receita_orcamentaria (id_natureza_pai);

CREATE TABLE IF NOT EXISTS public.aux_dim_grupo_fonte_recurso (
  numero INTEGER PRIMARY KEY,
  data_criacao TIMESTAMPTZ NULL,
  codigo TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.aux_dim_fonte_destinacao_recurso (
  id_fonte_destinacao_recurso BIGINT PRIMARY KEY,
  classificacao TEXT NOT NULL,
  codigo TEXT NOT NULL,
  data_criacao TIMESTAMPTZ NULL,
  descricao TEXT NOT NULL,
  nome TEXT NULL,
  numero INTEGER NOT NULL,
  numero_grupo_fonte_recurso INTEGER NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  ano_inicio SMALLINT NULL,
  ano_fim SMALLINT NULL,
  codigo_stn TEXT NULL,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_aux_dim_fdr_numero_grupo_ano
  ON public.aux_dim_fonte_destinacao_recurso (numero, numero_grupo_fonte_recurso, ano_inicio, ano_fim);

CREATE INDEX IF NOT EXISTS idx_aux_dim_fdr_codigo
  ON public.aux_dim_fonte_destinacao_recurso (codigo);

CREATE INDEX IF NOT EXISTS idx_aux_dim_fdr_grupo
  ON public.aux_dim_fonte_destinacao_recurso (numero_grupo_fonte_recurso);

CREATE INDEX IF NOT EXISTS idx_aux_dim_fdr_ativo_codigo
  ON public.aux_dim_fonte_destinacao_recurso (ativo DESC, codigo ASC);

ALTER TABLE public.aux_dim_natureza_receita_orcamentaria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aux_dim_grupo_fonte_recurso ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aux_dim_fonte_destinacao_recurso ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_aux_dim_natureza_receita_orcamentaria_anon"
  ON public.aux_dim_natureza_receita_orcamentaria;
CREATE POLICY "read_aux_dim_natureza_receita_orcamentaria_anon"
ON public.aux_dim_natureza_receita_orcamentaria
FOR SELECT TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "read_aux_dim_grupo_fonte_recurso_anon"
  ON public.aux_dim_grupo_fonte_recurso;
CREATE POLICY "read_aux_dim_grupo_fonte_recurso_anon"
ON public.aux_dim_grupo_fonte_recurso
FOR SELECT TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "read_aux_dim_fonte_destinacao_recurso_anon"
  ON public.aux_dim_fonte_destinacao_recurso;
CREATE POLICY "read_aux_dim_fonte_destinacao_recurso_anon"
ON public.aux_dim_fonte_destinacao_recurso
FOR SELECT TO anon, authenticated
USING (true);

