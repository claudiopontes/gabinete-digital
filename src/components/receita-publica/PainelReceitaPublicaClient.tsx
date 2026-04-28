"use client";

import { useEffect, useMemo, useState, type MouseEvent, type ReactNode } from "react";
import dynamic from "next/dynamic";
import type { ApexOptions } from "apexcharts";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import ReceitaPublicaHeaderFilters from "@/components/receita-publica/ReceitaPublicaHeaderFilters";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

type NumericValue = number | string | null;

type ReceitaPublicaRow = {
  id_remessa: number | string | null;
  id_entidade_cjur: number | string | null;
  id_entidade: number | string | null;
  ano: number | string | null;
  mes: number | string | null;
  id_natureza_receita_orcamentaria: number | string | null;
  id_catreceita: number | string | null;
  codigo: string | null;
  natureza_codigo: string | null;
  natureza_nome: string | null;
  natureza_descricao: string | null;
  natureza_nivel: number | string | null;
  natureza_tipo: string | null;
  previsao_inicial: NumericValue;
  previsao_atualizada: NumericValue;
  receita_realizada: NumericValue;
  numero_fonte_recurso: number | string | null;
  fonte_classificacao: string | null;
  fonte_nome: string | null;
  codigo_conta_contabil: string | null;
  tipo_receita: string | null;
};

type ChartKey =
  | "line"
  | "categoriaBar"
  | "fonteBar"
  | "tipoDonut"
  | "paretoFonte"
  | "contaBar";

type PeriodoMetadata = {
  ano: number | string | null;
  mes: number | string | null;
};


function toNumber(value: NumericValue): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const normalized = value.replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function toStringValue(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  return String(value);
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatCompactMoney(value: number): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);

  if (abs >= 1_000_000_000) {
    return `${sign}R$ ${new Intl.NumberFormat("pt-BR", {
      maximumFractionDigits: 2,
    }).format(abs / 1_000_000_000)} bi`;
  }

  if (abs >= 1_000_000) {
    return `${sign}R$ ${new Intl.NumberFormat("pt-BR", {
      maximumFractionDigits: 2,
    }).format(abs / 1_000_000)} mi`;
  }

  if (abs >= 1_000) {
    return `${sign}R$ ${new Intl.NumberFormat("pt-BR", {
      maximumFractionDigits: 2,
    }).format(abs / 1_000)} mil`;
  }

  return formatMoney(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number): string {
  return `${new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value)}%`;
}

function formatDeltaPercent(value: number): string {
  const signal = value > 0 ? "+" : "";
  return `${signal}${formatPercent(value)}`;
}

function monthKey(row: ReceitaPublicaRow): string {
  const ano = Number(row.ano ?? 0);
  const mes = Number(row.mes ?? 0);
  return `${ano}-${String(mes).padStart(2, "0")}`;
}

function monthLabelFromKey(key: string): string {
  const [ano, mes] = key.split("-");
  if (!ano || !mes) return key;
  return `${mes}/${ano}`;
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;

  if (typeof error === "object" && error !== null && "message" in error) {
    const msg = (error as { message?: unknown }).message;
    return typeof msg === "string" ? msg : String(msg);
  }

  return String(error);
}

function tipoReceitaLabel(row: ReceitaPublicaRow): string {
  const value = toStringValue(row.tipo_receita).trim().toUpperCase();

  if (!value) return "NORMAL";
  if (value.includes("DEDU")) return "DEDUÇÃO";

  return value;
}

function codigoReceita(row: ReceitaPublicaRow): string {
  return toStringValue(row.codigo || row.id_catreceita).trim();
}

function categoriaEconomica(row: ReceitaPublicaRow): string {
  const tipo = tipoReceitaLabel(row);
  const codigo = codigoReceita(row);

  if (tipo === "DEDUÇÃO") return "Dedução da Receita";

  const primeiroDigito = codigo.charAt(0);

  switch (primeiroDigito) {
    case "1":
      return "Receitas Correntes";
    case "2":
      return "Receitas de Capital";
    case "7":
      return "Receitas Correntes Intraorçamentárias";
    case "8":
      return "Receitas de Capital Intraorçamentárias";
    case "9":
      return "Dedução da Receita";
    default:
      return codigo ? `Categoria ${codigo}` : "Sem categoria";
  }
}

function fonteLabel(row: ReceitaPublicaRow): string {
  const nome = toStringValue(row.fonte_nome).trim();
  const classificacao = toStringValue(row.fonte_classificacao).trim();
  const numero = toStringValue(row.numero_fonte_recurso).trim();

  if (nome) return nome;
  if (classificacao && numero) return `${numero} - ${classificacao}`;
  if (classificacao) return classificacao;
  if (numero) return `Fonte ${numero}`;

  return "Sem fonte informada";
}

function entidadeValue(row: ReceitaPublicaRow): string {
  return toStringValue(row.id_entidade).trim() || "sem-entidade";
}

function contaContabilLabel(row: ReceitaPublicaRow): string {
  return toStringValue(row.codigo_conta_contabil).trim() || "Sem conta contábil";
}

function calcDelta(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / previous) * 100;
}

function groupSum<T>(
  rows: T[],
  getKey: (row: T) => string,
  getValue: (row: T) => number,
): Array<[string, number]> {
  const map = new Map<string, number>();

  rows.forEach((row) => {
    const key = getKey(row);
    map.set(key, (map.get(key) ?? 0) + getValue(row));
  });

  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

function truncateLabel(value: string, max = 28): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}...`;
}

export default function PainelReceitaPublicaClient() {
  "use no memo";

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ReceitaPublicaRow[]>([]);
  const [periodos, setPeriodos] = useState<PeriodoMetadata[]>([]);
  const [highlightedChart, setHighlightedChart] = useState<ChartKey | null>(null);

  const selectedAnoInicio = searchParams.get("anoInicio") ?? "";
  const selectedAnoFim = searchParams.get("anoFim") ?? "";
  const selectedMes = searchParams.get("mes") ?? "all";
  const selectedCategoria = searchParams.get("categoria") ?? "all";
  const selectedFonte = searchParams.get("fonte") ?? "all";
  const selectedTipo = searchParams.get("tipo") ?? "all";
  const selectedEntidade = searchParams.get("entidade") ?? "all";

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);

      if (!isSupabaseConfigured || !supabase) {
        setError(
          "Supabase não configurado. Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no arquivo .env.local.",
        );
        setLoading(false);
        return;
      }

      try {
        const { data: periodoData, error: periodoError } = await supabase
          .from("vw_receita_publica_kpis")
          .select("ano, mes")
          .order("ano", { ascending: true })
          .order("mes", { ascending: true });

        if (periodoError) throw periodoError;

        const periodoRows = ((periodoData ?? []) as unknown) as PeriodoMetadata[];
        const anos = [...new Set(periodoRows.map((row) => Number(row.ano)).filter(Boolean))].sort(
          (a, b) => a - b,
        );
        const latestYear = anos.at(-1);

        if (!latestYear) {
          if (!active) return;
          setPeriodos([]);
          setRows([]);
          setLoading(false);
          return;
        }

        const queryAnoInicio = selectedAnoInicio
          ? Number(selectedAnoInicio)
          : selectedAnoFim
            ? Number(selectedAnoFim)
            : latestYear - 1;
        const queryAnoFim = selectedAnoFim
          ? Number(selectedAnoFim)
          : selectedAnoInicio
            ? latestYear
            : latestYear;

        const pageSize = 1000;
        let offset = 0;
        const out: ReceitaPublicaRow[] = [];

        while (true) {
          let query = supabase
            .from("receita_publica_categoria_mensal")
            .select(
              [
                "id_remessa",
                "id_entidade_cjur",
                "id_entidade",
                "ano",
                "mes",
                "id_natureza_receita_orcamentaria",
                "id_catreceita",
                "codigo",
                "natureza_codigo",
                "natureza_nome",
                "natureza_descricao",
                "natureza_nivel",
                "natureza_tipo",
                "previsao_inicial",
                "previsao_atualizada",
                "receita_realizada",
                "numero_fonte_recurso",
                "fonte_classificacao",
                "fonte_nome",
                "codigo_conta_contabil",
                "tipo_receita",
              ].join(", "),
            )
            .gte("ano", queryAnoInicio)
            .lte("ano", queryAnoFim)
            .order("ano", { ascending: true })
            .order("mes", { ascending: true })
            .range(offset, offset + pageSize - 1);

          if (selectedMes !== "all") query = query.eq("mes", Number(selectedMes));
          if (selectedTipo !== "all") query = query.eq("tipo_receita", selectedTipo);
          if (selectedEntidade !== "all") query = query.eq("id_entidade", selectedEntidade);

          const { data, error } = await query;

          if (error) throw error;

          const batch = ((data ?? []) as unknown) as ReceitaPublicaRow[];
          out.push(...batch);

          if (batch.length < pageSize) break;
          offset += pageSize;
        }

        if (!active) return;

        setPeriodos(periodoRows);
        setRows(out);
        setLoading(false);
      } catch (err) {
        if (!active) return;

        setError(extractErrorMessage(err) || "Falha ao carregar dados da receita pública.");
        setLoading(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [selectedAnoInicio, selectedAnoFim, selectedMes, selectedTipo, selectedEntidade]);

  const availableYears = useMemo(() => {
    const source = periodos.length > 0 ? periodos : rows;
    return [...new Set(source.map((row) => Number(row.ano)).filter(Boolean))].sort(
      (a, b) => a - b,
    );
  }, [periodos, rows]);

  const defaultAnoInicio = useMemo(() => {
    const latest = availableYears.at(-1);
    return latest ? String(latest - 1) : "";
  }, [availableYears]);

  const defaultAnoFim = useMemo(() => {
    const latest = availableYears.at(-1);
    return latest ? String(latest) : "";
  }, [availableYears]);

  const displayedAnoInicio = selectedAnoInicio || defaultAnoInicio;
  const displayedAnoFim = selectedAnoFim || defaultAnoFim;

  const filteredRows = useMemo(() => {
    let result = rows;

    if (displayedAnoInicio) {
      const inicio = Number(displayedAnoInicio);
      result = result.filter((row) => Number(row.ano) >= inicio);
    }

    if (displayedAnoFim) {
      const fim = Number(displayedAnoFim);
      result = result.filter((row) => Number(row.ano) <= fim);
    }

    if (selectedMes !== "all") {
      result = result.filter((row) => String(Number(row.mes)) === selectedMes);
    }

    if (selectedCategoria !== "all") {
      result = result.filter((row) => categoriaEconomica(row) === selectedCategoria);
    }

    if (selectedFonte !== "all") {
      result = result.filter((row) => fonteLabel(row) === selectedFonte);
    }

    if (selectedTipo !== "all") {
      result = result.filter((row) => tipoReceitaLabel(row) === selectedTipo);
    }

    if (selectedEntidade !== "all") {
      result = result.filter((row) => entidadeValue(row) === selectedEntidade);
    }

    return result;
  }, [
    rows,
    displayedAnoInicio,
    displayedAnoFim,
    selectedMes,
    selectedCategoria,
    selectedFonte,
    selectedTipo,
    selectedEntidade,
  ]);

  const kpi = useMemo(() => {
    const previsaoInicial = filteredRows.reduce(
      (acc, row) => acc + toNumber(row.previsao_inicial),
      0,
    );

    const previsaoAtualizada = filteredRows.reduce(
      (acc, row) => acc + toNumber(row.previsao_atualizada),
      0,
    );

    const receitaRealizada = filteredRows.reduce(
      (acc, row) => acc + toNumber(row.receita_realizada),
      0,
    );

    const receitaNormal = filteredRows
      .filter((row) => tipoReceitaLabel(row) !== "DEDUÇÃO")
      .reduce((acc, row) => acc + toNumber(row.receita_realizada), 0);

    const deducoes = filteredRows
      .filter((row) => tipoReceitaLabel(row) === "DEDUÇÃO")
      .reduce((acc, row) => acc + toNumber(row.receita_realizada), 0);

    const execucao =
      previsaoAtualizada !== 0 ? (receitaRealizada / previsaoAtualizada) * 100 : 0;

    return {
      previsaoInicial,
      previsaoAtualizada,
      receitaRealizada,
      receitaNormal,
      deducoes,
      execucao,
      qtdRegistros: filteredRows.length,
      qtdRemessas: new Set(filteredRows.map((row) => toStringValue(row.id_remessa)).filter(Boolean))
        .size,
    };
  }, [filteredRows]);

  const kpiVariation = useMemo(() => {
    const grouped = new Map<string, { previsao: number; realizada: number }>();

    filteredRows.forEach((row) => {
      const key = monthKey(row);
      const current = grouped.get(key) ?? { previsao: 0, realizada: 0 };

      current.previsao += toNumber(row.previsao_atualizada);
      current.realizada += toNumber(row.receita_realizada);

      grouped.set(key, current);
    });

    const keys = [...grouped.keys()].sort();

    if (keys.length < 2) return null;

    const lastKey = keys[keys.length - 1]!;
    const previousKey = keys[keys.length - 2]!;

    const last = grouped.get(lastKey)!;
    const previous = grouped.get(previousKey)!;

    return {
      currentLabel: monthLabelFromKey(lastKey),
      previousLabel: monthLabelFromKey(previousKey),
      previsaoDelta: calcDelta(last.previsao, previous.previsao),
      realizadaDelta: calcDelta(last.realizada, previous.realizada),
    };
  }, [filteredRows]);

  const monthlySeries = useMemo(() => {
    const grouped = new Map<string, { previsao: number; realizada: number }>();

    filteredRows.forEach((row) => {
      const key = monthKey(row);
      const current = grouped.get(key) ?? { previsao: 0, realizada: 0 };

      current.previsao += toNumber(row.previsao_atualizada);
      current.realizada += toNumber(row.receita_realizada);

      grouped.set(key, current);
    });

    const keys = [...grouped.keys()].sort();

    return {
      categories: keys.map(monthLabelFromKey),
      previsao: keys.map((key) => Number((grouped.get(key)?.previsao ?? 0).toFixed(2))),
      realizada: keys.map((key) => Number((grouped.get(key)?.realizada ?? 0).toFixed(2))),
    };
  }, [filteredRows]);

  const categoriaBar = useMemo(() => {
    return groupSum(
      filteredRows,
      categoriaEconomica,
      (row) => toNumber(row.receita_realizada),
    )
      .slice(0, 12)
      .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }));
  }, [filteredRows]);

  const fonteBar = useMemo(() => {
    return groupSum(
      filteredRows,
      fonteLabel,
      (row) => toNumber(row.receita_realizada),
    )
      .slice(0, 12)
      .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }));
  }, [filteredRows]);

  const contaBar = useMemo(() => {
    return groupSum(
      filteredRows,
      contaContabilLabel,
      (row) => toNumber(row.receita_realizada),
    )
      .slice(0, 12)
      .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }));
  }, [filteredRows]);

  const tipoDonut = useMemo(() => {
    return groupSum(
      filteredRows,
      tipoReceitaLabel,
      (row) => toNumber(row.receita_realizada),
    ).map(([name, value]) => ({
      name,
      value: Number(value.toFixed(2)),
      absValue: Number(Math.abs(value).toFixed(2)),
    }));
  }, [filteredRows]);

  const paretoFonte = useMemo(() => {
    const sorted = [...fonteBar]
      .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
      .slice(0, 15);

    const total = sorted.reduce((acc, item) => acc + Math.abs(item.value), 0);
    let accumulated = 0;

    return sorted.map((item) => {
      accumulated += Math.abs(item.value);

      return {
        name: item.name,
        value: item.value,
        accumulatedPercent: total > 0 ? Number(((accumulated / total) * 100).toFixed(1)) : 0,
      };
    });
  }, [fonteBar]);

  const resumoCategorias = useMemo(() => {
    const map = new Map<
      string,
      {
        previsaoInicial: number;
        previsaoAtualizada: number;
        realizada: number;
      }
    >();

    filteredRows.forEach((row) => {
      const key = categoriaEconomica(row);
      const current = map.get(key) ?? {
        previsaoInicial: 0,
        previsaoAtualizada: 0,
        realizada: 0,
      };

      current.previsaoInicial += toNumber(row.previsao_inicial);
      current.previsaoAtualizada += toNumber(row.previsao_atualizada);
      current.realizada += toNumber(row.receita_realizada);

      map.set(key, current);
    });

    return [...map.entries()]
      .map(([categoria, values]) => ({
        categoria,
        ...values,
        execucao:
          values.previsaoAtualizada !== 0
            ? (values.realizada / values.previsaoAtualizada) * 100
            : 0,
      }))
      .sort((a, b) => b.realizada - a.realizada);
  }, [filteredRows]);

  function replaceParams(updater: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    updater(params);

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function setFilter(key: string, value: string) {
    replaceParams((params) => {
      if (value === "all" || value === "") params.delete(key);
      else params.set(key, value);
    });
  }

  const lineOptions: ApexOptions = {
    chart: {
      type: "line",
      toolbar: { show: false },
      zoom: { enabled: false },
      background: "transparent",
    },
    colors: ["#2563eb", "#16a34a"],
    stroke: { curve: "smooth", width: [2, 2] },
    markers: { size: 3 },
    dataLabels: { enabled: false },
    xaxis: {
      categories: monthlySeries.categories,
      labels: { style: { fontSize: "11px" } },
    },
    yaxis: {
      labels: {
        formatter: (value) => formatCompactMoney(Number(value)),
        style: { fontSize: "11px" },
      },
    },
    tooltip: {
      y: {
        formatter: (value) => formatMoney(Number(value)),
      },
    },
    legend: { position: "top" },
    grid: { borderColor: "#f1f5f9" },
  };

  const lineSeries = [
    { name: "Previsão atualizada", data: monthlySeries.previsao },
    { name: "Receita realizada", data: monthlySeries.realizada },
  ];

  const categoriaBarOptions: ApexOptions = {
    chart: {
      type: "bar",
      toolbar: { show: false },
      background: "transparent",
      events: {
        dataPointSelection: (_event, _chart, config) => {
          const item = categoriaBar[config.dataPointIndex];
          if (!item) return;
          setFilter("categoria", selectedCategoria === item.name ? "all" : item.name);
        },
      },
    },
    plotOptions: { bar: { horizontal: true, borderRadius: 4 } },
    colors: ["#2563eb"],
    dataLabels: {
      enabled: true,
      formatter: (value) => formatCompactMoney(Number(value)),
      style: { fontSize: "10px" },
    },
    xaxis: {
      labels: {
        formatter: (value) => formatCompactMoney(Number(value)),
        style: { fontSize: "10px" },
      },
    },
    yaxis: {
      labels: {
        style: { fontSize: "10px" },
        maxWidth: 180,
      },
    },
    tooltip: {
      y: {
        formatter: (value) => formatMoney(Number(value)),
      },
    },
    grid: { borderColor: "#f1f5f9" },
  };

  const categoriaBarSeries = [
    {
      name: "Receita realizada",
      data: categoriaBar.map((item) => ({
        x: truncateLabel(item.name, 34),
        y: item.value,
      })),
    },
  ];

  const fonteBarOptions: ApexOptions = {
    chart: {
      type: "bar",
      toolbar: { show: false },
      background: "transparent",
      events: {
        dataPointSelection: (_event, _chart, config) => {
          const item = fonteBar[config.dataPointIndex];
          if (!item) return;
          setFilter("fonte", selectedFonte === item.name ? "all" : item.name);
        },
      },
    },
    plotOptions: { bar: { horizontal: true, borderRadius: 4 } },
    colors: ["#0f766e"],
    dataLabels: {
      enabled: true,
      formatter: (value) => formatCompactMoney(Number(value)),
      style: { fontSize: "10px" },
    },
    xaxis: {
      labels: {
        formatter: (value) => formatCompactMoney(Number(value)),
        style: { fontSize: "10px" },
      },
    },
    yaxis: {
      labels: {
        style: { fontSize: "10px" },
        maxWidth: 190,
      },
    },
    tooltip: {
      y: {
        formatter: (value) => formatMoney(Number(value)),
      },
    },
    grid: { borderColor: "#f1f5f9" },
  };

  const fonteBarSeries = [
    {
      name: "Receita realizada",
      data: fonteBar.map((item) => ({
        x: truncateLabel(item.name, 36),
        y: item.value,
      })),
    },
  ];

  const tipoDonutOptions: ApexOptions = {
    chart: {
      type: "donut",
      toolbar: { show: false },
      background: "transparent",
      events: {
        dataPointSelection: (_event, _chart, config) => {
          const item = tipoDonut[config.dataPointIndex];
          if (!item) return;
          setFilter("tipo", selectedTipo === item.name ? "all" : item.name);
        },
      },
    },
    labels: tipoDonut.map((item) => item.name),
    colors: ["#16a34a", "#dc2626", "#2563eb", "#f97316"],
    legend: { position: "bottom", fontSize: "11px" },
    tooltip: {
      y: {
        formatter: (value, opts) => {
          const item = tipoDonut[opts.seriesIndex];
          return item ? formatMoney(item.value) : formatMoney(Number(value));
        },
      },
    },
    plotOptions: {
      pie: {
        donut: {
          size: "65%",
        },
      },
    },
  };

  const tipoDonutSeries = tipoDonut.map((item) => item.absValue);

  const paretoOptions: ApexOptions = {
    chart: {
      type: "line",
      toolbar: { show: false },
      background: "transparent",
    },
    colors: ["#0f766e", "#dc2626"],
    stroke: { width: [0, 3], curve: "smooth" },
    plotOptions: { bar: { borderRadius: 4, columnWidth: "55%" } },
    dataLabels: { enabled: false },
    xaxis: {
      categories: paretoFonte.map((item) => truncateLabel(item.name, 18)),
      labels: {
        rotate: -35,
        style: { fontSize: "10px" },
      },
    },
    yaxis: [
      {
        labels: {
          formatter: (value) => formatCompactMoney(Number(value)),
          style: { fontSize: "10px" },
        },
      },
      {
        opposite: true,
        min: 0,
        max: 100,
        labels: {
          formatter: (value) => formatPercent(Number(value)),
          style: { fontSize: "10px" },
        },
      },
    ],
    tooltip: {
      shared: true,
      intersect: false,
      y: [
        {
          formatter: (value) => formatMoney(Number(value)),
        },
        {
          formatter: (value) => formatPercent(Number(value)),
        },
      ],
    },
    legend: { position: "top" },
    grid: { borderColor: "#f1f5f9" },
  };

  const paretoSeries = [
    {
      name: "Receita realizada",
      type: "column",
      data: paretoFonte.map((item) => item.value),
    },
    {
      name: "Acumulado %",
      type: "line",
      data: paretoFonte.map((item) => item.accumulatedPercent),
    },
  ];

  const contaBarOptions: ApexOptions = {
    chart: {
      type: "bar",
      toolbar: { show: false },
      background: "transparent",
    },
    plotOptions: { bar: { horizontal: true, borderRadius: 4 } },
    colors: ["#7c3aed"],
    dataLabels: {
      enabled: true,
      formatter: (value) => formatCompactMoney(Number(value)),
      style: { fontSize: "10px" },
    },
    xaxis: {
      labels: {
        formatter: (value) => formatCompactMoney(Number(value)),
        style: { fontSize: "10px" },
      },
    },
    yaxis: {
      labels: {
        style: { fontSize: "10px" },
        maxWidth: 170,
      },
    },
    tooltip: {
      y: {
        formatter: (value) => formatMoney(Number(value)),
      },
    },
    grid: { borderColor: "#f1f5f9" },
  };

  const contaBarSeries = [
    {
      name: "Receita realizada",
      data: contaBar.map((item) => ({
        x: truncateLabel(item.name, 28),
        y: item.value,
      })),
    },
  ];

  const chartMeta: Record<ChartKey, { title: string; containerId: string }> = {
    line: {
      title: "Evolução Mensal — Previsão Atualizada vs Receita Realizada",
      containerId: "chart-receita-line",
    },
    categoriaBar: {
      title: "Receita Realizada por Categoria Econômica",
      containerId: "chart-receita-categoria",
    },
    fonteBar: {
      title: "Receita Realizada por Fonte de Recurso",
      containerId: "chart-receita-fonte",
    },
    tipoDonut: {
      title: "Receita por Tipo — Normal x Dedução",
      containerId: "chart-receita-tipo",
    },
    paretoFonte: {
      title: "Pareto das Fontes de Recurso",
      containerId: "chart-receita-pareto-fonte",
    },
    contaBar: {
      title: "Receita por Conta Contábil",
      containerId: "chart-receita-conta",
    },
  };

  const closeActionsMenu = (event: MouseEvent<HTMLButtonElement>) => {
    const details = event.currentTarget.closest("details");
    details?.removeAttribute("open");
  };

  const printChart = (chart: ChartKey) => {
    const meta = chartMeta[chart];
    const target = document.getElementById(meta.containerId);

    if (!target) return;

    const chartCanvas = target.querySelector(".apexcharts-canvas");
    const content = chartCanvas ? chartCanvas.outerHTML : target.innerHTML;
    const printWindow = window.open("", "_blank", "width=1200,height=860");

    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>${meta.title}</title>
          <style>
            body {
              margin: 0;
              font-family: Arial, sans-serif;
              padding: 24px;
              color: #111827;
            }
            h1 {
              margin: 0 0 16px;
              font-size: 20px;
              font-weight: 700;
            }
            .chart-wrap {
              border: 1px solid #d1d5db;
              border-radius: 12px;
              padding: 12px;
            }
          </style>
        </head>
        <body>
          <h1>${meta.title}</h1>
          <div class="chart-wrap">${content}</div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const renderExpandedChart = (chart: ChartKey) => {
    switch (chart) {
      case "line":
        return <Chart options={lineOptions} series={lineSeries} type="line" height={520} />;
      case "tipoDonut":
        return tipoDonutSeries.some((value) => value > 0) ? (
          <Chart options={tipoDonutOptions} series={tipoDonutSeries} type="donut" height={520} />
        ) : (
          <EmptyChart message="Sem dados por tipo para o recorte atual." />
        );
      case "categoriaBar":
        return categoriaBar.length > 0 ? (
          <Chart options={categoriaBarOptions} series={categoriaBarSeries} type="bar" height={520} />
        ) : (
          <EmptyChart message="Sem dados por categoria para o recorte atual." />
        );
      case "fonteBar":
        return fonteBar.length > 0 ? (
          <Chart options={fonteBarOptions} series={fonteBarSeries} type="bar" height={520} />
        ) : (
          <EmptyChart message="Sem dados por fonte para o recorte atual." />
        );
      case "paretoFonte":
        return paretoFonte.length > 0 ? (
          <Chart options={paretoOptions} series={paretoSeries} type="line" height={520} />
        ) : (
          <EmptyChart message="Sem dados para o Pareto no recorte atual." />
        );
      case "contaBar":
        return contaBar.length > 0 ? (
          <Chart options={contaBarOptions} series={contaBarSeries} type="bar" height={520} />
        ) : (
          <EmptyChart message="Sem dados por conta contábil para o recorte atual." />
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-16 text-gray-400">
        Carregando dados da receita pública...
      </div>
    );
  }

  if (error) {
    return (
      <div className="m-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
        Falha ao carregar dados da receita pública: {error}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="m-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-300">
        Nenhum dado encontrado na tabela{" "}
        <span className="font-semibold">receita_publica_categoria_mensal</span>.
        Verifique se a carga full do ETL foi executada na Supabase.
      </div>
    );
  }

  return (
    <div className="w-full max-w-full min-w-0 space-y-3 overflow-x-hidden pb-2">
      <div className="lg:hidden">
        <ReceitaPublicaHeaderFilters />
      </div>

      <section className="grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          title="Previsão inicial"
          value={formatCompactMoney(kpi.previsaoInicial)}
          description="Orçamento inicial da receita"
          delta={null}
        />

        <KpiCard
          title="Previsão atualizada"
          value={formatCompactMoney(kpi.previsaoAtualizada)}
          description="Orçamento atualizado"
          delta={kpiVariation?.previsaoDelta ?? null}
        />

        <KpiCard
          title="Receita realizada"
          value={formatCompactMoney(kpi.receitaRealizada)}
          description="Arrecadação líquida"
          delta={kpiVariation?.realizadaDelta ?? null}
        />

        <KpiCard
          title="Execução da receita"
          value={formatPercent(kpi.execucao)}
          description="Realizada / previsão atualizada"
          delta={null}
        />

        <KpiCard
          title="Registros"
          value={formatNumber(kpi.qtdRegistros)}
          description={`${formatNumber(kpi.qtdRemessas)} remessa(s) no recorte`}
          delta={null}
        />
      </section>

      <section className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <ChartCard
          chartKey="line"
          title="Evolução mensal"
          subtitle="Previsão atualizada x receita realizada"
          containerId={chartMeta.line.containerId}
          highlightedChart={highlightedChart}
          onHighlight={() =>
            setHighlightedChart(highlightedChart === "line" ? null : "line")
          }
          onPrint={() => printChart("line")}
          onCloseActions={closeActionsMenu}
          className="xl:col-span-2"
        >
          {monthlySeries.categories.length > 0 ? (
            <Chart options={lineOptions} series={lineSeries} type="line" height={280} />
          ) : (
            <EmptyChart message="Sem dados mensais para o recorte atual." />
          )}
        </ChartCard>

        <ChartCard
          chartKey="tipoDonut"
          title="Normal x dedução"
          subtitle="Composição absoluta por tipo de receita"
          containerId={chartMeta.tipoDonut.containerId}
          highlightedChart={highlightedChart}
          onHighlight={() =>
            setHighlightedChart(highlightedChart === "tipoDonut" ? null : "tipoDonut")
          }
          onPrint={() => printChart("tipoDonut")}
          onCloseActions={closeActionsMenu}
        >
          {tipoDonutSeries.some((value) => value > 0) ? (
            <Chart
              options={tipoDonutOptions}
              series={tipoDonutSeries}
              type="donut"
              height={280}
            />
          ) : (
            <EmptyChart message="Sem dados por tipo para o recorte atual." />
          )}
        </ChartCard>
      </section>
      <section className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <ChartCard
          chartKey="categoriaBar"
          title="Receita por categoria econômica"
          subtitle="Clique em uma barra para filtrar"
          containerId={chartMeta.categoriaBar.containerId}
          highlightedChart={highlightedChart}
          onHighlight={() =>
            setHighlightedChart(
              highlightedChart === "categoriaBar" ? null : "categoriaBar",
            )
          }
          onPrint={() => printChart("categoriaBar")}
          onCloseActions={closeActionsMenu}
        >
          {categoriaBar.length > 0 ? (
            <Chart
              options={categoriaBarOptions}
              series={categoriaBarSeries}
              type="bar"
              height={320}
            />
          ) : (
            <EmptyChart message="Sem dados por categoria para o recorte atual." />
          )}
        </ChartCard>

        <ChartCard
          chartKey="fonteBar"
          title="Receita por fonte de recurso"
          subtitle="TOP fontes por receita realizada"
          containerId={chartMeta.fonteBar.containerId}
          highlightedChart={highlightedChart}
          onHighlight={() =>
            setHighlightedChart(highlightedChart === "fonteBar" ? null : "fonteBar")
          }
          onPrint={() => printChart("fonteBar")}
          onCloseActions={closeActionsMenu}
        >
          {fonteBar.length > 0 ? (
            <Chart
              options={fonteBarOptions}
              series={fonteBarSeries}
              type="bar"
              height={320}
            />
          ) : (
            <EmptyChart message="Sem dados por fonte para o recorte atual." />
          )}
        </ChartCard>
      </section>

      <section className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <ChartCard
          chartKey="paretoFonte"
          title="Pareto por fonte"
          subtitle="Concentração das principais fontes de recurso"
          containerId={chartMeta.paretoFonte.containerId}
          highlightedChart={highlightedChart}
          onHighlight={() =>
            setHighlightedChart(
              highlightedChart === "paretoFonte" ? null : "paretoFonte",
            )
          }
          onPrint={() => printChart("paretoFonte")}
          onCloseActions={closeActionsMenu}
        >
          {paretoFonte.length > 0 ? (
            <Chart
              options={paretoOptions}
              series={paretoSeries}
              type="line"
              height={320}
            />
          ) : (
            <EmptyChart message="Sem dados para o Pareto no recorte atual." />
          )}
        </ChartCard>

        <ChartCard
          chartKey="contaBar"
          title="Receita por conta contábil"
          subtitle="Contas usadas na composição da receita"
          containerId={chartMeta.contaBar.containerId}
          highlightedChart={highlightedChart}
          onHighlight={() =>
            setHighlightedChart(highlightedChart === "contaBar" ? null : "contaBar")
          }
          onPrint={() => printChart("contaBar")}
          onCloseActions={closeActionsMenu}
        >
          {contaBar.length > 0 ? (
            <Chart
              options={contaBarOptions}
              series={contaBarSeries}
              type="bar"
              height={320}
            />
          ) : (
            <EmptyChart message="Sem dados por conta contábil para o recorte atual." />
          )}
        </ChartCard>
      </section>

      {highlightedChart && (
        <div
          className="fixed inset-0 z-999999 flex items-center justify-center bg-black/55 p-3 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={chartMeta[highlightedChart].title}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setHighlightedChart(null);
          }}
        >
          <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">
                  {chartMeta[highlightedChart].title}
                </h2>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  Visualização ampliada do gráfico no recorte atual.
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => printChart(highlightedChart)}
                  className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  Imprimir
                </button>
                <button
                  type="button"
                  onClick={() => setHighlightedChart(null)}
                  className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  Fechar
                </button>
              </div>
            </div>

            <div className="min-h-0 overflow-auto p-4">
              <div className="min-w-[760px]">{renderExpandedChart(highlightedChart)}</div>
            </div>
          </div>
        </div>
      )}

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
              Resumo por categoria econômica
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Soma da previsão inicial, previsão atualizada e receita realizada no recorte atual.
            </p>
          </div>

          <div className="text-xs text-gray-500 dark:text-gray-400">
            {formatNumber(resumoCategorias.length)} categoria(s)
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-700">
                <th className="px-3 py-2">Categoria</th>
                <th className="px-3 py-2 text-right">Previsão inicial</th>
                <th className="px-3 py-2 text-right">Previsão atualizada</th>
                <th className="px-3 py-2 text-right">Receita realizada</th>
                <th className="px-3 py-2 text-right">Execução</th>
              </tr>
            </thead>

            <tbody>
              {resumoCategorias.map((row) => (
                <tr
                  key={row.categoria}
                  className="border-b border-gray-50 text-gray-700 last:border-0 dark:border-gray-700 dark:text-gray-300"
                >
                  <td className="px-3 py-3 font-medium">{row.categoria}</td>
                  <td className="px-3 py-3 text-right">
                    {formatMoney(row.previsaoInicial)}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {formatMoney(row.previsaoAtualizada)}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {formatMoney(row.realizada)}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {formatPercent(row.execucao)}
                  </td>
                </tr>
              ))}

              {resumoCategorias.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-8 text-center text-sm text-gray-500 dark:text-gray-400"
                  >
                    Nenhum dado encontrado para o recorte atual.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}


function KpiCard({
  title,
  value,
  description,
  delta,
}: {
  title: string;
  value: string;
  description: string;
  delta: number | null;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-1.5 flex items-start justify-between gap-3">
        <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
        {delta !== null && <DeltaPill value={delta} />}
      </div>

      <p className="text-xl font-bold text-gray-900 dark:text-white sm:text-2xl">
        {value}
      </p>

      <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">{description}</p>
    </div>
  );
}

function DeltaPill({ value }: { value: number }) {
  const positive = value > 0.01;
  const negative = value < -0.01;

  const className = positive
    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
    : negative
      ? "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300"
      : "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";

  const arrow = positive ? "↑" : negative ? "↓" : "→";

  return (
    <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${className}`}>
      {arrow} {formatDeltaPercent(value)}
    </span>
  );
}

function ChartCard({
  chartKey,
  title,
  subtitle,
  containerId,
  highlightedChart,
  onHighlight,
  onPrint,
  onCloseActions,
  className = "",
  children,
}: {
  chartKey: ChartKey;
  title: string;
  subtitle: string;
  containerId: string;
  highlightedChart: ChartKey | null;
  onHighlight: () => void;
  onPrint: () => void;
  onCloseActions: (event: MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  children: ReactNode;
}) {
  const isHighlighted = highlightedChart === chartKey;
  const isDimmed = highlightedChart !== null && highlightedChart !== chartKey;

  return (
    <div
      id={containerId}
      className={`rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition dark:border-gray-700 dark:bg-gray-800 ${
        isHighlighted ? "ring-2 ring-blue-400" : ""
      } ${isDimmed ? "opacity-40" : ""} ${className}`}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight text-gray-700 dark:text-gray-200">
            {title}
          </h2>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {subtitle}
          </p>
        </div>

        <details className="relative shrink-0">
          <summary className="inline-flex list-none cursor-pointer select-none items-center rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-600 transition hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700">
            Ações
          </summary>

          <div className="absolute right-0 z-20 mt-1 w-40 rounded-lg border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
            <button
              type="button"
              onClick={(event) => {
                onCloseActions(event);
                onHighlight();
              }}
              className="w-full rounded-md px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              {isHighlighted ? "Remover visualização" : "Visualizar"}
            </button>

            <button
              type="button"
              onClick={(event) => {
                onCloseActions(event);
                onPrint();
              }}
              className="w-full rounded-md px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              Imprimir
            </button>
          </div>
        </details>
      </div>

      {children}
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-[260px] items-center justify-center rounded-lg border border-dashed border-gray-300 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
      {message}
    </div>
  );
}
