"use client";

import { useState, useEffect } from "react";

import { API_BASE } from "../lib/apiBase";

interface Signal {
  name: string;
  signal: string;
  detail: string;
}

interface Technicals {
  rsi_7d: number;
  rsi_signal: string;
  ma_7d: number;
  ma_24h: number;
  above_ma_7d: boolean;
  momentum_7d_pct: number;
  volatility_7d: number;
  support_7d: number;
  resistance_7d: number;
  range_position_pct: number;
  high_7d: number;
  low_7d: number;
}

interface Supply {
  circulating: number | null;
  total: number | null;
  max: number | null;
  pct_mined: number | null;
  pct_circulating: number | null;
  fully_diluted_valuation: number | null;
}

interface Social {
  twitter_followers: number | null;
  reddit_subscribers: number | null;
  reddit_active_48h: number | null;
  github_forks: number | null;
  github_stars: number | null;
  commit_count_4w: number | null;
}

interface ChartPoint {
  date: string;
  price: number;
}

interface CryptoData {
  id: string;
  symbol: string;
  name: string;
  image: string;
  description: string;
  categories: string[];
  genesis_date: string | null;
  market_cap_rank: number | null;
  price: number;
  market_cap: number;
  volume_24h: number;
  change_1h: number | null;
  change_24h: number;
  change_7d: number;
  change_14d: number | null;
  change_30d: number;
  change_1y: number | null;
  ath: number;
  ath_change_pct: number;
  ath_date: string | null;
  atl: number;
  atl_date: string | null;
  high_24h: number | null;
  low_24h: number | null;
  supply: Supply;
  technicals: Technicals;
  verdict: { score: number; label: string; advice: string; signals: Signal[] };
  social: Social;
  sentiment_up: number | null;
  sentiment_down: number | null;
  chart_90d: ChartPoint[];
  chart_365d: ChartPoint[];
  sparkline_7d: number[];
}

function fmtPrice(v: number | null | undefined): string {
  if (v == null) return "—";
  if (v >= 1) return `$${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  if (v >= 0.01) return `$${v.toFixed(4)}`;
  return `$${v.toFixed(8)}`;
}

function fmtBig(v: number | null | undefined): string {
  if (v == null) return "—";
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  return `$${v.toLocaleString()}`;
}

function fmtSupply(v: number | null | undefined): string {
  if (v == null) return "—";
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  return v.toLocaleString();
}

function pctBadge(v: number | null | undefined) {
  if (v == null) return <span className="text-muted/40">—</span>;
  const color = v > 0 ? "text-green bg-green/8" : v < 0 ? "text-red bg-red/8" : "text-muted bg-muted/8";
  return <span className={`${color} text-xs font-semibold px-2 py-0.5 rounded-lg tabular-nums`}>{v > 0 ? "+" : ""}{v.toFixed(1)}%</span>;
}

function signalColor(signal: string): string {
  if (signal.includes("bullish") || signal === "high_activity" || signal === "oversold") return "text-green";
  if (signal.includes("bearish") || signal === "low_activity" || signal === "overbought") return "text-red";
  return "text-yellow";
}

function signalBg(signal: string): string {
  if (signal.includes("bullish") || signal === "high_activity" || signal === "oversold") return "bg-green/8 border-green/15";
  if (signal.includes("bearish") || signal === "low_activity" || signal === "overbought") return "bg-red/8 border-red/15";
  return "bg-yellow/8 border-yellow/15";
}

function MiniChart({ data, width = 280, height = 80 }: { data: ChartPoint[]; width?: number; height?: number }) {
  if (!data || data.length < 2) return null;
  const prices = data.map((d) => d.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const isUp = prices[prices.length - 1] >= prices[0];
  const step = Math.max(1, Math.floor(prices.length / 80));
  const sampled = prices.filter((_, i) => i % step === 0);
  const pts = sampled.map((v, i) => `${(i / (sampled.length - 1)) * width},${height - ((v - min) / range) * (height - 4) - 2}`).join(" ");
  const fillPts = `0,${height} ${pts} ${width},${height}`;
  return (
    <svg width={width} height={height} className="w-full">
      <defs>
        <linearGradient id={`cg-${isUp ? "up" : "dn"}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={isUp ? "#2D8B4E" : "#C0392B"} stopOpacity="0.15" />
          <stop offset="100%" stopColor={isUp ? "#2D8B4E" : "#C0392B"} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={fillPts} fill={`url(#cg-${isUp ? "up" : "dn"})`} />
      <polyline points={pts} fill="none" stroke={isUp ? "#2D8B4E" : "#C0392B"} strokeWidth="1.5" />
    </svg>
  );
}

interface Props {
  coinId: string;
  onClose: () => void;
}

export default function CryptoAnalysis({ coinId, onClose }: Props) {
  const [data, setData] = useState<CryptoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [chartPeriod, setChartPeriod] = useState<"7d" | "90d" | "1y">("90d");

  useEffect(() => {
    setLoading(true);
    setError("");
    fetch(`${API_BASE}/crypto/analyze/${coinId}`)
      .then((r) => {
        if (!r.ok) throw new Error("Coin not found");
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [coinId]);

  if (loading) {
    return (
      <div className="max-w-[1280px] mx-auto px-6 py-20 flex flex-col items-center fade-in">
        <div className="w-12 h-12 border-2 border-accent/20 border-t-accent rounded-full animate-spin" />
        <div className="mt-4 text-accent text-sm font-semibold tracking-widest">ANALYZING</div>
        <div className="text-muted text-xs mt-1">Fetching crypto data...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-xl mx-auto px-6 pt-12">
        <div className="border border-red/20 bg-red/5 rounded-xl p-5">
          <div className="text-red text-sm font-semibold">Crypto Analysis Failed</div>
          <div className="text-red/60 text-xs mt-1">{error || "Unknown error"}</div>
          <button onClick={onClose} className="mt-3 text-xs text-muted hover:text-foreground transition-colors">Go back</button>
        </div>
      </div>
    );
  }

  const v = data.verdict;
  const t = data.technicals;
  const s = data.supply;
  const soc = data.social;
  const isUp = data.change_24h >= 0;

  const chartData = chartPeriod === "7d"
    ? data.sparkline_7d.map((p, i) => ({ date: `${i}h`, price: p }))
    : chartPeriod === "90d" ? data.chart_90d : data.chart_365d;

  return (
    <div className="max-w-[1280px] mx-auto px-6 pb-16 pt-6 space-y-5 fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between">
        <button onClick={onClose} className="flex items-center gap-2 text-muted hover:text-accent transition-colors text-sm group">
          <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Crypto Markets
        </button>
        <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-card flex items-center justify-center text-muted hover:text-red transition-all">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* ── HEADER ── */}
      <div className="premium-card rounded-xl p-6">
        <div className="flex items-center gap-4 flex-wrap">
          {data.image && <img src={data.image} alt={data.symbol} className="w-12 h-12 rounded-full" />}
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-foreground">{data.name}</span>
              <span className="text-muted text-sm font-medium">{data.symbol}</span>
              {data.market_cap_rank && (
                <span className="text-[10px] text-muted bg-subtle px-2 py-0.5 rounded-md font-medium">Rank #{data.market_cap_rank}</span>
              )}
            </div>
            {data.categories.length > 0 && (
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                {data.categories.slice(0, 3).map((cat) => (
                  <span key={cat} className="text-[9px] text-muted/60 bg-subtle px-1.5 py-0.5 rounded">{cat}</span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-end gap-6 mt-5 flex-wrap">
          <div>
            <div className="text-3xl font-bold text-foreground tabular-nums tracking-tight">{fmtPrice(data.price)}</div>
            <div className={`flex items-center gap-2 mt-1 ${isUp ? "text-green" : "text-red"}`}>
              <svg className={`w-4 h-4 ${isUp ? "" : "rotate-180"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
              </svg>
              <div className="flex items-center gap-2 flex-wrap">
                {pctBadge(data.change_1h)}
                {pctBadge(data.change_24h)}
                {pctBadge(data.change_7d)}
              </div>
              <span className="text-[10px] text-muted/40">1h / 24h / 7d</span>
            </div>
          </div>

          <div className="flex gap-5 text-xs text-muted ml-auto flex-wrap">
            {[
              { label: "Market Cap", val: fmtBig(data.market_cap) },
              { label: "24h Volume", val: fmtBig(data.volume_24h) },
              { label: "24h High", val: fmtPrice(data.high_24h) },
              { label: "24h Low", val: fmtPrice(data.low_24h) },
              { label: "ATH", val: fmtPrice(data.ath) },
            ].map((item) => (
              <div key={item.label} className="text-center">
                <div className="text-muted/40 text-[10px] mb-0.5">{item.label}</div>
                <div className="text-foreground/80 font-medium tabular-nums">{item.val}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── VERDICT ── */}
      <div className="premium-card rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-1 h-5 bg-accent rounded-full" />
            <span className="text-sm font-bold tracking-wider text-foreground">VERDICT</span>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-lg font-black ${v.score >= 55 ? "text-green" : v.score <= 45 ? "text-red" : "text-yellow"}`}>
              {v.score}/100
            </span>
            <span className={`text-xs font-bold px-3 py-1 rounded-lg ${
              v.label.includes("BULLISH") ? "bg-green/10 text-green" :
              v.label.includes("BEARISH") ? "bg-red/10 text-red" :
              "bg-yellow/10 text-yellow"
            }`}>{v.label}</span>
          </div>
        </div>

        {/* Score bar */}
        <div className="relative h-2.5 bg-subtle rounded-full overflow-hidden mb-3">
          <div
            className={`absolute inset-y-0 left-0 rounded-full transition-all ${
              v.score >= 55 ? "bg-green" : v.score <= 45 ? "bg-red" : "bg-yellow"
            }`}
            style={{ width: `${v.score}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-muted/40 mb-4">
          <span>BEARISH</span><span>NEUTRAL</span><span>BULLISH</span>
        </div>

        <p className="text-sm text-muted leading-relaxed mb-5">{v.advice}</p>

        {/* Signals */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {v.signals.map((sig, i) => (
            <div key={i} className={`border rounded-xl px-4 py-3 ${signalBg(sig.signal)}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">{sig.name}</span>
                <span className={`text-[10px] font-bold ${signalColor(sig.signal)}`}>{sig.signal.replace("_", " ").toUpperCase()}</span>
              </div>
              <div className="text-[11px] text-muted mt-0.5">{sig.detail}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── CHART ── */}
      <div className="premium-card rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-1 h-5 bg-accent rounded-full" />
            <span className="text-sm font-bold tracking-wider text-foreground">PRICE CHART</span>
          </div>
          <div className="flex items-center gap-1">
            {(["7d", "90d", "1y"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setChartPeriod(p)}
                className={`text-xs px-3 py-1 rounded-lg font-medium transition-colors ${
                  chartPeriod === p ? "bg-accent/10 text-accent" : "text-muted/50 hover:text-muted"
                }`}
              >{p.toUpperCase()}</button>
            ))}
          </div>
        </div>
        <MiniChart data={chartData} height={120} />
      </div>

      {/* ── TECHNICALS + SUPPLY side by side ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Technicals */}
        {t && t.rsi_7d != null && (
          <div className="premium-card rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-4 bg-accent rounded-full" />
              <span className="text-xs font-bold tracking-wider text-foreground">TECHNICALS (7D)</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "RSI", value: t.rsi_7d.toFixed(1), color: t.rsi_signal === "overbought" ? "text-red" : t.rsi_signal === "oversold" ? "text-green" : "text-foreground" },
                { label: "Momentum", value: `${t.momentum_7d_pct > 0 ? "+" : ""}${t.momentum_7d_pct.toFixed(1)}%`, color: t.momentum_7d_pct > 0 ? "text-green" : "text-red" },
                { label: "Volatility", value: `${t.volatility_7d.toFixed(2)}%`, color: "text-foreground" },
                { label: "Range Position", value: `${t.range_position_pct.toFixed(0)}%`, color: "text-foreground" },
                { label: "Support", value: fmtPrice(t.support_7d), color: "text-green" },
                { label: "Resistance", value: fmtPrice(t.resistance_7d), color: "text-red" },
                { label: "MA 7d", value: fmtPrice(t.ma_7d), color: "text-foreground" },
                { label: "Above MA", value: t.above_ma_7d ? "Yes" : "No", color: t.above_ma_7d ? "text-green" : "text-red" },
              ].map((m) => (
                <div key={m.label} className="bg-subtle rounded-lg p-3">
                  <div className="text-[10px] text-muted/50 tracking-wider">{m.label}</div>
                  <div className={`text-sm font-bold mt-0.5 tabular-nums ${m.color}`}>{m.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Supply */}
        <div className="premium-card rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-4 bg-accent rounded-full" />
            <span className="text-xs font-bold tracking-wider text-foreground">SUPPLY & VALUATION</span>
          </div>
          <div className="space-y-3">
            {[
              { label: "Circulating Supply", value: fmtSupply(s.circulating) },
              { label: "Total Supply", value: fmtSupply(s.total) },
              { label: "Max Supply", value: s.max ? fmtSupply(s.max) : "Unlimited" },
              ...(s.pct_mined != null ? [{ label: "% Mined", value: `${s.pct_mined}%` }] : []),
              { label: "Fully Diluted Val.", value: fmtBig(s.fully_diluted_valuation) },
              { label: "ATH", value: `${fmtPrice(data.ath)} (${data.ath_change_pct?.toFixed(0)}%)` },
              { label: "ATL", value: fmtPrice(data.atl) },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between text-xs py-1 border-b border-border/30 last:border-0">
                <span className="text-muted">{row.label}</span>
                <span className="text-foreground font-medium tabular-nums">{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── PERFORMANCE ── */}
      <div className="premium-card rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-4 bg-accent rounded-full" />
          <span className="text-xs font-bold tracking-wider text-foreground">PERFORMANCE</span>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {[
            { label: "1h", value: data.change_1h },
            { label: "24h", value: data.change_24h },
            { label: "7d", value: data.change_7d },
            { label: "14d", value: data.change_14d },
            { label: "30d", value: data.change_30d },
            { label: "1y", value: data.change_1y },
          ].map((p) => (
            <div key={p.label} className="bg-subtle rounded-lg p-3 text-center">
              <div className="text-[10px] text-muted/50 tracking-wider">{p.label}</div>
              <div className={`text-sm font-bold mt-0.5 tabular-nums ${
                p.value == null ? "text-muted/30" : p.value > 0 ? "text-green" : p.value < 0 ? "text-red" : "text-muted"
              }`}>
                {p.value != null ? `${p.value > 0 ? "+" : ""}${p.value.toFixed(1)}%` : "—"}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── SOCIAL & COMMUNITY ── */}
      {(soc.twitter_followers || soc.reddit_subscribers || soc.github_stars) && (
        <div className="premium-card rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-4 bg-accent rounded-full" />
            <span className="text-xs font-bold tracking-wider text-foreground">COMMUNITY & DEVELOPMENT</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: "Twitter", value: soc.twitter_followers, icon: "X" },
              { label: "Reddit Subs", value: soc.reddit_subscribers, icon: "R" },
              { label: "Reddit Active", value: soc.reddit_active_48h, icon: "48h" },
              { label: "GitHub Stars", value: soc.github_stars, icon: "S" },
              { label: "GitHub Forks", value: soc.github_forks, icon: "F" },
              { label: "Commits (4w)", value: soc.commit_count_4w, icon: "C" },
            ].filter((m) => m.value != null).map((m) => (
              <div key={m.label} className="bg-subtle rounded-lg p-3">
                <div className="text-[10px] text-muted/50 tracking-wider">{m.label}</div>
                <div className="text-sm font-bold text-foreground mt-0.5 tabular-nums">{m.value?.toLocaleString()}</div>
              </div>
            ))}
          </div>
          {/* Sentiment bar */}
          {data.sentiment_up != null && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-[10px] text-muted/50 mb-1">
                <span>Community Sentiment</span>
                <span>{data.sentiment_up?.toFixed(0)}% positive</span>
              </div>
              <div className="h-2 bg-red/15 rounded-full overflow-hidden">
                <div className="h-full bg-green/60 rounded-full" style={{ width: `${data.sentiment_up}%` }} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── DESCRIPTION ── */}
      {data.description && (
        <div className="premium-card rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-4 bg-accent rounded-full" />
            <span className="text-xs font-bold tracking-wider text-foreground">ABOUT {data.symbol}</span>
          </div>
          <p className="text-sm text-muted leading-relaxed">{data.description}</p>
          {data.genesis_date && <div className="text-[10px] text-muted/40 mt-2">Genesis: {data.genesis_date}</div>}
        </div>
      )}

      {/* Back */}
      <div className="flex justify-center pt-4">
        <button onClick={onClose} className="flex items-center gap-2 px-4 py-2 rounded-lg text-muted hover:text-foreground hover:bg-card border border-transparent hover:border-border transition-all text-xs">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Crypto Markets
        </button>
      </div>
    </div>
  );
}
