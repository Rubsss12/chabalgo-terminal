"use client";

import { useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface StockResult {
  ticker: string;
  name: string;
  price?: number | null;
  change_pct?: number;
  market_cap?: number | null;
  pe_ratio?: number | null;
  forward_pe?: number | null;
  revenue_growth?: number | null;
  profit_margin?: number | null;
  roe?: number | null;
  debt_to_equity?: number | null;
  dividend_yield?: number | null;
  beta?: number | null;
  rsi?: number | null;
  return_1y?: number | null;
  eps?: number | null;
  fcf?: number | null;
  analyst_target?: number | null;
  analyst_count?: number;
  error?: boolean;
}

interface CompareData {
  tickers: string[];
  results: StockResult[];
}

interface MetricDef {
  key: keyof StockResult;
  label: string;
  format: (v: unknown) => string;
  highlight?: "higher" | "lower";
}

const METRICS: MetricDef[] = [
  { key: "price", label: "Price", format: (v) => v != null ? `$${Number(v).toFixed(2)}` : "—" },
  { key: "change_pct", label: "Day Change", format: (v) => v != null ? `${Number(v) >= 0 ? "+" : ""}${Number(v).toFixed(2)}%` : "—" },
  { key: "market_cap", label: "Market Cap", format: (v) => {
    if (v == null) return "—";
    const n = Number(v);
    if (n >= 1e12) return `$${(n / 1e12).toFixed(1)}T`;
    if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
    return `$${(n / 1e6).toFixed(0)}M`;
  }},
  { key: "pe_ratio", label: "PE Ratio", format: (v) => v != null ? `${Number(v).toFixed(1)}x` : "—", highlight: "lower" },
  { key: "forward_pe", label: "Forward PE", format: (v) => v != null ? `${Number(v).toFixed(1)}x` : "—", highlight: "lower" },
  { key: "revenue_growth", label: "Rev Growth", format: (v) => v != null ? `${Number(v) >= 0 ? "+" : ""}${Number(v).toFixed(1)}%` : "—", highlight: "higher" },
  { key: "profit_margin", label: "Profit Margin", format: (v) => v != null ? `${Number(v).toFixed(1)}%` : "—", highlight: "higher" },
  { key: "roe", label: "ROE", format: (v) => v != null ? `${Number(v).toFixed(1)}%` : "—", highlight: "higher" },
  { key: "debt_to_equity", label: "D/E Ratio", format: (v) => v != null ? `${Number(v).toFixed(0)}%` : "—", highlight: "lower" },
  { key: "dividend_yield", label: "Div Yield", format: (v) => v != null ? `${Number(v).toFixed(2)}%` : "—", highlight: "higher" },
  { key: "beta", label: "Beta", format: (v) => v != null ? Number(v).toFixed(2) : "—" },
  { key: "rsi", label: "RSI", format: (v) => v != null ? Number(v).toFixed(0) : "—" },
  { key: "return_1y", label: "Return 1Y", format: (v) => v != null ? `${Number(v) >= 0 ? "+" : ""}${Number(v).toFixed(1)}%` : "—", highlight: "higher" },
  { key: "eps", label: "EPS", format: (v) => v != null ? `$${Number(v).toFixed(2)}` : "—", highlight: "higher" },
  { key: "analyst_target", label: "Analyst Target", format: (v) => v != null ? `$${Number(v).toFixed(2)}` : "—" },
];

export default function StockComparison({ initialTicker, onSearch }: { initialTicker?: string; onSearch?: (t: string) => void }) {
  const [input, setInput] = useState(initialTicker ? `${initialTicker}, ` : "");
  const [data, setData] = useState<CompareData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCompare = () => {
    const tickers = input.split(/[,\s]+/).filter(Boolean).join(",");
    if (!tickers || tickers.split(",").length < 2) {
      setError("Enter at least 2 tickers separated by commas");
      return;
    }
    setLoading(true);
    setError("");
    fetch(`${API_BASE}/compare?tickers=${tickers}`)
      .then((r) => {
        if (!r.ok) throw new Error("Comparison failed");
        return r.json();
      })
      .then((d) => setData(d))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  const getBest = (metric: MetricDef): string | null => {
    if (!data || !metric.highlight) return null;
    let best: StockResult | null = null;
    let bestVal = metric.highlight === "higher" ? -Infinity : Infinity;
    for (const r of data.results) {
      const v = r[metric.key];
      if (v == null || r.error) continue;
      const n = Number(v);
      if (isNaN(n)) continue;
      if (metric.highlight === "higher" ? n > bestVal : n < bestVal) {
        bestVal = n;
        best = r;
      }
    }
    return best?.ticker || null;
  };

  return (
    <div className="bg-card border border-border rounded-sm">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1 h-4 bg-accent rounded-full" />
          <span className="text-[11px] font-semibold tracking-wider text-foreground">STOCK COMPARISON</span>
          <span className="text-[9px] text-muted/50 tracking-wider">UP TO 6</span>
        </div>
      </div>

      {/* Input */}
      <div className="p-4 border-b border-border/50">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && handleCompare()}
            placeholder="AAPL, MSFT, GOOGL, AMZN"
            className="flex-1 bg-subtle border border-border rounded-sm px-3 py-2 text-xs text-foreground placeholder:text-muted/40 focus:outline-none focus:border-accent/40"
          />
          <button
            onClick={handleCompare}
            disabled={loading}
            className="px-4 py-2 bg-accent text-white text-[10px] tracking-wider font-semibold rounded-sm hover:bg-accent/90 transition-colors disabled:opacity-50"
          >
            {loading ? "..." : "COMPARE"}
          </button>
        </div>
        {error && <div className="text-[10px] text-red/70 mt-1.5">{error}</div>}
      </div>

      {/* Results table */}
      {data && data.results.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-[10px]">
            <thead>
              <tr className="bg-subtle/30">
                <th className="text-left text-muted/50 font-medium py-2 px-3 tracking-wider sticky left-0 bg-subtle/30 z-10">METRIC</th>
                {data.results.map((r) => (
                  <th key={r.ticker} className="text-center py-2 px-3 min-w-[100px]">
                    <button
                      onClick={() => onSearch?.(r.ticker)}
                      className="text-accent font-bold tracking-wider hover:underline"
                    >
                      {r.ticker}
                    </button>
                    <div className="text-[8px] text-muted/40 font-normal truncate max-w-[90px] mx-auto">{r.name}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {METRICS.map((m) => {
                const bestTicker = getBest(m);
                return (
                  <tr key={m.key} className="border-t border-border/30 hover:bg-subtle/20 transition-colors">
                    <td className="py-1.5 px-3 text-foreground/70 font-medium sticky left-0 bg-card z-10">{m.label}</td>
                    {data.results.map((r) => {
                      const val = r[m.key];
                      const isBest = bestTicker === r.ticker;
                      const numVal = Number(val);
                      const isNeg = !isNaN(numVal) && numVal < 0 && (m.key === "change_pct" || m.key === "return_1y" || m.key === "revenue_growth");
                      const isPos = !isNaN(numVal) && numVal > 0 && (m.key === "change_pct" || m.key === "return_1y" || m.key === "revenue_growth");
                      return (
                        <td
                          key={r.ticker}
                          className={`py-1.5 px-3 text-center font-mono ${
                            r.error ? "text-muted/30" :
                            isBest ? "text-accent font-bold" :
                            isNeg ? "text-red/70" :
                            isPos ? "text-green/70" :
                            "text-foreground"
                          }`}
                        >
                          {r.error ? "ERR" : m.format(val)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!data && !loading && (
        <div className="p-8 text-center text-[10px] text-muted/40">
          Enter 2-6 tickers to compare side-by-side
        </div>
      )}
    </div>
  );
}
