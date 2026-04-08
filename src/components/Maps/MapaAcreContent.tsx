"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, GeoJSON, CircleMarker, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";

// Dados simulados de municípios do Acre
const municipiosAcre = [
  { nome: "Rio Branco", lat: -9.9754, lng: -67.8249, ideb: 5.2, populacao: 419452 },
  { nome: "Cruzeiro do Sul", lat: -7.6307, lng: -72.6732, ideb: 4.8, populacao: 85036 },
  { nome: "Sena Madureira", lat: -9.0659, lng: -68.6578, ideb: 4.3, populacao: 44928 },
  { nome: "Tarauacá", lat: -8.1608, lng: -70.7739, ideb: 4.1, populacao: 40330 },
  { nome: "Feijó", lat: -8.1614, lng: -70.3533, ideb: 4.5, populacao: 35354 },
  { nome: "Brasileia", lat: -11.0089, lng: -68.7411, ideb: 5.0, populacao: 26676 },
  { nome: "Epitaciolândia", lat: -11.0233, lng: -68.7239, ideb: 4.7, populacao: 16634 },
  { nome: "Xapuri", lat: -10.6519, lng: -68.5011, ideb: 4.9, populacao: 18523 },
  { nome: "Plácido de Castro", lat: -10.3322, lng: -67.1808, ideb: 4.6, populacao: 18945 },
  { nome: "Acrelândia", lat: -9.9936, lng: -66.8969, ideb: 5.1, populacao: 14369 },
  { nome: "Senador Guiomard", lat: -10.1536, lng: -67.7375, ideb: 4.8, populacao: 22081 },
  { nome: "Porto Acre", lat: -9.5836, lng: -67.5344, ideb: 4.4, populacao: 17533 },
  { nome: "Bujari", lat: -9.8272, lng: -67.9519, ideb: 4.2, populacao: 9024 },
  { nome: "Capixaba", lat: -10.5597, lng: -67.6908, ideb: 4.6, populacao: 8798 },
  { nome: "Mâncio Lima", lat: -7.6178, lng: -72.8964, ideb: 3.9, populacao: 16482 },
  { nome: "Rodrigues Alves", lat: -7.7367, lng: -72.6461, ideb: 4.0, populacao: 15451 },
  { nome: "Porto Walter", lat: -8.2694, lng: -72.7503, ideb: 3.8, populacao: 10617 },
  { nome: "Marechal Thaumaturgo", lat: -8.9361, lng: -72.7914, ideb: 3.7, populacao: 16973 },
  { nome: "Jordão", lat: -9.1658, lng: -71.8964, ideb: 3.6, populacao: 7026 },
  { nome: "Santa Rosa do Purus", lat: -9.4744, lng: -70.5197, ideb: 3.5, populacao: 5841 },
  { nome: "Manoel Urbano", lat: -8.8369, lng: -69.2578, ideb: 4.0, populacao: 8004 },
  { nome: "Assis Brasil", lat: -10.9358, lng: -69.5733, ideb: 4.3, populacao: 7408 },
];

// Cor baseada no IDEB
function getColor(ideb: number): string {
  if (ideb >= 5.0) return "#22c55e";
  if (ideb >= 4.5) return "#84cc16";
  if (ideb >= 4.0) return "#eab308";
  if (ideb >= 3.5) return "#f97316";
  return "#ef4444";
}

// Raio baseado na população
function getRadius(populacao: number): number {
  if (populacao > 100000) return 28;
  if (populacao > 30000) return 18;
  if (populacao > 10000) return 12;
  return 8;
}

type ViewMode = "bolhas" | "lista";

export default function MapaAcreContent() {
  const [viewMode, setViewMode] = useState<ViewMode>("bolhas");
  const [selected, setSelected] = useState<typeof municipiosAcre[0] | null>(null);

  return (
    <div className="flex h-screen flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-700 dark:bg-gray-800">
        <div>
          <h1 className="text-xl font-bold text-gray-800 dark:text-white">
            🗺️ IDEB por Município — Acre
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Índice de Desenvolvimento da Educação Básica
          </p>
        </div>

        {/* Toggle */}
        <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-100 p-1 dark:border-gray-600 dark:bg-gray-700">
          <button
            onClick={() => setViewMode("bolhas")}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-all ${
              viewMode === "bolhas"
                ? "bg-white text-blue-600 shadow dark:bg-gray-600 dark:text-blue-400"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
            }`}
          >
            🔵 Bolhas
          </button>
          <button
            onClick={() => setViewMode("lista")}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-all ${
              viewMode === "lista"
                ? "bg-white text-blue-600 shadow dark:bg-gray-600 dark:text-blue-400"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
            }`}
          >
            📋 Ranking
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Mapa */}
        {viewMode === "bolhas" && (
          <div className="relative flex-1">
            <MapContainer
              center={[-9.0, -70.0]}
              zoom={6}
              style={{ height: "100%", width: "100%" }}
              zoomControl={true}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {municipiosAcre.map((m) => (
                <CircleMarker
                  key={m.nome}
                  center={[m.lat, m.lng]}
                  radius={getRadius(m.populacao)}
                  fillColor={getColor(m.ideb)}
                  color="#fff"
                  weight={2}
                  opacity={1}
                  fillOpacity={0.85}
                  eventHandlers={{ click: () => setSelected(m) }}
                >
                  <Tooltip direction="top" offset={[0, -10]} opacity={0.95}>
                    <div className="text-sm">
                      <strong>{m.nome}</strong><br />
                      IDEB: <strong>{m.ideb}</strong>
                    </div>
                  </Tooltip>
                </CircleMarker>
              ))}
            </MapContainer>

            {/* Legenda */}
            <div className="absolute bottom-6 left-4 z-[1000] rounded-lg bg-white p-3 shadow-lg dark:bg-gray-800">
              <p className="mb-2 text-xs font-semibold text-gray-600 dark:text-gray-300">IDEB</p>
              {[
                { label: "≥ 5.0", color: "#22c55e" },
                { label: "4.5 – 4.9", color: "#84cc16" },
                { label: "4.0 – 4.4", color: "#eab308" },
                { label: "3.5 – 3.9", color: "#f97316" },
                { label: "< 3.5", color: "#ef4444" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                  <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                  {item.label}
                </div>
              ))}
              <hr className="my-2 border-gray-200" />
              <p className="text-xs text-gray-500">Tamanho = população</p>
            </div>

            {/* Card do município selecionado */}
            {selected && (
              <div className="absolute right-4 top-4 z-[1000] w-56 rounded-xl bg-white p-4 shadow-xl dark:bg-gray-800">
                <div className="mb-1 flex items-center justify-between">
                  <h3 className="font-bold text-gray-800 dark:text-white">{selected.nome}</h3>
                  <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600">✕</button>
                </div>
                <div className="mt-2 space-y-1 text-sm text-gray-600 dark:text-gray-300">
                  <p>📊 IDEB: <strong style={{ color: getColor(selected.ideb) }}>{selected.ideb}</strong></p>
                  <p>👥 População: <strong>{selected.populacao.toLocaleString("pt-BR")}</strong></p>
                </div>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-2 rounded-full transition-all"
                    style={{ width: `${(selected.ideb / 10) * 100}%`, backgroundColor: getColor(selected.ideb) }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Ranking */}
        {viewMode === "lista" && (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="mx-auto max-w-2xl">
              <h2 className="mb-4 text-lg font-semibold text-gray-700 dark:text-gray-200">
                Ranking IDEB — {municipiosAcre.length} municípios
              </h2>
              <div className="space-y-2">
                {[...municipiosAcre]
                  .sort((a, b) => b.ideb - a.ideb)
                  .map((m, i) => (
                    <div
                      key={m.nome}
                      className="flex items-center gap-4 rounded-lg bg-white p-3 shadow-sm dark:bg-gray-800"
                    >
                      <span className="w-6 text-center text-sm font-bold text-gray-400">#{i + 1}</span>
                      <span
                        className="h-4 w-4 flex-shrink-0 rounded-full"
                        style={{ backgroundColor: getColor(m.ideb) }}
                      />
                      <span className="flex-1 text-sm font-medium text-gray-700 dark:text-gray-200">{m.nome}</span>
                      <div className="w-32">
                        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                          <div
                            className="h-2 rounded-full"
                            style={{ width: `${(m.ideb / 6) * 100}%`, backgroundColor: getColor(m.ideb) }}
                          />
                        </div>
                      </div>
                      <span className="w-10 text-right text-sm font-bold" style={{ color: getColor(m.ideb) }}>
                        {m.ideb}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}