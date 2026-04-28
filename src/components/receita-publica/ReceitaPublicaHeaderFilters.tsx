"use client";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type NumericValue = number | string | null;

type ReceitaFiltroRow = {
  ano: number | string | null;
  mes: number | string | null;
  codigo: string | null;
  id_catreceita: number | string | null;
  tipo_receita: string | null;
  fonte_nome: string | null;
  fonte_classificacao: string | null;
  numero_fonte_recurso: number | string | null;
  id_entidade: number | string | null;
  id_entidade_cjur: number | string | null;
};

type PeriodoRow = {
  ano: number | string | null;
  mes: number | string | null;
};

type SelectOption = {
  value: string;
  label: string;
};

type EntidadeNomeRow = {
  id_entidade: number | string | null;
  id_entidade_cjur?: number | string | null;
  entidade?: string | null;
  nome?: string | null;
};

function toStringValue(value: NumericValue | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  return String(value);
}

function tipoReceitaLabel(row: ReceitaFiltroRow): string {
  const value = toStringValue(row.tipo_receita).trim().toUpperCase();
  if (!value) return "NORMAL";
  if (value.includes("DEDU")) return "DEDUÇÃO";
  return value;
}

function codigoReceita(row: ReceitaFiltroRow): string {
  return toStringValue(row.codigo || row.id_catreceita).trim();
}

function categoriaEconomica(row: ReceitaFiltroRow): string {
  const tipo = tipoReceitaLabel(row);
  const codigo = codigoReceita(row);

  if (tipo === "DEDUÇÃO") return "Dedução da Receita";

  switch (codigo.charAt(0)) {
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

function fonteLabel(row: ReceitaFiltroRow): string {
  const nome = toStringValue(row.fonte_nome).trim();
  const classificacao = toStringValue(row.fonte_classificacao).trim();
  const numero = toStringValue(row.numero_fonte_recurso).trim();

  if (nome) return nome;
  if (classificacao && numero) return `${numero} - ${classificacao}`;
  if (classificacao) return classificacao;
  if (numero) return `Fonte ${numero}`;
  return "Sem fonte informada";
}

function entidadeValue(row: ReceitaFiltroRow): string {
  return toStringValue(row.id_entidade).trim() || "sem-entidade";
}

function entidadeFallbackLabel(row: ReceitaFiltroRow): string {
  const idEntidade = toStringValue(row.id_entidade).trim();
  const idCjur = toStringValue(row.id_entidade_cjur).trim();
  if (idEntidade && idCjur) return `Entidade ${idEntidade} / CJUR ${idCjur}`;
  if (idEntidade) return `Entidade ${idEntidade}`;
  if (idCjur) return `CJUR ${idCjur}`;
  return "Sem entidade";
}

export default function ReceitaPublicaHeaderFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [rows, setRows] = useState<ReceitaFiltroRow[]>([]);
  const [periodos, setPeriodos] = useState<PeriodoRow[]>([]);
  const [entidadeNomes, setEntidadeNomes] = useState<Map<string, string>>(new Map());
  const [entidadeOptions, setEntidadeOptions] = useState<SelectOption[]>([]);
  const [dialog, setDialog] = useState<null | "anoInicio" | "anoFim" | "categoria" | "fonte" | "entidade">(null);

  const selectedAnoInicio = searchParams.get("anoInicio") ?? "";
  const selectedAnoFim = searchParams.get("anoFim") ?? "";
  const selectedCategoria = searchParams.get("categoria") ?? "all";
  const selectedFonte = searchParams.get("fonte") ?? "all";
  const selectedEntidade = searchParams.get("entidade") ?? "all";

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      if (!isSupabaseConfigured || !supabase) {
        if (active) {
          setLoading(false);
          setHasLoadedOnce(true);
        }
        return;
      }

      try {
        const [periodosResult, rowsResult, dimEntidadeResult, combustivelEntidadeResult] = await Promise.allSettled([
          supabase.from("vw_receita_publica_kpis").select("ano, mes").order("ano", { ascending: true }).order("mes", { ascending: true }),
          supabase
            .from("receita_publica_categoria_mensal")
            .select("ano, mes, codigo, id_catreceita, tipo_receita, fonte_nome, fonte_classificacao, numero_fonte_recurso, id_entidade, id_entidade_cjur")
            .order("ano", { ascending: false })
            .order("mes", { ascending: false })
            .range(0, 4999),
          supabase.from("dim_entidade").select("id_entidade, id_entidade_cjur, nome").range(0, 9999),
          supabase.from("tb_despesa_combustivel_polanco").select("id_entidade, entidade").range(0, 9999),
        ]);

        const periodosData = periodosResult.status === "fulfilled" ? ((periodosResult.value.data ?? []) as PeriodoRow[]) : [];
        const rowsData = rowsResult.status === "fulfilled" ? ((rowsResult.value.data ?? []) as ReceitaFiltroRow[]) : [];
        const dimEntidadeData = dimEntidadeResult.status === "fulfilled" ? ((dimEntidadeResult.value.data ?? []) as EntidadeNomeRow[]) : [];
        const combustivelEntidadeData =
          combustivelEntidadeResult.status === "fulfilled" ? ((combustivelEntidadeResult.value.data ?? []) as EntidadeNomeRow[]) : [];

        const nomeMap = new Map<string, string>();
        const dimOptionsMap = new Map<string, string>();
        dimEntidadeData.forEach((r) => {
          const idEnt = toStringValue(r.id_entidade).trim();
          const idCjur = toStringValue(r.id_entidade_cjur).trim();
          const nome = toStringValue(r.nome).trim();
          if (!nome) return;
          if (idEnt && !nomeMap.has(idEnt)) nomeMap.set(idEnt, nome);
          if (idCjur && !nomeMap.has(idCjur)) nomeMap.set(idCjur, nome);
          // Para o seletor, usamos apenas id_entidade para evitar duplicidade
          // visual da mesma entidade (id_entidade vs id_entidade_cjur).
          if (idEnt && !dimOptionsMap.has(idEnt)) dimOptionsMap.set(idEnt, nome);
        });
        combustivelEntidadeData.forEach((r) => {
          const idEnt = toStringValue(r.id_entidade).trim();
          const nome = toStringValue(r.entidade).trim();
          if (idEnt && nome && !nomeMap.has(idEnt)) nomeMap.set(idEnt, nome);
        });

        const seenNames = new Set<string>();
        const dimOptions = [...dimOptionsMap.entries()]
          .sort((a, b) => a[1].localeCompare(b[1], "pt-BR"))
          .filter(([, label]) => {
            const normalized = label.trim().toLocaleLowerCase("pt-BR");
            if (!normalized) return false;
            if (seenNames.has(normalized)) return false;
            seenNames.add(normalized);
            return true;
          })
          .map(([value, label]) => ({ value, label }));

        if (!active) return;
        setPeriodos(periodosData);
        setRows(rowsData);
        setEntidadeNomes(nomeMap);
        setEntidadeOptions(dimOptions);
      } catch (error) {
        console.error("Falha ao carregar filtros da receita pública:", error);
        if (!active) return;
        setPeriodos([]);
        setRows([]);
        setEntidadeNomes(new Map());
        setEntidadeOptions([]);
      } finally {
        if (active) {
          setLoading(false);
          setHasLoadedOnce(true);
        }
      }
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  const availableYears = useMemo(() => {
    const years = (periodos.length ? periodos : rows)
      .map((row) => Number(row.ano))
      .filter((year) => Number.isFinite(year) && year > 0);
    return [...new Set(years)].sort((a, b) => a - b);
  }, [periodos, rows]);

  const defaultAnoInicio = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const latest = availableYears.at(-1) ?? currentYear;
    return String(latest - 1);
  }, [availableYears]);

  const defaultAnoFim = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const latest = availableYears.at(-1) ?? currentYear;
    return String(latest);
  }, [availableYears]);

  useEffect(() => {
    if (!hasLoadedOnce) return;
    if (selectedAnoInicio || selectedAnoFim) return;

    const next = new URLSearchParams(searchParams.toString());
    next.set("anoInicio", defaultAnoInicio);
    next.set("anoFim", defaultAnoFim);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }, [
    hasLoadedOnce,
    selectedAnoInicio,
    selectedAnoFim,
    searchParams,
    defaultAnoInicio,
    defaultAnoFim,
    pathname,
    router,
  ]);

  const displayedAnoInicio = selectedAnoInicio || defaultAnoInicio;
  const displayedAnoFim = selectedAnoFim || defaultAnoFim;

  const availableCategorias = useMemo<SelectOption[]>(
    () =>
      [...new Set(rows.map(categoriaEconomica))]
        .sort((a, b) => a.localeCompare(b, "pt-BR"))
        .map((item) => ({ value: item, label: item })),
    [rows],
  );

  const availableFontes = useMemo<SelectOption[]>(
    () =>
      [...new Set(rows.map(fonteLabel))]
        .sort((a, b) => a.localeCompare(b, "pt-BR"))
        .map((item) => ({ value: item, label: item })),
    [rows],
  );

  const availableEntidades = useMemo<SelectOption[]>(() => {
    if (entidadeOptions.length > 0) return entidadeOptions;
    const map = new Map<string, string>();
    rows.forEach((row) => {
      const value = entidadeValue(row);
      map.set(value, entidadeNomes.get(value) ?? entidadeFallbackLabel(row));
    });
    return [...map.entries()]
      .sort((a, b) => a[1].localeCompare(b[1], "pt-BR"))
      .map(([value, label]) => ({ value, label }));
  }, [entidadeOptions, rows, entidadeNomes]);

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams.toString());
    if (value === "all" || value === "") next.delete(key);
    else next.set(key, value);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  const clearAllFilters = () => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("categoria");
    next.delete("fonte");
    next.delete("entidade");
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  const hasActiveFilters = selectedCategoria !== "all" || selectedFonte !== "all" || selectedEntidade !== "all";

  const activeFilterCount = [
    selectedCategoria !== "all" ? selectedCategoria : "",
    selectedFonte !== "all" ? selectedFonte : "",
    selectedEntidade !== "all" ? selectedEntidade : "",
  ].filter(Boolean).length;

  const optionsByDialog: Record<NonNullable<typeof dialog>, SelectOption[]> = {
    anoInicio: availableYears.map((y) => ({ value: String(y), label: String(y) })),
    anoFim: availableYears.map((y) => ({ value: String(y), label: String(y) })),
    categoria: availableCategorias,
    fonte: availableFontes,
    entidade: availableEntidades,
  };

  const valueByDialog: Record<NonNullable<typeof dialog>, string> = {
    anoInicio: displayedAnoInicio,
    anoFim: displayedAnoFim,
    categoria: selectedCategoria,
    fonte: selectedFonte,
    entidade: selectedEntidade,
  };

  return (
    <>
      <div className="flex w-full flex-wrap items-center gap-2 pb-1">
        <div className="flex h-11 shrink-0 items-center gap-1 rounded-lg border border-gray-200 bg-transparent px-2 shadow-theme-xs dark:border-gray-700">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Período</span>
          <button type="button" onClick={() => setDialog("anoInicio")} className="h-7 rounded-md border border-gray-200 bg-transparent px-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">{displayedAnoInicio || "—"}</button>
          <span className="text-xs text-gray-400">a</span>
          <button type="button" onClick={() => setDialog("anoFim")} className="h-7 rounded-md border border-gray-200 bg-transparent px-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">{displayedAnoFim || "—"}</button>
        </div>

        <FilterTrigger label="Categoria" value={selectedCategoria} placeholder="Todas" options={availableCategorias} onClick={() => setDialog("categoria")} />
        <FilterTrigger label="Fonte" value={selectedFonte} placeholder="Todas" options={availableFontes} onClick={() => setDialog("fonte")} />
        <FilterTrigger label="Entidade" value={selectedEntidade} placeholder="Todas" options={availableEntidades} onClick={() => setDialog("entidade")} />

        {hasActiveFilters ? (
          <button type="button" onClick={clearAllFilters} className="h-11 shrink-0 rounded-lg border border-red-200 bg-red-50 px-3 text-sm font-medium text-red-700 hover:bg-red-100 dark:border-red-800/70 dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/35">Limpar filtros ({activeFilterCount})</button>
        ) : null}

        {loading && !hasLoadedOnce ? <span className="shrink-0 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">Carregando filtros...</span> : null}
      </div>

      <FilterDialog
        key={dialog ?? "closed"}
        title={
          dialog === "anoInicio"
            ? "Selecionar ano"
            : dialog === "anoFim"
              ? "Selecionar ano final"
              : dialog === "categoria"
                ? "Selecionar categoria"
                : dialog === "fonte"
                  ? "Selecionar fonte"
                  : "Selecionar entidade"
        }
        isOpen={dialog !== null}
        value={dialog ? valueByDialog[dialog] : "all"}
        placeholder={dialog === "anoInicio" || dialog === "anoFim" ? "Todos" : "Todas"}
        options={dialog ? optionsByDialog[dialog] : []}
        onClose={() => setDialog(null)}
        onSelect={(value) => {
          if (dialog === "anoInicio") setFilter("anoInicio", value);
          else if (dialog === "anoFim") setFilter("anoFim", value);
          else if (dialog === "categoria") setFilter("categoria", value);
          else if (dialog === "fonte") setFilter("fonte", value);
          else if (dialog === "entidade") setFilter("entidade", value);
        }}
      />
    </>
  );
}

function FilterTrigger({ label, value, placeholder, options, onClick }: { label: string; value: string; placeholder: string; options: SelectOption[]; onClick: () => void }) {
  const selectedLabel = value === "all" || value === "" ? placeholder : options.find((o) => o.value === value)?.label || value;
  return (
    <button type="button" onClick={onClick} className={`flex h-11 min-w-[170px] max-w-[240px] items-center gap-2 rounded-lg border px-3 text-left shadow-theme-xs transition hover:bg-gray-50 dark:hover:bg-gray-800 ${value !== "all" && value !== "" ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800/70 dark:bg-blue-900/20 dark:text-blue-300" : "border-gray-200 bg-transparent text-gray-700 dark:border-gray-700 dark:text-gray-200"}`}>
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400">{label}</span>
      <span className="min-w-0 truncate text-xs font-semibold">{selectedLabel}</span>
    </button>
  );
}

function FilterDialog({ title, isOpen, value, placeholder, options, onClose, onSelect }: { title: string; isOpen: boolean; value: string; placeholder: string; options: SelectOption[]; onClose: () => void; onSelect: (value: string) => void }) {
  const [term, setTerm] = useState("");
  useEffect(() => {
    if (!isOpen) return;
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [isOpen, onClose]);

  const visibleOptions = useMemo(() => {
    const q = term.trim().toLocaleLowerCase("pt-BR");
    if (!q) return options;
    return options.filter((item) => item.label.toLocaleLowerCase("pt-BR").includes(q));
  }, [options, term]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120000] flex items-center justify-center p-3 sm:p-4">
      <button type="button" aria-label="Fechar filtro" className="absolute inset-0 bg-gray-900/45 backdrop-blur-[1px]" onClick={onClose} />
      <div className="relative w-full max-w-2xl overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{title}</h3>
          <button type="button" onClick={onClose} className="rounded-md px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800">Fechar</button>
        </div>
        <div className="space-y-3 p-4">
          <input value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Pesquisar..." className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-700 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-950 dark:text-white/90" />
          <div className="max-h-[55vh] overflow-auto rounded-lg border border-gray-200 p-1 dark:border-gray-700">
            <button type="button" onClick={() => { onSelect("all"); onClose(); }} className={`block w-full rounded-md px-3 py-2 text-left text-sm ${value === "all" ? "bg-blue-50 font-semibold text-blue-700 dark:bg-blue-900/20 dark:text-blue-300" : "text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"}`}>{placeholder}</button>
            {visibleOptions.map((option) => (
              <button key={`${title}-${option.value}`} type="button" onClick={() => { onSelect(option.value); onClose(); }} className={`block w-full rounded-md px-3 py-2 text-left text-sm ${option.value === value ? "bg-blue-50 font-semibold text-blue-700 dark:bg-blue-900/20 dark:text-blue-300" : "text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"}`}>{option.label}</button>
            ))}
            {visibleOptions.length === 0 ? <p className="px-3 py-5 text-sm text-gray-500 dark:text-gray-400">Nenhum resultado encontrado.</p> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
