"use client";

import { useEffect, useState } from "react";

import { API_BASE } from "../lib/apiBase";

interface BriefData {
  date: string;
  market_status: string;
  indices: Record<string, { price: number; change_pct: number }>;
  fear_greed?: { value: number; verdict: string };
  top_gainer?: { ticker: string; change: number };
  top_loser?: { ticker: string; change: number };
  most_talked?: { ticker: string; mentions: number };
  upcoming_events?: { event: string; date: string }[];
  watchlist_alert?: string;
}

interface MorningBriefProps {
  onSearch?: (ticker: string) => void;
}

export default function MorningBrief({ onSearch }: MorningBriefProps) {
  const [brief, setBrief] = useState<BriefData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        // Pull from existing endpoints in parallel
        const [briefing, fearGreed, reddit] = await Promise.all([
          fetch(`${API_BASE}/daily-briefing`).then((r) => r.ok ? r.json() : null),
          fetch(`${API_BASE}/fear-greed-v2`).then((r) => r.ok ? r.json() : null),
          fetch(`${API_BASE}/reddit/trending?limit=3`).then((r) => r.ok ? r.json() : null),
        ]);

        const idxSection = briefing?.sections?.find((s: { type: string }) => s.type === "indices");
        const indices = idxSection?.data || {};
        const moversSection = briefing?.sections?.find((s: { type: string }) => s.type === "movers");

        const result: BriefData = {
          date: new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }),
          market_status: isMarketOpen() ? "open" : "closed",
          indices,
          fear_greed: fearGreed ? { value: fearGreed.value || 50, verdict: fearGreed.verdict || "NEUTRAL" } : undefined,
          top_gainer: moversSection?.data?.gainers?.[0]
            ? { ticker: moversSection.data.gainers[0].symbol, change: moversSection.data.gainers[0].change_pct }
            : undefined,
          top_loser: moversSection?.data?.losers?.[0]
            ? { ticker: moversSection.data.losers[0].symbol, change: moversSection.data.losers[0].change_pct }
            : undefined,
          most_talked: reddit?.stocks?.[0]
            ? { ticker: reddit.stocks[0].ticker, mentions: reddit.stocks[0].mentions }
            : undefined,
        };

        setBrief(result);
      } catch {
        // ignore
      }
      setLoading(false);
    };
    load();
  }, []);

  const isMarketOpen = () => {
    const ny = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
    if (ny.getDay() === 0 || ny.getDay() === 6) return false;
    const mins = ny.getHours() * 60 + ny.getMinutes();
    return mins >= 570 && mins <= 960;
  };

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 animate-pulse">
          <div className="w-1 h-4 bg-accent rounded-full" />
          <span className="text-xs text-muted">Generating brief...</span>
        </div>
      </div>
    );
  }

  if (!brief) return null;

  // Build narrative
  const sp500 = brief.indices["S&P 500"] || brief.indices["^GSPC"];
  const nasdaq = brief.indices["Nasdaq"] || brief.indices["Nasdaq 100"] || brief.indices["^IXIC"];
  const vix = brief.indices["VIX"] || brief.indices["^VIX"];

  const overallTone = (() => {
    const sp = sp500?.change_pct || 0;
    const nq = nasdaq?.change_pct || 0;
    const avg = (sp + nq) / 2;
    if (avg > 1) return { label: "BULLISH", color: "text-green", bg: "bg-green/10", border: "border-green/20" };
    if (avg > 0.2) return { label: "MILDLY UP", color: "text-green/80", bg: "bg-green/5", border: "border-green/15" };
    if (avg > -0.2) return { label: "FLAT", color: "text-muted", bg: "bg-subtle", border: "border-border" };
    if (avg > -1) return { label: "MILDLY DOWN", color: "text-red/80", bg: "bg-red/5", border: "border-red/15" };
    return { label: "RISK-OFF", color: "text-red", bg: "bg-red/10", border: "border-red/20" };
  })();

  const narrative = (() => {
    const parts: string[] = [];
    if (sp500 && nasdaq) {
      const trend = sp500.change_pct > 0.5 && nasdaq.change_pct > 0.5
        ? "Broad equity strength."
        : sp500.change_pct < -0.5 && nasdaq.change_pct < -0.5
        ? "Broad equity weakness."
        : Math.abs(sp500.change_pct - nasdaq.change_pct) > 0.5
        ? `${nasdaq.change_pct > sp500.change_pct ? "Tech leading" : "Defensives leading"} — rotation in play.`
        : "Mixed performance across major indices.";
      parts.push(trend);
    }
    if (vix && vix.price > 25) parts.push(`VIX at ${vix.price.toFixed(1)} signals elevated stress — hedge or wait.`);
    else if (vix && vix.price < 15) parts.push(`VIX low at ${vix.price.toFixed(1)} — markets calm, complacency risk rising.`);

    if (brief.fear_greed) {
      if (brief.fear_greed.value > 75) parts.push(`Sentiment is in extreme greed territory — historically a contrarian sell signal.`);
      else if (brief.fear_greed.value < 25) parts.push(`Fear dominates — historically a contrarian buying opportunity for long-term investors.`);
    }

    if (brief.top_gainer) parts.push(`Top mover: ${brief.top_gainer.ticker} +${brief.top_gainer.change.toFixed(1)}%.`);
    if (brief.most_talked) parts.push(`Reddit's most-talked stock right now: ${brief.most_talked.ticker} (${brief.most_talked.mentions} mentions).`);

    return parts.join(" ");
  })();

  return (
    <div className="bg-gradient-to-br from-accent/5 via-card to-card border border-accent/15 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-accent/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-accent/15 flex items-center justify-center">
            <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <div>
            <div className="text-xs font-bold tracking-wider text-foreground">MORNING BRIEF</div>
            <div className="text-[10px] text-muted">{brief.date}</div>
          </div>
        </div>
        <span className={`text-[10px] px-2.5 py-1 rounded-md font-bold tracking-wider ${overallTone.bg} ${overallTone.color} border ${overallTone.border}`}>
          {overallTone.label}
        </span>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border-b border-accent/10">
        {sp500 && <Stat label="S&P 500" value={sp500.price} change={sp500.change_pct} />}
        {nasdaq && <Stat label="Nasdaq" value={nasdaq.price} change={nasdaq.change_pct} />}
        {vix && <Stat label="VIX" value={vix.price} change={vix.change_pct} muted />}
        {brief.fear_greed && (
          <div className="px-4 py-3 border-l border-accent/10 first:border-l-0">
            <div className="text-[10px] text-muted/60 tracking-wider">Fear & Greed</div>
            <div className="text-base font-bold text-foreground tabular-nums">{Math.round(brief.fear_greed.value)}<span className="text-xs text-muted ml-0.5">/100</span></div>
            <div className="text-[9px] font-bold tracking-wider text-accent">{brief.fear_greed.verdict}</div>
          </div>
        )}
      </div>

      {/* Narrative */}
      <div className="px-5 py-4">
        <p className="text-sm text-foreground/90 leading-relaxed">{narrative}</p>

        {/* Quick links */}
        {(brief.top_gainer || brief.top_loser || brief.most_talked) && (
          <div className="flex flex-wrap items-center gap-2 mt-3">
            {brief.top_gainer && (
              <button onClick={() => onSearch?.(brief.top_gainer!.ticker)} className="text-xs px-2.5 py-1 rounded-lg bg-green/8 text-green border border-green/20 hover:bg-green/15">
                ↗ {brief.top_gainer.ticker} +{brief.top_gainer.change.toFixed(1)}%
              </button>
            )}
            {brief.top_loser && (
              <button onClick={() => onSearch?.(brief.top_loser!.ticker)} className="text-xs px-2.5 py-1 rounded-lg bg-red/8 text-red border border-red/20 hover:bg-red/15">
                ↘ {brief.top_loser.ticker} {brief.top_loser.change.toFixed(1)}%
              </button>
            )}
            {brief.most_talked && (
              <button onClick={() => onSearch?.(brief.most_talked!.ticker)} className="text-xs px-2.5 py-1 rounded-lg bg-accent/8 text-accent border border-accent/20 hover:bg-accent/15">
                💬 {brief.most_talked.ticker} ({brief.most_talked.mentions})
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, change, muted }: { label: string; value: number; change: number; muted?: boolean }) {
  return (
    <div className="px-4 py-3 border-l border-accent/10 first:border-l-0">
      <div className="text-[10px] text-muted/60 tracking-wider">{label}</div>
      <div className="text-base font-bold text-foreground tabular-nums">{value.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
      <div className={`text-[10px] font-bold tabular-nums ${
        muted ? "text-muted" : change > 0 ? "text-green" : change < 0 ? "text-red" : "text-muted"
      }`}>{change > 0 ? "+" : ""}{change.toFixed(2)}%</div>
    </div>
  );
}
