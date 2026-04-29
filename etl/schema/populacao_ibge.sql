-- =============================================================
-- Supabase schema - População Municipal IBGE
-- Fonte: IBGE SIDRA (Estimativas + Censo)
-- Executar antes da primeira carga do ETL populacao-ibge
-- =============================================================

-- Histórico de população por município × ano
CREATE TABLE IF NOT EXISTS public.aux_populacao_ibge (
  cod_ibge     INTEGER      NOT NULL,
  ano          INTEGER      NOT NULL,
  populacao    BIGINT       NOT NULL,
  fonte        TEXT         NOT NULL DEFAULT 'IBGE',
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (cod_ibge, ano)
);

CREATE INDEX IF NOT EXISTS idx_aux_populacao_ibge_ano
  ON public.aux_populacao_ibge (ano DESC);

-- View: retorna o dado mais recente disponível para cada município
-- (ano <= ano corrente), implementando o fallback automático
CREATE OR REPLACE VIEW public.vw_populacao_ibge_vigente AS
SELECT DISTINCT ON (cod_ibge)
  cod_ibge,
  ano          AS ano_referencia,
  populacao,
  fonte
FROM public.aux_populacao_ibge
WHERE ano <= EXTRACT(YEAR FROM NOW())::INTEGER
ORDER BY cod_ibge, ano DESC;

ALTER TABLE public.aux_populacao_ibge ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_aux_populacao_ibge_anon" ON public.aux_populacao_ibge;
CREATE POLICY "read_aux_populacao_ibge_anon"
ON public.aux_populacao_ibge
FOR SELECT
TO anon, authenticated
USING (true);
