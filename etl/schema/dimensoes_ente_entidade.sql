-- =============================================================
-- Supabase schema - Dimensoes oficiais APC (ENTE / ENTIDADE)
-- Fontes:
--  - APC.dbo.ENTE
--  - APC.dbo.ENTIDADE
-- =============================================================

CREATE TABLE IF NOT EXISTS public.dim_ente (
  id_ente BIGINT PRIMARY KEY,
  codigo INTEGER NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  populacao INTEGER NULL,
  cod_ibgce INTEGER NULL,
  regiao TEXT NULL,
  cnpj_mascara TEXT NULL,
  cod_municipio TEXT NULL,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dim_ente_cod_municipio
  ON public.dim_ente (cod_municipio);

CREATE TABLE IF NOT EXISTS public.dim_entidade (
  id_entidade BIGINT PRIMARY KEY,
  ano_inicio INTEGER NULL,
  ano_referencia INTEGER NOT NULL,
  codigo INTEGER NULL,
  data_inativo TIMESTAMPTZ NULL,
  id_entidade_cjur INTEGER NOT NULL UNIQUE,
  id_entidade_executivo INTEGER NOT NULL,
  inativo SMALLINT NOT NULL,
  mes_inicio INTEGER NULL,
  mes_referencia INTEGER NOT NULL,
  nome TEXT NOT NULL,
  planejamento SMALLINT NOT NULL,
  rgf SMALLINT NOT NULL,
  rreo SMALLINT NOT NULL,
  id_classificacao_administrativa BIGINT NOT NULL,
  id_ente BIGINT NOT NULL,
  id_poder BIGINT NOT NULL,
  id_rgf INTEGER NOT NULL,
  id_fundeb INTEGER NULL,
  id_fms INTEGER NULL,
  id_esfera BIGINT NULL,
  rpps SMALLINT NOT NULL,
  apenas_pca SMALLINT NOT NULL,
  detalhe_poder SMALLINT NULL,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_dim_entidade_dim_ente
    FOREIGN KEY (id_ente) REFERENCES public.dim_ente(id_ente)
);

CREATE INDEX IF NOT EXISTS idx_dim_entidade_id_ente
  ON public.dim_entidade (id_ente);

CREATE INDEX IF NOT EXISTS idx_dim_entidade_codigo
  ON public.dim_entidade (codigo);

CREATE INDEX IF NOT EXISTS idx_dim_entidade_ativo
  ON public.dim_entidade (inativo);

ALTER TABLE public.dim_ente ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dim_entidade ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_dim_ente_anon" ON public.dim_ente;
CREATE POLICY "read_dim_ente_anon"
ON public.dim_ente
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "read_dim_entidade_anon" ON public.dim_entidade;
CREATE POLICY "read_dim_entidade_anon"
ON public.dim_entidade
FOR SELECT
TO anon, authenticated
USING (true);

