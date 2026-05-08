"use client";

import { useState, useEffect } from "react";

import { API_BASE } from "../lib/apiBase";

interface RedditStock {
  rank: number;
  ticker: string;
  name: string;
  mentions: number;
  mentions_24h_ago: number;
  mention_change: number;
  mention_change_pct: number;
  upvotes: number;
  rank_change: number;
  sentiment: {
    sentiment_pct: number;
    sentiment_label: string;
    bull_signals: number;
    bear_signals: number;
    post_count: number;
    avg_score: number;
  } | null;
}

function SentimentBar({ pct }: { pct: number }) {
  const color = pct > 60 ? "bg-green" : pct < 40 ? "bg-red" : "bg-yellow";
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-1.5 bg-border/50 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] tabular-nums text-muted w-8 text-right">{pct}%</span>
    </div>
  );
}

function RankBadge({ change }: { change: number }) {
  if (change === 0) return <span className="text-muted/30 text-[10px]">—</span>;
  const up = change > 0;
  return (
    <span className={`flex items-center gap-0.5 text-[10px] font-bold ${up ? "text-green" : "text-red"}`}>
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={up ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
      </svg>
      {Math.abs(change)}
    </span>
  );
}

interface RedditTrackerProps {
  onSearch?: (ticker: string) => void;
}

export default function RedditTracker({ onSearch }: RedditTrackerProps) {
  const [stocks, setStocks] = useState<RedditStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API_BASE}/reddit/trending?limit=25`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load");
        return r.json();
      })
      .then((d) => setStocks(d.stocks || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl p-8 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-accent/20 border-t-accent rounded-full animate-spin" />
          <span className="text-sm text-muted">Scanning Reddit...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-card border border-red/20 rounded-xl p-6">
        <div className="text-red text-sm font-semibold">Reddit Tracker Error</div>
        <div className="text-red/60 text-xs mt-1">{error}</div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1 h-4 bg-accent rounded-full" />
          <span className="text-xs font-bold tracking-wider text-foreground">REDDIT BUZZ</span>
          <span className="text-[9px] bg-red/10 text-red px-2 py-0.5 rounded-md font-bold tracking-wider">LIVE</span>
        </div>
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-accent/40" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z" />
          </svg>
          <span className="text-[10px] text-muted/40">r/wallstreetbets + more</span>
        </div>
      </div>

      {/* Top 3 spotlight */}
      <div className="grid grid-cols-3 gap-0 border-b border-border">
        {stocks.slice(0, 3).map((s, i) => {
          const medals = ["bg-yellow/10 border-yellow/20", "bg-muted/5 border-border", "bg-accent/5 border-accent/15"];
          const sentColor = s.sentiment
            ? s.sentiment.sentiment_label === "bullish" ? "text-green" : s.sentiment.sentiment_label === "bearish" ? "text-red" : "text-yellow"
            : "text-muted/30";
          return (
            <button
              key={s.ticker}
              onClick={() => onSearch?.(s.ticker)}
              className={`p-4 text-left hover:bg-subtle/30 transition-colors ${i < 2 ? "border-r border-border" : ""} ${medals[i]}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-foreground">{s.ticker}</span>
                  <RankBadge change={s.rank_change} />
                </div>
                <span className="text-[10px] text-muted/40">#{s.rank}</span>
              </div>
              <div className="text-[11px] text-muted truncate mb-2">{s.name}</div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-xs">
                  <span className="text-foreground font-bold tabular-nums">{s.mentions.toLocaleString()}</span>
                  <span className="text-muted ml-1">mentions</span>
                </div>
                <span className={`text-[10px] font-bold tabular-nums ${s.mention_change_pct > 0 ? "text-green" : s.mention_change_pct < 0 ? "text-red" : "text-muted"}`}>
                  {s.mention_change_pct > 0 ? "+" : ""}{s.mention_change_pct}%
                </span>
              </div>
              {s.sentiment && (
                <div className="mt-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] text-muted/50">Sentiment</span>
                    <span className={`text-[9px] font-bold uppercase ${sentColor}`}>{s.sentiment.sentiment_label}</span>
                  </div>
                  <SentimentBar pct={s.sentiment.sentiment_pct} />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Full table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-subtle/50">
              <th className="text-left px-4 py-2 text-muted/50 font-medium w-10">#</th>
              <th className="text-left px-3 py-2 text-muted/50 font-medium">Stock</th>
              <th className="text-right px-3 py-2 text-muted/50 font-medium">Mentions</th>
              <th className="text-right px-3 py-2 text-muted/50 font-medium hidden sm:table-cell">24h Chg</th>
              <th className="text-right px-3 py-2 text-muted/50 font-medium hidden md:table-cell">Upvotes</th>
              <th className="text-right px-3 py-2 text-muted/50 font-medium hidden md:table-cell">Rank Δ</th>
              <th className="text-right px-3 py-2 text-muted/50 font-medium hidden lg:table-cell w-28">Sentiment</th>
            </tr>
          </thead>
          <tbody>
            {stocks.slice(3).map((s) => (
              <tr
                key={s.ticker}
                className="border-b border-border/40 hover:bg-subtle/30 transition-colors cursor-pointer"
                onClick={() => onSearch?.(s.ticker)}
              >
                <td className="px-4 py-2.5 text-muted/50 tabular-nums">{s.rank}</td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground">{s.ticker}</span>
                    <span className="text-muted/50 hidden sm:inline truncate max-w-[160px]">{s.name}</span>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right font-semibold text-foreground tabular-nums">{s.mentions.toLocaleString()}</td>
                <td className="px-3 py-2.5 text-right hidden sm:table-cell">
                  <span className={`tabular-nums font-bold ${s.mention_change_pct > 0 ? "text-green" : s.mention_change_pct < 0 ? "text-red" : "text-muted"}`}>
                    {s.mention_change_pct > 0 ? "+" : ""}{s.mention_change_pct}%
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right text-muted tabular-nums hidden md:table-cell">{s.upvotes.toLocaleString()}</td>
                <td className="px-3 py-2.5 text-right hidden md:table-cell"><RankBadge change={s.rank_change} /></td>
                <td className="px-3 py-2.5 text-right hidden lg:table-cell">
                  {s.sentiment ? (
                    <SentimentBar pct={s.sentiment.sentiment_pct} />
                  ) : (
                    <span className="text-muted/30 text-[10px]">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
