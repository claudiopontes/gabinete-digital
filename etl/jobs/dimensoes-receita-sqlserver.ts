/**
 * ETL - Dimensoes de Receita (SQL Server -> Supabase)
 * Fontes:
 *  - APC.referencias.NATUREZA_RECEITA_ORCAMENTARIA
 *  - APC.referencias.GRUPO_FONTE_RECURSO
 *  - APC.contacorrente.FONTE_DESTINACAO_RECURSO
 */

import "dotenv/config";
import { queryInDatabase } from "../connectors/sqlserver";
import { getSupabase } from "../connectors/supabase";

type NaturezaRow = {
  id_natureza: number;
  numero: number;
  data_criacao: string | null;
  codigo: string;
  descricao: string;
  nivel: number;
  nome: string;
  tipo: string | null;
  ativo: boolean | null;
  especificacao: string | null;
  destinacao_legal: string | null;
  norma: string | null;
  amparo: string | null;
  ano_inicio: number;
  ano_fim: number;
  id_natureza_pai: number | null;
  extensao: number | null;
  rubrica: string | null;
  atualizado_em: string;
};

type GrupoFonteRow = {
  numero: number;
  data_criacao: string | null;
  codigo: string;
  nome: string;
  atualizado_em: string;
};

type FonteDestinacaoRow = {
  id_fonte_destinacao_recurso: number;
  classificacao: string;
  codigo: string;
  data_criacao: string | null;
  descricao: string;
  nome: string | null;
  numero: number;
  numero_grupo_fonte_recurso: number;
  ativo: boolean;
  ano_inicio: number | null;
  ano_fim: number | null;
  codigo_stn: string | null;
  atualizado_em: string;
};

const MODULO = "dimensoes_receita_sqlserver";
const SQL_DATABASE = process.env.SQLSERVER_APC_DATABASE || "APC";
const SUPABASE_BATCH = toPositiveInt(Number(process.env.DIM_RECEITA_SUPABASE_BATCH || "500"), 500);

const TABELAS = {
  natureza: process.env.DIM_RECEITA_TB_NATUREZA || "aux_dim_natureza_receita_orcamentaria",
  grupoFonte: process.env.DIM_RECEITA_TB_GRUPO_FONTE || "aux_dim_grupo_fonte_recurso",
  fonteDest: process.env.DIM_RECEITA_TB_FONTE_DESTINACAO || "aux_dim_fonte_destinacao_recurso",
};

const supabase = getSupabase();

function toPositiveInt(input: number, fallback: number): number {
  if (!Number.isFinite(input) || input < 1) return fallback;
  return Math.trunc(input);
}

async function gravarLog(status: "sucesso" | "erro", registros: number, duracao: number, mensagem?: string) {
  await supabase.from("etl_log").insert({
    modulo: MODULO,
    status,
    mensagem: mensagem ?? null,
    registros,
    duracao_ms: duracao,
  });
}

async function validarTabelaDestino(tabela: string): Promise<void> {
  const { error } = await supabase.from(tabela).select("*").limit(1);
  if (error) {
    throw new Error(
      `Tabela destino indisponivel no Supabase (${tabela}). ` +
        "Aplique o schema em etl/schema/dimensoes_receita_sqlserver.sql. " +
        `Detalhe: ${error.message}`,
    );
  }
}

async function limparTabela(tabela: string, pk: string): Promise<void> {
  const { error } = await supabase.from(tabela).delete().neq(pk, -1);
  if (error) throw new Error(`Erro ao limpar ${tabela}: ${error.message}`);
}

async function inserirEmLotes<T extends Record<string, unknown>>(tabela: string, rows: T[]): Promise<void> {
  if (rows.length === 0) return;
  for (let i = 0; i < rows.length; i += SUPABASE_BATCH) {
    const lote = rows.slice(i, i + SUPABASE_BATCH);
    const { error } = await supabase.from(tabela).insert(lote);
    if (error) throw new Error(`Erro ao inserir em ${tabela}: ${error.message}`);
  }
}

async function carregarNatureza(): Promise<NaturezaRow[]> {
  const now = new Date().toISOString();
  const sql = `
SELECT
  ID_NATUREZA AS id_natureza,
  NUMERO AS numero,
  CONVERT(VARCHAR(33), DATA_CRIACAO, 127) AS data_criacao,
  CODIGO AS codigo,
  CAST(DESCRICAO AS VARCHAR(MAX)) AS descricao,
  NIVEL AS nivel,
  CAST(NOME AS VARCHAR(500)) AS nome,
  TIPO AS tipo,
  ATIVO AS ativo,
  CAST(ESPECIFICACAO AS VARCHAR(MAX)) AS especificacao,
  CAST(DESTINACAO_LEGAL AS VARCHAR(MAX)) AS destinacao_legal,
  CAST(NORMA AS VARCHAR(MAX)) AS norma,
  CAST(AMPARO AS VARCHAR(MAX)) AS amparo,
  ANO_INICIO AS ano_inicio,
  ANO_FIM AS ano_fim,
  ID_NATUREZA_PAI AS id_natureza_pai,
  EXTENSAO AS extensao,
  RUBRICA AS rubrica,
  '${now}' AS atualizado_em
FROM referencias.NATUREZA_RECEITA_ORCAMENTARIA
ORDER BY ID_NATUREZA;
`;
  return queryInDatabase<NaturezaRow>(SQL_DATABASE, sql);
}

async function carregarGrupoFonte(): Promise<GrupoFonteRow[]> {
  const now = new Date().toISOString();
  const sql = `
SELECT
  NUMERO AS numero,
  CONVERT(VARCHAR(33), DATA_CRIACAO, 127) AS data_criacao,
  CODIGO AS codigo,
  NOME AS nome,
  '${now}' AS atualizado_em
FROM referencias.GRUPO_FONTE_RECURSO
ORDER BY NUMERO;
`;
  return queryInDatabase<GrupoFonteRow>(SQL_DATABASE, sql);
}

async function carregarFonteDestinacao(): Promise<FonteDestinacaoRow[]> {
  const now = new Date().toISOString();
  const sql = `
SELECT
  ID_FONTE_DESTINACAO_RECURSO AS id_fonte_destinacao_recurso,
  CLASSIFICACAO AS classificacao,
  CODIGO AS codigo,
  CONVERT(VARCHAR(33), DATA_CRIACAO, 127) AS data_criacao,
  CAST(DESCRICAO AS VARCHAR(MAX)) AS descricao,
  CAST(NOME AS VARCHAR(1000)) AS nome,
  NUMERO AS numero,
  NUMERO_GRUPO_FONTE_RECURSO AS numero_grupo_fonte_recurso,
  ATIVO AS ativo,
  ANO_INICIO AS ano_inicio,
  ANO_FIM AS ano_fim,
  CODIGO_STN AS codigo_stn,
  '${now}' AS atualizado_em
FROM contacorrente.FONTE_DESTINACAO_RECURSO
ORDER BY ID_FONTE_DESTINACAO_RECURSO;
`;
  return queryInDatabase<FonteDestinacaoRow>(SQL_DATABASE, sql);
}

export async function executarCargaDimensoesReceitaSqlServer(): Promise<void> {
  const inicio = Date.now();
  console.log(`[${new Date().toISOString()}] Iniciando ETL: ${MODULO}`);
  console.log(`  -> Fonte SQL: ${SQL_DATABASE} (referencias + contacorrente)`);

  try {
    await Promise.all([
      validarTabelaDestino(TABELAS.natureza),
      validarTabelaDestino(TABELAS.grupoFonte),
      validarTabelaDestino(TABELAS.fonteDest),
    ]);

    const [naturezas, grupos, fontes] = await Promise.all([
      carregarNatureza(),
      carregarGrupoFonte(),
      carregarFonteDestinacao(),
    ]);

    console.log(
      `  -> Registros fonte: natureza=${naturezas.length} | grupo_fonte=${grupos.length} | fonte_dest=${fontes.length}`,
    );

    await Promise.all([
      limparTabela(TABELAS.natureza, "id_natureza"),
      limparTabela(TABELAS.grupoFonte, "numero"),
      limparTabela(TABELAS.fonteDest, "id_fonte_destinacao_recurso"),
    ]);

    await inserirEmLotes(TABELAS.natureza, naturezas);
    await inserirEmLotes(TABELAS.grupoFonte, grupos);
    await inserirEmLotes(TABELAS.fonteDest, fontes);

    const duracao = Date.now() - inicio;
    const total = naturezas.length + grupos.length + fontes.length;
    console.log(`  OK - ETL concluido em ${duracao}ms (${total} registros)`);
    await gravarLog("sucesso", total, duracao);
  } catch (error) {
    const duracao = Date.now() - inicio;
    const mensagem = error instanceof Error ? error.message : String(error);
    console.error(`  ERRO - ${mensagem}`);
    await gravarLog("erro", 0, duracao, mensagem);
    throw error;
  }
}

if (require.main === module) {
  executarCargaDimensoesReceitaSqlServer().catch(() => process.exit(1));
}

