"use client";

import dynamic from "next/dynamic";
import type { MunicipioBase } from "./SeletorMunicipio";

const SeletorMunicipio = dynamic(() => import("./SeletorMunicipio"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[500px] items-center justify-center rounded-xl border border-gray-200 bg-gray-50">
      <div className="flex flex-col items-center gap-3">
        <div className="h-7 w-7 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
        <p className="text-sm text-gray-500">Carregando seletor...</p>
      </div>
    </div>
  ),
});

export type { MunicipioBase };
export default SeletorMunicipio;
