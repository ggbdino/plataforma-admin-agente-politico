"use client";

import { useMemo, useState } from "react";
import type { CampaignCityMetric, CampaignRegionalMetric } from "@/lib/types";

type CampaignTerritorialPanelProps = {
  regional: CampaignRegionalMetric[];
  cities: CampaignCityMetric[];
  invalidUfTotal: number;
};

type PieSegment = {
  uf: string;
  color: string;
  d: string;
};

const TERRITORIAL_COLORS = [
  "#ff7a59",
  "#ffa94d",
  "#ffd43b",
  "#69db7c",
  "#38d9a9",
  "#4dabf7",
  "#748ffc",
  "#da77f2",
  "#f06595",
  "#20c997",
  "#339af0",
  "#845ef7"
];

export function CampaignTerritorialPanel({
  regional,
  cities,
  invalidUfTotal
}: CampaignTerritorialPanelProps) {
  const visibleRegional = regional.filter((item) => item.total > 0);
  const initialUf = visibleRegional[0]?.uf ?? regional[0]?.uf ?? "DF";
  const [selectedUf, setSelectedUf] = useState(initialUf);
  const totalUsuarios = regional.reduce((sum, item) => sum + item.total, 0);
  const totalForPie = Math.max(totalUsuarios, 1);
  const selectedRegional = regional.find((item) => item.uf === selectedUf) ?? regional[0] ?? null;
  const selectedCities = cities
    .filter((item) => item.uf === selectedUf)
    .sort((left, right) => right.total - left.total || left.cidade.localeCompare(right.cidade))
    .slice(0, 12);
  const pieSegments = useMemo(
    () => buildPieSegments(visibleRegional, totalForPie),
    [visibleRegional, totalForPie]
  );

  return (
    <article className="card analytics-panel territorial-panel">
      <div className="section-heading">
        <div>
          <h2 className="section-title">Distribuição territorial da base</h2>
          <p className="subtitle">
            Pizza por UF oficial do Brasil e leitura das cidades com maior quantidade de usuários.
          </p>
        </div>
        <span className={`pill ${invalidUfTotal > 0 ? "warn" : "ok"}`}>
          {invalidUfTotal > 0 ? `${invalidUfTotal} UF inválida(s)` : "UF validada"}
        </span>
      </div>

      <div className="territorial-layout">
        <div className="territorial-pie-column">
          <div aria-label="Distribuição por unidade da federação" className="territorial-pie">
            <svg className="territorial-pie-svg" viewBox="0 0 100 100" role="img">
              {pieSegments.length ? (
                pieSegments.map((segment) => (
                  <path
                    d={segment.d}
                    fill={segment.color}
                    key={segment.uf}
                    onFocus={() => setSelectedUf(segment.uf)}
                    onMouseEnter={() => setSelectedUf(segment.uf)}
                    tabIndex={0}
                  >
                    <title>{segment.uf}</title>
                  </path>
                ))
              ) : (
                <circle cx="50" cy="50" fill="#dbeafe" r="50" />
              )}
            </svg>
            <div className="territorial-pie-center">
              <strong>{totalUsuarios}</strong>
              <span>usuários</span>
            </div>
          </div>

          <div className="territorial-uf-grid">
            {regional.map((item, index) => {
              const active = item.uf === selectedUf;
              return (
                <button
                  className={`territorial-uf-chip ${active ? "active" : ""}`}
                  key={item.uf}
                  onFocus={() => setSelectedUf(item.uf)}
                  onMouseEnter={() => setSelectedUf(item.uf)}
                  onClick={() => setSelectedUf(item.uf)}
                  type="button"
                >
                  <span
                    className="territorial-dot"
                    style={{ background: getTerritorialColor(index) }}
                  />
                  <strong>{item.uf}</strong>
                  <span>{item.total}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="territorial-table-panel">
          <div className="territorial-table-head">
            <div>
              <strong>{selectedRegional?.uf ?? "UF"}</strong>
              <span>
                {selectedRegional?.cidade_destaque ?? "Cidade não informada"} em destaque
              </span>
            </div>
            <span className="pill">
              {selectedRegional ? formatPercent(selectedRegional.taxa_conversao_percentual) : "0.00%"}
            </span>
          </div>

          <div className="territorial-summary-grid">
            <div>
              <span>Total</span>
              <strong>{selectedRegional?.total ?? 0}</strong>
            </div>
            <div>
              <span>Apoiadores</span>
              <strong>{selectedRegional?.apoiadores ?? 0}</strong>
            </div>
            <div>
              <span>Cidades</span>
              <strong>{selectedRegional?.cidades_mapeadas ?? 0}</strong>
            </div>
          </div>

          <div className="territorial-city-table" role="table">
            <div className="territorial-city-row territorial-city-header" role="row">
              <span>Cidade</span>
              <span>Usuários</span>
            </div>
            {selectedCities.length ? (
              selectedCities.map((city) => (
                <div className="territorial-city-row" key={`${city.uf}-${city.cidade}`} role="row">
                  <span>{city.cidade}</span>
                  <strong>{city.total}</strong>
                </div>
              ))
            ) : (
              <div className="territorial-city-empty">Sem cidades mapeadas para esta UF.</div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function buildPieSegments(items: CampaignRegionalMetric[], total: number): PieSegment[] {
  let start = 0;

  return items.map((item, index) => {
    const degrees = (item.total / total) * 360;
    const end = start + degrees;
    const color = getTerritorialColor(index);
    const d = describePieSlice(50, 50, 50, start, Math.min(end, 359.999));
    start = end;

    return {
      uf: item.uf,
      color,
      d
    };
  });
}

function describePieSlice(cx: number, cy: number, radius: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, radius, endAngle);
  const end = polarToCartesian(cx, cy, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

  return [
    `M ${cx} ${cy}`,
    `L ${start.x} ${start.y}`,
    `A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`,
    "Z"
  ].join(" ");
}

function polarToCartesian(cx: number, cy: number, radius: number, angleInDegrees: number) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;

  return {
    x: cx + radius * Math.cos(angleInRadians),
    y: cy + radius * Math.sin(angleInRadians)
  };
}

function getTerritorialColor(index: number) {
  return TERRITORIAL_COLORS[index % TERRITORIAL_COLORS.length];
}

function formatPercent(value: number) {
  return `${Number(value || 0).toFixed(2)}%`;
}