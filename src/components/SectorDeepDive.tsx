"use client";

import { useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Stock {
  ticker: string;
  name: string;
  price: number | null;
  change_pct: number;
  market_cap_b: number | null;
  pe: number | null;
  forward_pe: number | null;
  revenue_growth: number | null;
  gross_margin: number | null;
  profit_margin: number | null;
  rsi: number | null;
  signal: string;
  return_1m: number | null;
  return_3m: number | null;
  return_6m: number | null;
  volume_vs_avg: number | null;
  analyst_target: number | null;
  upside_pct: number | null;
  beta: number | null;
}

interface TopPick {
  ticker: string;
  name: string;
  price: number;
  conviction: string;
  score: number;
  reasoning: string;
  entry_zone: { low: number; high: number };
  target: number;
  stop_loss: number;
  risk_reward: string;
  return_6m: number | null;
  rsi: number | null;
}

interface Catalyst {
  event: string;
  date: string;
  impact: string;
  description: string;
}

interface NewsItem {
  headline: string;
  source: string;
  url: string;
  datetime: number;
  summary: string;
  related_ticker: string;
}

interface RiskFactor {
  name: string;
  level: string;
  detail: string;
}

interface Expert {
  name: string;
  platform: string;
  handle: string;
  focus: string;
  why_follow: string;
}

interface Bottleneck {
  name: string;
  severity: string;
  detail: string;
}

interface KeyPlayer {
  ticker: string;
  role: string;
  moat: string;
}

interface DeepDiveData {
  sector_key: string;
  generated_at: string;
  thesis: {
    headline: string;
    why_now: string;
    bull_case: string;
    bear_case: string;
    conviction: string;
    conviction_score: number;
  };
  stocks: Stock[];
  news: NewsItem[];
  catalysts: Catalyst[];
  top_picks: TopPick[];
  experts: Expert[];
  bottlenecks: Bottleneck[];
  key_players: KeyPlayer[];
  performance: {
    avg_return_1d: number | null;
    avg_return_1m: number | null;
    avg_return_3m: number | null;
    avg_return_6m: number | null;
    avg_rsi: number | null;
    avg_pe: number | null;
    avg_revenue_growth: number | null;
    avg_profit_margin: number | null;
    sector_beta: number | null;
    best_performer: { ticker: string; return_6m: number } | null;
    worst_performer: { ticker: string; return_6m: number } | null;
    stock_count: number;
  };
  risks: {
    overall_risk: string;
    risk_score: number;
    factors: RiskFactor[];
    max_drawdown_estimate: string;
    position_sizing: string;
  };
}

type SortKey = "ticker" | "price" | "change_pct" | "rsi" | "pe" | "revenue_growth" | "return_3m" | "signal" | "upside_pct";

export default function SectorDeepDive({
  sectorKey,
  onClose,
  onSearch,
}: {
  sectorKey: string;
  onClose: () => void;
  onSearch: (ticker: string) => void;
}) {
  const [data, setData] = useState<DeepDiveData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("change_pct");
  const [sortAsc, setSortAsc] = useState(false);
  const [retPeriod, setRetPeriod] = useState<"1m" | "3m" | "6m">("3m");

  useEffect(() => {
    setLoading(true);
    setError("");
    fetch(`${API_BASE}/sector-deepdive/${sectorKey}`)
      .then((r) => {
        if (!r.ok) throw new Error("Deep dive unavailable");
        return r.json();
      })
      .then((d) => setData(d))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [sectorKey]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const sortedStocks = data
    ? [...data.stocks].sort((a, b) => {
        const av = a[sortKey] ?? -Infinity;
        const bv = b[sortKey] ?? -Infinity;
        const cmp = av < bv ? -1 : av > bv ? 1 : 0;
        return sortAsc ? cmp : -cmp;
      })
    : [];

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 pb-10">
        <div className="flex flex-col items-center justify-center py-24">
          <div className="w-12 h-12 border-2 border-accent/20 border-t-accent rounded-full animate-spin mb-5" />
          <div className="text-accent text-xs tracking-[0.3em] animate-pulse mb-1">SECTOR DEEP DIVE</div>
          <div className="text-muted text-[11px]">Aggregating data across all sector stocks...</div>
          <div className="mt-8 grid grid-cols-3 gap-3 w-full max-w-lg">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-16 bg-subtle/50 rounded-xl animate-pulse" style={{ animationDelay: `${i * 0.1}s` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-7xl mx-auto px-6 pb-10">
        <div className="border border-red/30 bg-red/5 p-6 rounded-xl text-center">
          <div className="text-red text-sm font-medium mb-2">Deep Dive Failed</div>
          <div className="text-red/70 text-xs">{error || "No data"}</div>
          <button onClick={onClose} className="mt-4 text-accent text-xs hover:underline">Back to Dashboard</button>
        </div>
      </div>
    );
  }

  const convColor = data.thesis.conviction === "HIGH" ? "text-green" : data.thesis.conviction === "MEDIUM" ? "text-yellow" : "text-red";
  const convBg = data.thesis.conviction === "HIGH" ? "bg-green/10 border-green/20" : data.thesis.conviction === "MEDIUM" ? "bg-yellow/10 border-yellow/20" : "bg-red/10 border-red/20";
  const riskColor = (level: string) => level === "high" ? "text-red" : level === "medium" ? "text-yellow" : "text-green";
  const riskBg = (level: string) => level === "high" ? "bg-red/8 border-red/20" : level === "medium" ? "bg-yellow/8 border-yellow/20" : "bg-green/8 border-green/20";
  const impactColor = (impact: string) => impact === "very_high" ? "bg-red" : impact === "high" ? "bg-accent" : impact === "medium" ? "bg-yellow" : "bg-muted/30";

  const retKey = retPeriod === "1m" ? "return_1m" : retPeriod === "3m" ? "return_3m" : "return_6m";

  return (
    <div className="max-w-7xl mx-auto px-6 pb-10 space-y-5">
      {/* ===== NAVIGATION BAR ===== */}
      <div className="flex items-center justify-between bg-card border border-border px-4 py-2.5 rounded-xl">
        <button onClick={onClose} className="flex items-center gap-2 text-muted hover:text-accent transition-colors text-[11px] tracking-wider group">
          <svg className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          DASHBOARD
        </button>
        <div className="flex items-center gap-3">
          <span className={`text-[9px] px-2 py-0.5 rounded-xl font-bold tracking-wider border ${convBg} ${convColor}`}>
            {data.thesis.conviction} CONVICTION
          </span>
          <span className="text-accent text-xs font-semibold tracking-wide">{data.sector_key}</span>
        </div>
      </div>

      {/* ===== THESIS / HERO SECTION ===== */}
      <div className="bg-gradient-to-br from-accent/8 via-accent/4 to-transparent border border-accent/15 rounded-xl p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-[9px] text-accent/60 tracking-[0.2em] mb-1">SECTOR DEEP DIVE</div>
            <h1 className="text-lg font-bold text-foreground leading-tight">{data.thesis.headline}</h1>
          </div>
          <div className="text-right flex-shrink-0 ml-4">
            <div className="text-3xl font-black text-accent">{data.thesis.conviction_score}</div>
            <div className="text-[8px] text-muted/50 tracking-wider">CONVICTION</div>
          </div>
        </div>

        <p className="text-[12px] text-foreground/80 leading-relaxed mb-5 max-w-3xl">{data.thesis.why_now}</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-green/5 border border-green/15 rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <svg className="w-3.5 h-3.5 text-green" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <span className="text-[10px] text-green font-bold tracking-wider">BULL CASE</span>
            </div>
            <p className="text-[10px] text-foreground/70 leading-relaxed">{data.thesis.bull_case}</p>
          </div>
          <div className="bg-red/5 border border-red/15 rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <svg className="w-3.5 h-3.5 text-red" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 17V7m0 0L6 14m7-7l7 7" />
              </svg>
              <span className="text-[10px] text-red font-bold tracking-wider">BEAR CASE</span>
            </div>
            <p className="text-[10px] text-foreground/70 leading-relaxed">{data.thesis.bear_case}</p>
          </div>
        </div>
      </div>

      {/* ===== SCORECARD STRIP ===== */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
        {[
          { label: "Stocks", value: data.performance.stock_count, suffix: "" },
          { label: "Avg Return 1D", value: data.performance.avg_return_1d, suffix: "%", color: true },
          { label: "Avg Return 1M", value: data.performance.avg_return_1m, suffix: "%", color: true },
          { label: "Avg Return 3M", value: data.performance.avg_return_3m, suffix: "%", color: true },
          { label: "Avg RSI", value: data.performance.avg_rsi, suffix: "" },
          { label: "Avg PE", value: data.performance.avg_pe, suffix: "x" },
          { label: "Avg Rev Growth", value: data.performance.avg_revenue_growth, suffix: "%" },
          { label: "Beta", value: data.performance.sector_beta, suffix: "" },
        ].map((m) => (
          <div key={m.label} className="bg-card border border-border rounded-xl px-3 py-2.5 text-center">
            <div className="text-[8px] text-muted/50 tracking-wider mb-1">{m.label.toUpperCase()}</div>
            <div className={`text-sm font-bold ${
              m.color && m.value != null ? (Number(m.value) >= 0 ? "text-green" : "text-red") : "text-foreground"
            }`}>
              {m.value != null ? `${m.color && Number(m.value) >= 0 ? "+" : ""}${Number(m.value).toFixed(1)}${m.suffix}` : "—"}
            </div>
          </div>
        ))}
      </div>

      {/* ===== PERFORMANCE HEATMAP ===== */}
      <div className="bg-card border border-border rounded-xl">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-1 h-4 bg-accent rounded-full" />
            <span className="text-[11px] font-semibold tracking-wider">SECTOR HEATMAP</span>
          </div>
          <div className="flex gap-1">
            {(["1m", "3m", "6m"] as const).map((p) => (
              <button key={p} onClick={() => setRetPeriod(p)} className={`px-2 py-0.5 text-[9px] tracking-wider rounded-xl transition-colors ${
                retPeriod === p ? "bg-accent text-white" : "text-muted/50 hover:text-muted"
              }`}>{p.toUpperCase()}</button>
            ))}
          </div>
        </div>
        <div className="p-4 grid grid-cols-2 md:grid-cols-5 gap-2">
          {data.stocks.map((s) => {
            const ret = s[retKey as keyof Stock] as number | null;
            const intensity = ret != null ? Math.min(Math.abs(ret) / 50, 1) : 0;
            const bg = ret == null ? "bg-subtle" : ret >= 0
              ? `rgba(45,139,78,${0.1 + intensity * 0.3})`
              : `rgba(192,57,43,${0.1 + intensity * 0.3})`;
            return (
              <button
                key={s.ticker}
                onClick={() => onSearch(s.ticker)}
                className="rounded-xl p-2.5 text-left transition-all hover:scale-[1.02] hover:shadow-md border border-transparent hover:border-border"
                style={{ backgroundColor: typeof bg === "string" && bg.startsWith("rgba") ? bg : undefined }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-foreground">{s.ticker}</span>
                  {s.market_cap_b && <span className="text-[8px] text-muted/40">${s.market_cap_b}B</span>}
                </div>
                <div className={`text-sm font-bold mt-0.5 ${ret != null && ret >= 0 ? "text-green" : "text-red"}`}>
                  {ret != null ? `${ret >= 0 ? "+" : ""}${ret.toFixed(1)}%` : "—"}
                </div>
                <div className="text-[8px] text-muted/50 mt-0.5">${s.price?.toFixed(2) ?? "—"}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ===== KEY PLAYERS + EXPERTS ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Key Players */}
        {data.key_players.length > 0 && (
          <div className="lg:col-span-3 bg-card border border-border rounded-xl">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <div className="w-1 h-4 bg-accent rounded-full" />
              <span className="text-[11px] font-semibold tracking-wider">KEY PLAYERS</span>
              <span className="text-[9px] text-muted/40 tracking-wider">WHO TO WATCH</span>
            </div>
            <div className="p-4 space-y-2">
              {data.key_players.map((kp) => (
                <button
                  key={kp.ticker}
                  onClick={() => onSearch(kp.ticker)}
                  className="w-full text-left flex items-start gap-3 p-3 bg-subtle/30 rounded-xl hover:bg-accent/5 transition-colors group"
                >
                  <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-accent/20 transition-colors">
                    <span className="text-accent text-[10px] font-black tracking-wider">{kp.ticker}</span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-accent group-hover:underline">{kp.ticker}</span>
                      <span className="text-[9px] text-muted/60">{kp.role}</span>
                    </div>
                    <div className="text-[10px] text-foreground/60 leading-relaxed mt-0.5">{kp.moat}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Experts to Follow */}
        {data.experts.length > 0 && (
          <div className="lg:col-span-2 bg-card border border-border rounded-xl">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <div className="w-1 h-4 bg-accent rounded-full" />
              <span className="text-[11px] font-semibold tracking-wider">EXPERTS</span>
              <span className="text-[9px] text-muted/40 tracking-wider">TO FOLLOW</span>
            </div>
            <div className="p-4 space-y-3">
              {data.experts.map((ex, i) => (
                <div key={i} className="border border-border/50 rounded-xl p-3 hover:border-accent/20 transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-bold text-foreground">{ex.name}</span>
                    <span className="text-[8px] px-1.5 py-0.5 bg-accent/8 text-accent/70 rounded-xl tracking-wider">{ex.platform}</span>
                  </div>
                  <div className="text-[9px] text-accent/60 font-mono mb-1.5">{ex.handle}</div>
                  <div className="text-[9px] text-foreground/50 leading-relaxed">{ex.why_follow}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ===== TOP PICKS ===== */}
      <div className="bg-card border border-border rounded-xl">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <div className="w-1 h-4 bg-accent rounded-full" />
          <span className="text-[11px] font-semibold tracking-wider">TOP PICKS</span>
          <span className="text-[9px] text-muted/40 tracking-wider">TRADE IDEAS</span>
        </div>
        <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          {data.top_picks.map((pick, i) => {
            const pickConvColor = pick.conviction === "HIGH" ? "border-green/30 bg-green/3" : pick.conviction === "MEDIUM" ? "border-yellow/30 bg-yellow/3" : "border-border";
            const badgeColor = pick.conviction === "HIGH" ? "bg-green/10 text-green border-green/20" : pick.conviction === "MEDIUM" ? "bg-yellow/10 text-yellow border-yellow/20" : "bg-subtle text-muted border-border";
            // Entry zone bar
            const range = pick.target - pick.stop_loss;
            const pricePos = range > 0 ? ((pick.price - pick.stop_loss) / range) * 100 : 50;
            const entryLowPos = range > 0 ? ((pick.entry_zone.low - pick.stop_loss) / range) * 100 : 30;
            const entryHighPos = range > 0 ? ((pick.entry_zone.high - pick.stop_loss) / range) * 100 : 50;

            return (
              <div key={pick.ticker} className={`border-2 rounded-xl p-4 ${pickConvColor}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-muted/40">#{i + 1}</span>
                    <button onClick={() => onSearch(pick.ticker)} className="text-accent font-bold text-sm tracking-wider hover:underline">
                      {pick.ticker}
                    </button>
                  </div>
                  <span className={`text-[8px] px-1.5 py-0.5 rounded-xl font-bold tracking-wider border ${badgeColor}`}>
                    {pick.conviction}
                  </span>
                </div>

                <div className="text-[10px] text-muted/50 mb-3 truncate">{pick.name}</div>

                <div className="text-[10px] text-foreground/70 leading-relaxed mb-3">{pick.reasoning}</div>

                {/* Price range bar */}
                <div className="mb-3">
                  <div className="relative h-2 bg-subtle rounded-full overflow-hidden">
                    {/* Entry zone highlight */}
                    <div className="absolute h-full bg-accent/20 rounded-full" style={{ left: `${Math.max(0, entryLowPos)}%`, width: `${Math.max(1, entryHighPos - entryLowPos)}%` }} />
                    {/* Current price dot */}
                    <div className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-foreground rounded-full border-2 border-card shadow-sm" style={{ left: `${Math.max(2, Math.min(98, pricePos))}%`, transform: "translate(-50%, -50%)" }} />
                  </div>
                  <div className="flex justify-between mt-1 text-[8px] text-muted/40">
                    <span>SL ${pick.stop_loss}</span>
                    <span className="text-accent">Entry ${pick.entry_zone.low}-${pick.entry_zone.high}</span>
                    <span className="text-green">TP ${pick.target}</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-[8px] text-muted/40">PRICE</div>
                    <div className="text-[11px] font-bold">${pick.price.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-[8px] text-muted/40">R:R</div>
                    <div className="text-[11px] font-bold text-accent">{pick.risk_reward}</div>
                  </div>
                  <div>
                    <div className="text-[8px] text-muted/40">RSI</div>
                    <div className="text-[11px] font-bold">{pick.rsi?.toFixed(0) ?? "—"}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ===== CATALYSTS TIMELINE ===== */}
      <div className="bg-card border border-border rounded-xl">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <div className="w-1 h-4 bg-accent rounded-full" />
          <span className="text-[11px] font-semibold tracking-wider">CATALYSTS TIMELINE</span>
          <span className="text-[9px] text-muted/40">{data.catalysts.length} events</span>
        </div>
        <div className="p-4">
          <div className="relative pl-6">
            {/* Vertical line */}
            <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />
            <div className="space-y-4">
              {data.catalysts.map((cat, i) => (
                <div key={i} className="relative">
                  {/* Dot */}
                  <div className={`absolute -left-6 top-1.5 w-3.5 h-3.5 rounded-full border-2 border-card ${impactColor(cat.impact)} ${cat.impact === "very_high" ? "animate-pulse" : ""}`} />
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] font-bold text-foreground">{cat.event}</span>
                    <span className="text-[8px] text-muted/40 bg-subtle px-1.5 py-0.5 rounded-xl">{cat.date}</span>
                    <span className={`text-[7px] px-1 py-0.5 rounded-xl font-bold tracking-wider text-white ${impactColor(cat.impact)}`}>
                      {cat.impact.replace("_", " ").toUpperCase()}
                    </span>
                  </div>
                  <p className="text-[10px] text-foreground/60 leading-relaxed">{cat.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ===== BOTTLENECKS ===== */}
      {data.bottlenecks.length > 0 && (
        <div className="bg-card border border-border rounded-xl">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <div className="w-1 h-4 bg-red rounded-full" />
            <span className="text-[11px] font-semibold tracking-wider">BOTTLENECKS</span>
            <span className="text-[9px] text-muted/40 tracking-wider">SUPPLY CHAIN & RISKS</span>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.bottlenecks.map((bn, i) => {
              const sevColor = bn.severity === "critical" ? "border-red/30 bg-red/5" : bn.severity === "high" ? "border-yellow/30 bg-yellow/5" : "border-border bg-subtle/30";
              const sevBadge = bn.severity === "critical" ? "bg-red text-white" : bn.severity === "high" ? "bg-yellow/80 text-black" : "bg-muted/20 text-muted";
              return (
                <div key={i} className={`border rounded-xl p-3 ${sevColor}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-[7px] px-1.5 py-0.5 rounded-xl font-black tracking-wider ${sevBadge}`}>
                      {bn.severity.toUpperCase()}
                    </span>
                    <span className="text-[11px] font-bold text-foreground">{bn.name}</span>
                  </div>
                  <p className="text-[10px] text-foreground/60 leading-relaxed">{bn.detail}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===== STOCKS TABLE ===== */}
      <div className="bg-card border border-border rounded-xl">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <div className="w-1 h-4 bg-accent rounded-full" />
          <span className="text-[11px] font-semibold tracking-wider">ALL STOCKS</span>
          <span className="text-[9px] text-muted/40">{data.stocks.length} tickers</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[10px]">
            <thead>
              <tr className="bg-subtle/30">
                {([
                  ["ticker", "TICKER"],
                  ["price", "PRICE"],
                  ["change_pct", "1D %"],
                  ["rsi", "RSI"],
                  ["pe", "PE"],
                  ["revenue_growth", "REV GROWTH"],
                  ["return_3m", "3M RET"],
                  ["signal", "SIGNAL"],
                  ["upside_pct", "UPSIDE"],
                ] as [SortKey, string][]).map(([key, label]) => (
                  <th
                    key={key}
                    onClick={() => handleSort(key)}
                    className="text-left text-muted/50 font-medium py-2 px-3 tracking-wider cursor-pointer hover:text-muted transition-colors select-none"
                  >
                    {label} {sortKey === key ? (sortAsc ? "▲" : "▼") : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedStocks.map((s) => (
                <tr
                  key={s.ticker}
                  onClick={() => onSearch(s.ticker)}
                  className="border-t border-border/30 hover:bg-accent/5 transition-colors cursor-pointer"
                >
                  <td className="py-2 px-3">
                    <span className="text-accent font-bold">{s.ticker}</span>
                    <div className="text-[8px] text-muted/40 truncate max-w-[80px]">{s.name}</div>
                  </td>
                  <td className="py-2 px-3 font-mono text-foreground">${s.price?.toFixed(2) ?? "—"}</td>
                  <td className={`py-2 px-3 font-mono font-medium ${s.change_pct >= 0 ? "text-green" : "text-red"}`}>
                    {s.change_pct >= 0 ? "+" : ""}{s.change_pct.toFixed(2)}%
                  </td>
                  <td className={`py-2 px-3 font-mono ${s.rsi && s.rsi > 70 ? "text-red" : s.rsi && s.rsi < 30 ? "text-green" : "text-foreground"}`}>
                    {s.rsi?.toFixed(0) ?? "—"}
                  </td>
                  <td className="py-2 px-3 font-mono text-foreground">{s.pe?.toFixed(1) ?? "—"}</td>
                  <td className={`py-2 px-3 font-mono ${s.revenue_growth && s.revenue_growth > 0 ? "text-green" : "text-red"}`}>
                    {s.revenue_growth != null ? `${s.revenue_growth > 0 ? "+" : ""}${s.revenue_growth.toFixed(1)}%` : "—"}
                  </td>
                  <td className={`py-2 px-3 font-mono font-medium ${s.return_3m != null && s.return_3m >= 0 ? "text-green" : "text-red"}`}>
                    {s.return_3m != null ? `${s.return_3m >= 0 ? "+" : ""}${s.return_3m.toFixed(1)}%` : "—"}
                  </td>
                  <td className="py-2 px-3">
                    <span className={`text-[8px] px-1.5 py-0.5 rounded-xl font-bold tracking-wider ${
                      s.signal === "bullish" ? "bg-green/10 text-green" : s.signal === "bearish" ? "bg-red/10 text-red" : "bg-subtle text-muted"
                    }`}>{s.signal.toUpperCase()}</span>
                  </td>
                  <td className={`py-2 px-3 font-mono ${s.upside_pct != null && s.upside_pct >= 0 ? "text-green" : "text-red"}`}>
                    {s.upside_pct != null ? `${s.upside_pct >= 0 ? "+" : ""}${s.upside_pct.toFixed(1)}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===== NEWS + RISK side by side ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* News Feed */}
        <div className="lg:col-span-3 bg-card border border-border rounded-xl">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <div className="w-1 h-4 bg-accent rounded-full" />
            <span className="text-[11px] font-semibold tracking-wider">SECTOR NEWS</span>
            <span className="text-[9px] text-muted/40">{data.news.length} articles</span>
          </div>
          <div className="divide-y divide-border/30 max-h-[400px] overflow-y-auto">
            {data.news.length === 0 && (
              <div className="p-6 text-center text-[10px] text-muted/40">No recent news</div>
            )}
            {data.news.map((n, i) => (
              <div key={i} className="px-4 py-3 hover:bg-subtle/30 transition-colors">
                <div className="flex items-start gap-2">
                  <span className="text-[8px] px-1.5 py-0.5 bg-accent/10 text-accent rounded-xl font-bold flex-shrink-0 mt-0.5">
                    {n.related_ticker}
                  </span>
                  <div className="min-w-0">
                    <a href={n.url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-foreground hover:text-accent transition-colors leading-snug line-clamp-2">
                      {n.headline}
                    </a>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[8px] text-muted/40">{n.source}</span>
                      {n.datetime && (
                        <span className="text-[8px] text-muted/30">
                          {new Date(n.datetime * 1000).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Risk Assessment */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 bg-accent rounded-full" />
              <span className="text-[11px] font-semibold tracking-wider">RISK ASSESSMENT</span>
            </div>
            <span className={`text-[9px] px-2 py-0.5 rounded-xl font-bold tracking-wider border ${
              data.risks.overall_risk === "HIGH" ? "bg-red/10 text-red border-red/20" :
              data.risks.overall_risk === "ELEVATED" ? "bg-yellow/10 text-yellow border-yellow/20" :
              data.risks.overall_risk === "MODERATE" ? "bg-accent/10 text-accent border-accent/20" :
              "bg-green/10 text-green border-green/20"
            }`}>{data.risks.overall_risk}</span>
          </div>
          <div className="p-4 space-y-3">
            {/* Risk gauge */}
            <div className="text-center mb-3">
              <div className="text-2xl font-black text-foreground">{data.risks.risk_score}</div>
              <div className="text-[8px] text-muted/40 tracking-wider">RISK SCORE / 100</div>
              <div className="mt-2 h-2 bg-subtle rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    data.risks.risk_score > 70 ? "bg-red" : data.risks.risk_score > 50 ? "bg-yellow" : "bg-green"
                  }`}
                  style={{ width: `${data.risks.risk_score}%` }}
                />
              </div>
            </div>

            {/* Risk factors */}
            <div className="space-y-2">
              {data.risks.factors.map((f, i) => (
                <div key={i} className={`border rounded-xl p-2.5 ${riskBg(f.level)}`}>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className={`text-[9px] font-bold tracking-wider ${riskColor(f.level)}`}>{f.name}</span>
                  </div>
                  <div className="text-[9px] text-foreground/60">{f.detail}</div>
                </div>
              ))}
            </div>

            {/* Position sizing */}
            <div className="border-t border-border/50 pt-3 space-y-2">
              <div>
                <div className="text-[8px] text-muted/40 tracking-wider">MAX DRAWDOWN ESTIMATE</div>
                <div className="text-[11px] font-bold text-red">{data.risks.max_drawdown_estimate}</div>
              </div>
              <div>
                <div className="text-[8px] text-muted/40 tracking-wider">POSITION SIZING</div>
                <div className="text-[11px] font-bold text-foreground">{data.risks.position_sizing}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Back to top */}
      <div className="flex justify-center pt-4 pb-2">
        <button onClick={onClose} className="flex items-center gap-1.5 text-muted hover:text-accent transition-colors text-[10px] tracking-wider group">
          <svg className="w-3 h-3 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          BACK TO DASHBOARD
        </button>
      </div>
    </div>
  );
}
