"use client";

import { useState, useEffect } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Investor {
  key: string;
  name: string;
  cik: string;
}

interface Holding {
  name: string;
  cusip: string;
  value: number;        // in thousands
  shares: number;
  weight_pct: number;
}

interface Filing {
  investor_key: string;
  investor_name: string;
  report_date: string;
  filing_date: string;
  total_value_usd: number;
  position_count: number;
  holdings: Holding[];
}

function fmtBig(v: number): string {
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

interface Props {
  onSearch?: (ticker: string) => void;
}

export default function InvestorTracker({ onSearch }: Props) {
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [active, setActive] = useState<string>("berkshire");
  const [filing, setFiling] = useState<Filing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API_BASE}/13f/investors`)
      .then((r) => r.json())
      .then((d) => setInvestors(d.investors || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setError("");
    fetch(`${API_BASE}/13f/${active}?limit=25`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load 13F");
        return r.json();
      })
      .then((d) => setFiling(d))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [active]);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-1 h-4 bg-accent rounded-full" />
          <span className="text-xs font-bold tracking-wider text-foreground">13F TRACKER</span>
          <span className="text-[9px] bg-accent/10 text-accent px-2 py-0.5 rounded-md font-bold tracking-wider">SEC EDGAR</span>
        </div>
        {filing && (
          <div className="flex items-center gap-3 text-[10px] text-muted">
            <span>Reported: <span className="text-foreground font-bold tabular-nums">{filing.report_date}</span></span>
            <span className="text-border">|</span>
            <span>{filing.position_count} positions</span>
            <span className="text-border">|</span>
            <span className="text-accent font-bold tabular-nums">{fmtBig(filing.total_value_usd)}</span>
          </div>
        )}
      </div>

      {/* Investor tabs */}
      <div className="flex items-center gap-1 px-2 py-2 border-b border-border bg-subtle/30 overflow-x-auto">
        {investors.map((i) => (
          <button
            key={i.key}
            onClick={() => setActive(i.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
              active === i.key
                ? "bg-accent/10 text-accent ring-1 ring-accent/20"
                : "text-muted hover:text-foreground hover:bg-card"
            }`}
          >
            {i.name}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="p-12 flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-accent/20 border-t-accent rounded-full animate-spin" />
          <span className="text-xs text-muted">Loading SEC filing...</span>
        </div>
      ) : error || !filing ? (
        <div className="p-8 text-center text-sm text-muted">
          {error || "Filing unavailable"}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-subtle/50">
                <th className="text-left px-4 py-2 text-muted/50 font-medium w-10">#</th>
                <th className="text-left px-3 py-2 text-muted/50 font-medium">Holding</th>
                <th className="text-right px-3 py-2 text-muted/50 font-medium">Value</th>
                <th className="text-right px-3 py-2 text-muted/50 font-medium">Weight</th>
                <th className="text-right px-3 py-2 text-muted/50 font-medium hidden md:table-cell">Shares</th>
              </tr>
            </thead>
            <tbody>
              {filing.holdings.map((h, i) => (
                <tr
                  key={`${h.cusip}-${i}`}
                  className="border-b border-border/40 hover:bg-subtle/30 transition-colors"
                >
                  <td className="px-4 py-2.5 text-muted/50 tabular-nums">{i + 1}</td>
                  <td className="px-3 py-2.5">
                    <div className="font-bold text-foreground truncate max-w-[400px]">{h.name}</div>
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold text-foreground tabular-nums">
                    {fmtBig(h.value)}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="inline-flex items-center gap-2">
                      <div className="w-12 h-1 bg-border/50 rounded-full overflow-hidden">
                        <div className="h-full bg-accent rounded-full" style={{ width: `${Math.min(100, h.weight_pct * 5)}%` }} />
                      </div>
                      <span className="tabular-nums text-foreground font-medium">{h.weight_pct.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right text-muted tabular-nums hidden md:table-cell">
                    {h.shares.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
