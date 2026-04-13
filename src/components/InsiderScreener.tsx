"use client";

import { useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface InsiderResult {
  ticker: string;
  buy_count: number;
  unique_buyers: number;
  total_buy_value: number;
  total_sell_value: number;
  conviction_score: number;
  latest_buy: string;
  buyers: string[];
}

interface ScreenerData {
  results: InsiderResult[];
  total_found: number;
  ai_summary: string;
}

function formatUSD(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

export default function InsiderScreener({ onSearch }: { onSearch?: (ticker: string) => void }) {
  const [data, setData] = useState<ScreenerData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE}/insider-screener`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="bg-card border border-border p-5">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-accent/20 border-t-accent rounded-full animate-spin" />
          <span className="text-accent text-xs tracking-widest animate-pulse">SCANNING INSIDER TRANSACTIONS...</span>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-card border border-border p-5">
        <div className="text-muted text-xs">Insider screener unavailable</div>
      </div>
    );
  }

  const convictionColor = (s: number) => {
    if (s >= 70) return "text-green";
    if (s >= 50) return "text-yellow";
    return "text-muted";
  };

  const convictionBar = (s: number) => {
    if (s >= 70) return "bg-green";
    if (s >= 50) return "bg-yellow";
    return "bg-muted/30";
  };

  return (
    <div className="bg-card border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-accent text-xs font-semibold tracking-wider">INSIDER BUY SCREENER</h3>
            <span className="text-[9px] px-1.5 py-0.5 bg-green/10 text-green border border-green/20">SMART MONEY</span>
          </div>
          <div className="text-muted text-[10px] mt-0.5">
            {data.total_found} stocks with insider buying (90 days)
          </div>
        </div>
      </div>

      {/* AI Summary */}
      {data.ai_summary && (
        <div className="bg-subtle/50 border-l-2 border-accent/30 pl-3 pr-3 py-2.5 mb-4">
          <div className="text-accent/60 text-[9px] font-semibold tracking-[0.15em] mb-1.5">
            AI ANALYSIS — INSIDER ACTIVITY
          </div>
          <p className="text-[11px] text-muted leading-[1.7]">{data.ai_summary}</p>
        </div>
      )}

      {data.results.length > 0 ? (
        <div className="space-y-2">
          {data.results.map((r) => (
            <div
              key={r.ticker}
              onClick={() => onSearch?.(r.ticker)}
              className="border border-border/50 p-3 hover:bg-subtle/30 transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-accent text-xs font-bold">{r.ticker}</span>
                  {r.unique_buyers >= 3 && (
                    <span className="text-[8px] px-1.5 py-0.5 bg-green/10 text-green border border-green/20">CLUSTER</span>
                  )}
                  {r.total_buy_value > 1_000_000 && (
                    <span className="text-[8px] px-1.5 py-0.5 bg-accent/10 text-accent border border-accent/20">HEAVY</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold ${convictionColor(r.conviction_score)}`}>
                    {r.conviction_score}/100
                  </span>
                </div>
              </div>

              {/* Conviction bar */}
              <div className="h-1.5 bg-subtle rounded-full overflow-hidden mb-2">
                <div
                  className={`h-full rounded-full ${convictionBar(r.conviction_score)}`}
                  style={{ width: `${r.conviction_score}%` }}
                />
              </div>

              <div className="flex items-center gap-4 text-[10px]">
                <div>
                  <span className="text-muted/60">Achats:</span>{" "}
                  <span className="text-green font-medium">{r.buy_count} txns</span>
                </div>
                <div>
                  <span className="text-muted/60">Insiders:</span>{" "}
                  <span className="text-foreground font-medium">{r.unique_buyers}</span>
                </div>
                <div>
                  <span className="text-muted/60">Valeur:</span>{" "}
                  <span className="text-green font-medium">{formatUSD(r.total_buy_value)}</span>
                </div>
                {r.total_sell_value > 0 && (
                  <div>
                    <span className="text-muted/60">Ventes:</span>{" "}
                    <span className="text-red font-medium">{formatUSD(r.total_sell_value)}</span>
                  </div>
                )}
                <div>
                  <span className="text-muted/60">Dernier:</span>{" "}
                  <span className="text-muted">{r.latest_buy}</span>
                </div>
              </div>

              {r.buyers.length > 0 && (
                <div className="text-[9px] text-muted/50 mt-1 truncate">
                  {r.buyers.join(", ")}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center text-muted text-xs py-8">
          Aucun achat d&apos;insider significatif d&eacute;tect&eacute;.
        </div>
      )}
    </div>
  );
}
