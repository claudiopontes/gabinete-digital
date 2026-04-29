"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

// ─── Tipos ───────────────────────────────────────────────────────────────────

type ReceitaRow = {
  id_entidade: number;
  ano: number;
  mes: number;
  codigo: string;
  tipo_receita: string;
  previsao_inicial: number | string | null;
  previsao_atualizada: number | string | null;
  receita_realizada: number | string | null;
};


// ─── Constantes ──────────────────────────────────────────────────────────────


// ─── Helpers ─────────────────────────────────────────────────────────────────

function toNum(v: number | string | null | undefined): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const p = parseFloat(v.replace(",", "."));
    return Number.isFinite(p) ? p : 0;
  }
  return 0;
}

function fmtMoeda(v: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency", currency: "BRL",
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(v);
}

function fmtCompacto(v: number): string {
  const s = v < 0 ? "-" : "";
  const a = Math.abs(v);
  if (a >= 1e9) return `${s}R$ ${(a / 1e9).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} bi`;
  if (a >= 1e6) return `${s}R$ ${(a / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} mi`;
  if (a >= 1e3) return `${s}R$ ${(a / 1e3).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return fmtMoeda(v);
}

function fmtPct(v: number): string {
  return `${v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

function fmtNum(v: number): string {
  return v.toLocaleString("pt-BR");
}

function orcadaRow(row: ReceitaRow): number {
  return toNum(row.previsao_inicial) + toNum(row.previsao_atualizada);
}

function arrecadadaRow(row: ReceitaRow): number {
  return toNum(row.receita_realizada);
}



// ─── Componente principal ─────────────────────────────────────────────────────

export default function PainelReceitaPublicaClient() {
  "use no memo";

  const searchParams    = useSearchParams();
  const paramAnoInicio  = searchParams.get("anoInicio");
  const paramAnoFim     = searchParams.get("anoFim");
  const paramMunicipio  = searchParams.get("municipio");
  const paramEntidade   = searchParams.get("entidade");

  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [rows, setRows]       = useState<ReceitaRow[]>([]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    let active = true;

    async function load() {
      setLoading(true);
      setError(null);
      const client = supabase!;

      let anoInicio: number;
      let anoFim: number;

      if (paramAnoInicio && paramAnoFim) {
        anoInicio = Number(paramAnoInicio);
        anoFim    = Number(paramAnoFim);
      } else {
        // Fallback: descobre os 2 anos mais recentes
        const { data: anosData } = await client
          .from("receita_publica_categoria_mensal")
          .select("ano")
          .order("ano", { ascending: false })
          .limit(5000);

        const anos = [...new Set((anosData ?? []).map((r: { ano: number }) => Number(r.ano)))]
          .filter(Boolean)
          .sort((a, b) => b - a);

        if (anos.length === 0) {
          if (active) setLoading(false);
          return;
        }

        anoFim    = anos[0]!;
        anoInicio = anos.length >= 2 ? anos[1]! : anoFim;
      }

      // Resolve IDs de entidade para o município selecionado
      let municipioEntidadeIds: number[] | null = null;
      if (paramMunicipio && paramMunicipio !== "all") {
        const { data: dimData } = await client
          .from("dim_entidade")
          .select("id_entidade")
          .eq("id_ente", Number(paramMunicipio))
          .range(0, 9999);
        municipioEntidadeIds = (dimData ?? []).map((r: { id_entidade: number }) => r.id_entidade);
        if (municipioEntidadeIds.length === 0) {
          if (active) { setRows([]); setLoading(false); }
          return;
        }
      }

      const pageSize = 1000;
      let offset = 0;
      const allRows: ReceitaRow[] = [];

      while (true) {
        let query = client
          .from("receita_publica_categoria_mensal")
          .select("id_entidade,ano,mes,codigo,tipo_receita,previsao_inicial,previsao_atualizada,receita_realizada")
          .gte("ano", anoInicio)
          .lte("ano", anoFim)
          .order("ano", { ascending: true })
          .order("mes", { ascending: true })
          .range(offset, offset + pageSize - 1);

        if (municipioEntidadeIds) {
          query = query.in("id_entidade", municipioEntidadeIds);
        }
        if (paramEntidade && paramEntidade !== "all") {
          query = query.eq("id_entidade", Number(paramEntidade));
        }

        const { data, error: qErr } = await query;
        if (qErr) throw qErr;
        const batch = (data ?? []) as ReceitaRow[];
        allRows.push(...batch);
        if (batch.length < pageSize) break;
        offset += pageSize;
      }

      if (!active) return;
      setRows(allRows);
      setLoading(false);
    }

    load().catch((err) => {
      if (!active) return;
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    });

    return () => { active = false; };
  }, [paramAnoInicio, paramAnoFim, paramMunicipio, paramEntidade]);

  // ── KPIs ────────────────────────────────────────────────────────────────────
  const kpi = useMemo(() => {
    let orcada = 0, arrecadada = 0;
    const entidades = new Set<number>();

    rows.forEach((row) => {
      orcada     += orcadaRow(row);
      arrecadada += arrecadadaRow(row);
      entidades.add(row.id_entidade);
    });

    const saldo      = orcada - arrecadada;
    const realizacao = orcada !== 0 ? (arrecadada / orcada) * 100 : 0;
    return { orcada, arrecadada, saldo, realizacao, qtdEntidades: entidades.size };
  }, [rows]);

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
          <span className="text-sm">Carregando receitas públicas…</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="m-6 rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
        Falha ao carregar dados: {error}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="m-6 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
        Nenhum dado encontrado. Execute o ETL de receita pública.
      </div>
    );
  }

  return (
    <div className="min-h-screen space-y-5 bg-slate-50 p-4 pb-10 dark:bg-slate-900 sm:p-6">

      {/* ── Cards KPI ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
        <KpiCard
          titulo="Receita Prevista Atualizada"
          valor={fmtCompacto(kpi.orcada)}
          valorCompleto={fmtMoeda(kpi.orcada)}
          cor="slate"
        />
        <KpiCard
          titulo="Receita Arrecadada"
          valor={fmtCompacto(kpi.arrecadada)}
          valorCompleto={fmtMoeda(kpi.arrecadada)}
          cor="green"
        />
        <KpiCardDestaque
          titulo="% Realização"
          valor={fmtPct(kpi.realizacao)}
          descricao="Arrecadada / Orçada"
          realizacao={kpi.realizacao}
        />
        <KpiCard
          titulo="Saldo a Arrecadar"
          valor={fmtCompacto(kpi.saldo)}
          valorCompleto={fmtMoeda(kpi.saldo)}
          cor={kpi.saldo < 0 ? "red" : "amber"}
        />
        <KpiCard
          titulo="Entidades"
          valor={fmtNum(kpi.qtdEntidades)}
          valorCompleto={`${fmtNum(kpi.qtdEntidades)} entidades no período`}
          cor="blue"
        />
      </div>

    </div>
  );
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

type CorKpi = "slate" | "green" | "blue" | "amber" | "red";

const corBorda: Record<CorKpi, string> = {
  slate: "border-l-slate-400",
  green: "border-l-green-500",
  blue:  "border-l-blue-500",
  amber: "border-l-amber-500",
  red:   "border-l-red-500",
};

const corValor: Record<CorKpi, string> = {
  slate: "text-slate-800 dark:text-slate-100",
  green: "text-green-700 dark:text-green-400",
  blue:  "text-blue-700 dark:text-blue-400",
  amber: "text-amber-700 dark:text-amber-400",
  red:   "text-red-600 dark:text-red-400",
};

function KpiCard({
  titulo, valor, valorCompleto, cor,
}: {
  titulo: string; valor: string; valorCompleto: string; cor: CorKpi;
}) {
  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm dark:border-slate-700 dark:bg-slate-800 border-l-4 ${corBorda[cor]}`}
      title={valorCompleto}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
        {titulo}
      </p>
      <p className={`mt-2 text-xl font-bold leading-tight sm:text-2xl ${corValor[cor]}`}>
        {valor}
      </p>
    </div>
  );
}

function KpiCardDestaque({
  titulo, valor, descricao, realizacao,
}: {
  titulo: string; valor: string; descricao: string; realizacao: number;
}) {
  const bg =
    realizacao >= 90 ? "bg-green-600" :
    realizacao >= 70 ? "bg-blue-600"  :
    realizacao >= 50 ? "bg-amber-500" :
    "bg-red-500";

  return (
    <div className={`col-span-2 rounded-2xl p-5 shadow-sm xl:col-span-1 ${bg} text-white`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-white/80">{titulo}</p>
      <p className="mt-2 text-3xl font-bold leading-tight sm:text-4xl">{valor}</p>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/30">
        <div
          className="h-full rounded-full bg-white transition-all duration-700"
          style={{ width: `${Math.min(100, Math.max(0, realizacao))}%` }}
        />
      </div>
      <p className="mt-1.5 text-xs text-white/70">{descricao}</p>
    </div>
  );
}

