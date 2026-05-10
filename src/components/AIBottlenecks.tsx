"use client";

import { useState, useEffect } from "react";
import { API_BASE } from "../lib/apiBase";

interface Stock {
  ticker: string;
  name: string;
  share?: string;
  moat?: string;
  thesis?: string;
  quote?: {
    price: number;
    change_pct: number;
    currency: string | null;
  };
}

interface Bottleneck {
  id: string;
  name: string;
  category: string;
  criticality: number;
  horizon: string;
  thesis: string;
  supply_concentration: string;
  leaders: Stock[];
  challengers: Stock[];
  risks: string[];
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  "Photonics": { bg: "bg-blue-500/8", text: "text-blue-600", border: "border-blue-500/20" },
  "Memory": { bg: "bg-purple-500/8", text: "text-purple-600", border: "border-purple-500/20" },
  "Semiconductor Manufacturing": { bg: "bg-accent/8", text: "text-accent", border: "border-accent/20" },
  "Semiconductor Equipment": { bg: "bg-emerald-500/8", text: "text-emerald-600", border: "border-emerald-500/20" },
  "Networking": { bg: "bg-cyan-500/8", text: "text-cyan-600", border: "border-cyan-500/20" },
  "Infrastructure": { bg: "bg-amber-500/8", text: "text-amber-600", border: "border-amber-500/20" },
  "Semiconductors": { bg: "bg-indigo-500/8", text: "text-indigo-600", border: "border-indigo-500/20" },
  "Raw Materials": { bg: "bg-stone-500/8", text: "text-stone-600", border: "border-stone-500/20" },
  "Packaging Materials": { bg: "bg-rose-500/8", text: "text-rose-600", border: "border-rose-500/20" },
};

function CriticalityBadge({ value }: { value: number }) {
  let color = "bg-yellow/15 text-yellow border-yellow/30";
  let label = "MED";
  if (value >= 90) { color = "bg-red/15 text-red border-red/30"; label = "EXTREME"; }
  else if (value >= 80) { color = "bg-accent/15 text-accent border-accent/30"; label = "HIGH"; }
  else if (value >= 70) { color = "bg-yellow/15 text-yellow border-yellow/30"; label = "MED-HIGH"; }
  return (
    <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold tracking-wider border ${color}`}>
      {label} · {value}
    </span>
  );
}

function StockChip({ stock, onSearch, isLeader }: { stock: Stock; onSearch?: (t: string) => void; isLeader: boolean }) {
  const change = stock.quote?.change_pct;
  const colorClass = change == null ? "text-muted" : change > 0 ? "text-green" : change < 0 ? "text-red" : "text-muted";
  const cur = stock.quote?.currency;
  const sym = cur === "USD" ? "$" : cur === "EUR" ? "€" : cur === "GBP" ? "£" : cur === "JPY" ? "¥" : cur === "KRW" ? "₩" : "";

  return (
    <button
      onClick={() => onSearch?.(stock.ticker)}
      className={`w-full text-left p-3 rounded-lg border transition-all hover:shadow-md ${
        isLeader
          ? "bg-accent/5 border-accent/15 hover:border-accent/30 hover:bg-accent/10"
          : "bg-card border-border hover:border-accent/30 hover:bg-subtle/30"
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`font-bold font-mono text-xs ${isLeader ? "text-accent" : "text-foreground"}`}>{stock.ticker}</span>
          {stock.share && (
            <span className="text-[9px] bg-foreground/5 px-1.5 py-0.5 rounded text-muted font-bold">{stock.share}</span>
          )}
        </div>
        {stock.quote && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-xs font-semibold text-foreground tabular-nums">
              {sym}{stock.quote.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </span>
            <span className={`text-[10px] font-bold tabular-nums ${colorClass}`}>
              {change != null ? `${change > 0 ? "+" : ""}${change.toFixed(1)}%` : ""}
            </span>
          </div>
        )}
      </div>
      <div className="text-[11px] text-muted/80 truncate">{stock.name}</div>
      {(stock.moat || stock.thesis) && (
        <div className="text-[10px] text-muted/60 leading-relaxed mt-1.5 line-clamp-2">{stock.moat || stock.thesis}</div>
      )}
    </button>
  );
}

interface AIBottlenecksProps {
  onSearch?: (ticker: string) => void;
}

export default function AIBottlenecks({ onSearch }: AIBottlenecksProps) {
  const [bottlenecks, setBottlenecks] = useState<Bottleneck[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [enriched, setEnriched] = useState<Record<string, Bottleneck>>({});
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    fetch(`${API_BASE}/ai-bottlenecks`)
      .then((r) => r.json())
      .then((d) => {
        setBottlenecks(d.bottlenecks || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Enrich a bottleneck with live quotes when expanded
  useEffect(() => {
    if (!activeId || enriched[activeId]) return;
    fetch(`${API_BASE}/ai-bottlenecks/${activeId}`)
      .then((r) => r.json())
      .then((d) => setEnriched((prev) => ({ ...prev, [activeId]: d })))
      .catch(() => {});
  }, [activeId, enriched]);

  const categories = ["all", ...Array.from(new Set(bottlenecks.map((b) => b.category)))];
  const filtered = filter === "all" ? bottlenecks : bottlenecks.filter((b) => b.category === filter);
  // Sort by criticality desc
  filtered.sort((a, b) => b.criticality - a.criticality);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-1 h-4 bg-accent rounded-full" />
          <span className="text-xs font-bold tracking-wider text-foreground">AI BOTTLENECKS</span>
          <span className="text-[9px] bg-red/10 text-red px-2 py-0.5 rounded-md font-bold tracking-wider">VALUE CHAIN</span>
        </div>
        <span className="text-[10px] text-muted">
          {bottlenecks.length} chokepoints across the AI infrastructure stack
        </span>
      </div>

      {/* Category filter */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-border bg-subtle/30 overflow-x-auto scrollbar-none">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            className={`text-[10px] px-2.5 py-1 rounded-md font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
              filter === c
                ? "bg-accent/10 text-accent ring-1 ring-accent/20"
                : "text-muted hover:text-foreground hover:bg-card"
            }`}
          >
            {c === "all" ? "All" : c}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="p-12 flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-accent/20 border-t-accent rounded-full animate-spin" />
          <span className="text-xs text-muted">Loading bottlenecks...</span>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {filtered.map((b) => {
            const isOpen = activeId === b.id;
            const data = enriched[b.id] || b;
            const cat = CATEGORY_COLORS[b.category] || { bg: "bg-subtle", text: "text-muted", border: "border-border" };
            return (
              <div key={b.id} className="hover:bg-subtle/20 transition-colors">
                {/* Header — always visible */}
                <button
                  onClick={() => setActiveId(isOpen ? null : b.id)}
                  className="w-full p-4 text-left flex items-start gap-3 sm:gap-4"
                >
                  <div className={`w-12 h-12 rounded-xl ${cat.bg} ${cat.border} border flex items-center justify-center flex-shrink-0`}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-sm font-bold text-foreground">{b.name}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold tracking-wider ${cat.bg} ${cat.text}`}>
                        {b.category}
                      </span>
                      <CriticalityBadge value={b.criticality} />
                      <span className="text-[10px] text-muted/60 font-mono">{b.horizon}</span>
                    </div>
                    <div className="text-xs text-muted leading-relaxed line-clamp-2">{b.thesis}</div>
                    {/* Leader tickers preview */}
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      {b.leaders.slice(0, 3).map((l) => (
                        <span key={l.ticker} className="text-[10px] font-mono font-bold text-accent bg-accent/8 px-1.5 py-0.5 rounded">
                          {l.ticker}
                        </span>
                      ))}
                      {b.leaders.length > 3 && (
                        <span className="text-[10px] text-muted/50">+{b.leaders.length - 3}</span>
                      )}
                    </div>
                  </div>
                  <svg className={`w-4 h-4 text-muted flex-shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Expanded view */}
                {isOpen && (
                  <div className="px-4 pb-5 space-y-4 fade-in">
                    {/* Full thesis */}
                    <div className="bg-subtle/50 border-l-2 border-accent/30 px-3 py-2.5 rounded-r-lg">
                      <div className="text-[9px] text-accent/70 font-bold tracking-wider mb-1">THESIS</div>
                      <p className="text-xs text-foreground/80 leading-relaxed">{b.thesis}</p>
                    </div>

                    {/* Supply concentration */}
                    <div>
                      <div className="text-[9px] text-muted/50 tracking-wider font-bold mb-1.5">SUPPLY CONCENTRATION</div>
                      <p className="text-[11px] text-muted leading-relaxed">{b.supply_concentration}</p>
                    </div>

                    {/* Leaders */}
                    <div>
                      <div className="text-[9px] text-muted/50 tracking-wider font-bold mb-2 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                        MARKET LEADERS · DOMINATE TODAY
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {data.leaders.map((s) => (
                          <StockChip key={s.ticker} stock={s} onSearch={onSearch} isLeader />
                        ))}
                      </div>
                    </div>

                    {/* Challengers */}
                    {data.challengers.length > 0 && (
                      <div>
                        <div className="text-[9px] text-muted/50 tracking-wider font-bold mb-2 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-yellow" />
                          CHALLENGERS · COULD CAPTURE SHARE
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {data.challengers.map((s) => (
                            <StockChip key={s.ticker} stock={s} onSearch={onSearch} isLeader={false} />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Risks */}
                    {b.risks.length > 0 && (
                      <div>
                        <div className="text-[9px] text-muted/50 tracking-wider font-bold mb-1.5">RISKS TO THE THESIS</div>
                        <ul className="text-[11px] text-muted space-y-1">
                          {b.risks.map((r, i) => (
                            <li key={i} className="flex items-start gap-1.5">
                              <span className="text-red/60 flex-shrink-0">⚠</span>
                              <span>{r}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
