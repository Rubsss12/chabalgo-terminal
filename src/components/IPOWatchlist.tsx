"use client";

import { useEffect, useState } from "react";
import { formatLargeNumber } from "@/lib/format";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface RelatedStock {
  ticker: string;
  reason: string;
  price: number | null;
  change_pct: number;
  market_cap: number;
}

interface IPOEntry {
  company: string;
  sector: string;
  expected_date: string;
  valuation: string;
  valuation_num: number;
  exchange: string;
  status: string;
  description: string;
  hot: boolean;
  confidence: number;
  related_stocks: RelatedStock[];
}

export default function IPOWatchlist({
  onSelectTicker,
}: {
  onSelectTicker?: (ticker: string) => void;
}) {
  const [ipos, setIpos] = useState<IPOEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedIPO, setExpandedIPO] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "hot" | "ai" | "fintech">("all");

  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE}/ipo-watchlist`)
      .then((r) => r.json())
      .then((d) => setIpos(d.ipos || []))
      .catch(() => setIpos([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = ipos.filter((ipo) => {
    if (filter === "hot") return ipo.hot;
    if (filter === "ai") return ipo.sector.toLowerCase().includes("intelligence artificielle") || ipo.sector.toLowerCase().includes("data");
    if (filter === "fintech") return ipo.sector.toLowerCase().includes("fintech");
    return true;
  });

  const confidenceColor = (c: number) => {
    if (c >= 80) return "text-green";
    if (c >= 60) return "text-yellow";
    return "text-muted";
  };

  const confidenceBar = (c: number) => {
    if (c >= 80) return "bg-green";
    if (c >= 60) return "bg-yellow";
    return "bg-muted/30";
  };

  return (
    <div className="bg-card border border-border p-5">
      <div className="flex items-center justify-between mb-1">
        <div>
          <h3 className="text-accent text-xs font-semibold tracking-wider">
            IPO WATCHLIST 2026-2027
          </h3>
          <p className="text-muted text-[10px] mt-0.5">
            Les introductions en bourse majeures à surveiller + actions liées
          </p>
        </div>
        <div className="text-[10px] text-muted/50">
          Mis à jour : Avril 2026
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-1.5 mt-3 mb-4 flex-wrap">
        {(
          [
            { key: "all", label: "TOUS" },
            { key: "hot", label: "IMMINENTS" },
            { key: "ai", label: "IA" },
            { key: "fintech", label: "FINTECH" },
          ] as const
        ).map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`text-[10px] px-2.5 py-1 border transition-colors ${
              filter === f.key
                ? "border-accent text-accent bg-accent/5"
                : "border-border text-muted hover:text-foreground"
            }`}
          >
            {f.label}
            {f.key === "all" && ` (${ipos.length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-accent/20 border-t-accent rounded-full animate-spin" />
          <span className="text-accent text-xs ml-3 animate-pulse">
            Chargement des IPOs...
          </span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-muted text-sm py-8 text-center">
          Aucun IPO dans cette catégorie
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((ipo) => {
            const isExpanded = expandedIPO === ipo.company;
            return (
              <div
                key={ipo.company}
                className={`border transition-colors ${
                  ipo.hot
                    ? "border-accent/40 bg-accent/[0.02]"
                    : "border-border"
                }`}
              >
                {/* IPO Header Row */}
                <button
                  onClick={() =>
                    setExpandedIPO(isExpanded ? null : ipo.company)
                  }
                  className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-subtle/30 transition-colors"
                >
                  {/* Hot badge */}
                  <div className="flex-shrink-0 w-6">
                    {ipo.hot && (
                      <span className="text-accent text-sm" title="IPO imminent">
                        *
                      </span>
                    )}
                  </div>

                  {/* Company info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-foreground font-semibold text-sm">
                        {ipo.company}
                      </span>
                      {ipo.hot && (
                        <span className="text-[9px] px-1.5 py-0.5 bg-accent/10 text-accent border border-accent/20">
                          HOT
                        </span>
                      )}
                      <span className="text-[10px] text-muted">{ipo.sector}</span>
                    </div>
                    <div className="text-[10px] text-muted mt-0.5">
                      {ipo.status}
                    </div>
                  </div>

                  {/* Valuation */}
                  <div className="text-right flex-shrink-0">
                    <div className="text-xs font-semibold text-foreground">
                      {ipo.valuation}
                    </div>
                    <div className="text-[10px] text-muted">{ipo.exchange}</div>
                  </div>

                  {/* Expected date */}
                  <div className="text-right flex-shrink-0 w-20">
                    <div className="text-xs text-accent font-medium">
                      {ipo.expected_date}
                    </div>
                  </div>

                  {/* Confidence */}
                  <div className="flex-shrink-0 w-16 text-right">
                    <div
                      className={`text-xs font-semibold ${confidenceColor(
                        ipo.confidence
                      )}`}
                    >
                      {ipo.confidence}%
                    </div>
                    <div className="w-full h-1 bg-subtle rounded-full mt-0.5">
                      <div
                        className={`h-full rounded-full ${confidenceBar(
                          ipo.confidence
                        )}`}
                        style={{ width: `${ipo.confidence}%` }}
                      />
                    </div>
                  </div>

                  {/* Chevron */}
                  <svg
                    className={`w-4 h-4 text-muted flex-shrink-0 transition-transform ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-border/50">
                    {/* Description */}
                    <div className="mt-3 mb-4">
                      <div className="bg-subtle/50 border-l-2 border-accent/30 pl-3 pr-3 py-2.5">
                        <div className="text-accent/60 text-[9px] font-semibold tracking-[0.15em] mb-1.5">
                          ANALYSE
                        </div>
                        <p className="text-[11px] text-muted leading-[1.7]">
                          {ipo.description}
                        </p>
                      </div>
                    </div>

                    {/* Related stocks to watch */}
                    {ipo.related_stocks.length > 0 && (
                      <div>
                        <div className="text-[10px] text-muted tracking-wider mb-2">
                          ACTIONS À SURVEILLER
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-muted border-b border-border text-right">
                                <th className="pb-1.5 text-left font-normal pr-2">
                                  TICKER
                                </th>
                                <th className="pb-1.5 font-normal pr-2">
                                  PRIX
                                </th>
                                <th className="pb-1.5 font-normal pr-2">
                                  CHG%
                                </th>
                                <th className="pb-1.5 font-normal pr-2">
                                  MCAP
                                </th>
                                <th className="pb-1.5 text-left font-normal">
                                  POURQUOI SURVEILLER
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {ipo.related_stocks.map((stock) => (
                                <tr
                                  key={stock.ticker}
                                  className="border-b border-border/30 hover:bg-subtle/30 transition-colors cursor-pointer"
                                  onClick={() =>
                                    onSelectTicker?.(stock.ticker)
                                  }
                                >
                                  <td className="py-2 pr-2">
                                    <span className="text-accent font-semibold">
                                      {stock.ticker}
                                    </span>
                                  </td>
                                  <td className="py-2 pr-2 text-right text-foreground">
                                    {stock.price
                                      ? `$${stock.price.toFixed(2)}`
                                      : "--"}
                                  </td>
                                  <td
                                    className={`py-2 pr-2 text-right ${
                                      stock.change_pct >= 0
                                        ? "text-green"
                                        : "text-red"
                                    }`}
                                  >
                                    {stock.change_pct >= 0 ? "+" : ""}
                                    {stock.change_pct.toFixed(1)}%
                                  </td>
                                  <td className="py-2 pr-2 text-right text-muted">
                                    {stock.market_cap
                                      ? formatLargeNumber(stock.market_cap)
                                      : "--"}
                                  </td>
                                  <td className="py-2 text-left text-muted text-[10px] max-w-[300px]">
                                    {stock.reason}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Timeline visualization */}
      {!loading && ipos.length > 0 && (
        <div className="mt-5 pt-4 border-t border-border">
          <div className="text-[10px] text-muted tracking-wider mb-3">
            TIMELINE ESTIMÉE
          </div>
          <div className="relative">
            {/* Timeline bar */}
            <div className="h-1 bg-subtle rounded-full w-full" />
            <div className="flex justify-between text-[9px] text-muted/50 mt-1 mb-3">
              <span>H1 2026</span>
              <span>H2 2026</span>
              <span>H1 2027</span>
              <span>2027+</span>
            </div>

            {/* IPO markers */}
            <div className="flex flex-wrap gap-1.5">
              {ipos
                .sort((a, b) => b.confidence - a.confidence)
                .map((ipo) => {
                  const pos = ipo.expected_date.includes("H1 2026")
                    ? 0
                    : ipo.expected_date.includes("H2 2026")
                    ? 1
                    : ipo.expected_date.includes("H1 2027") ||
                      ipo.expected_date.includes("début 2027")
                    ? 2
                    : 3;
                  return (
                    <button
                      key={ipo.company}
                      onClick={() =>
                        setExpandedIPO(
                          expandedIPO === ipo.company ? null : ipo.company
                        )
                      }
                      className={`text-[9px] px-2 py-0.5 border transition-colors ${
                        ipo.hot
                          ? "border-accent/40 text-accent bg-accent/5 hover:bg-accent/10"
                          : "border-border text-muted hover:text-foreground"
                      }`}
                      style={{
                        marginLeft: `${pos * 8}%`,
                      }}
                    >
                      {ipo.company.split(" / ")[0]}
                      <span className="ml-1 opacity-50">
                        {ipo.confidence}%
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      <div className="mt-3 text-[9px] text-muted/40">
        Les dates et valorisations sont des estimations basées sur les
        informations publiques disponibles en avril 2026. Le % de confiance
        reflète la probabilité que l&apos;IPO ait lieu dans la fenêtre
        annoncée.
      </div>
    </div>
  );
}
