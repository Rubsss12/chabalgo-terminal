"use client";

import { useState, useEffect } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface TrendPoint {
  date: string;
  value: number;
}

interface Indicator {
  name: string;
  unit: string;
  frequency: string;
  latest_value: number;
  latest_date: string;
  change: number | null;
  trend: TrendPoint[];
}

interface YieldCurve {
  "10Y"?: number;
  "2Y"?: number;
  "3M"?: number;
  "10Y_2Y_spread"?: number;
  inverted?: boolean;
}

interface MacroData {
  indicators: Record<string, Indicator>;
  yield_curve: YieldCurve;
}

function Sparkline({ data, color }: { data: TrendPoint[]; color: string }) {
  if (!data || data.length < 2) return null;
  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 80;
  const h = 24;
  const points = values
    .map((v, i) => `${(i / (values.length - 1)) * w},${h - ((v - min) / range) * h}`)
    .join(" ");
  return (
    <svg width={w} height={h} className="flex-shrink-0">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.2" />
    </svg>
  );
}

const HIGHLIGHT_SERIES = ["FEDFUNDS", "DGS10", "UNRATE", "CPIAUCSL", "T10Y2Y", "VIXCLS"];

export default function MacroDashboard() {
  const [data, setData] = useState<MacroData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API_BASE}/macro/dashboard`)
      .then((r) => {
        if (!r.ok) throw new Error(r.status === 503 ? "FRED API key not configured" : "Failed to load");
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-sm p-6">
        <div className="flex items-center gap-2 text-[10px] text-muted animate-pulse">
          <div className="w-3 h-3 border border-accent/30 border-t-accent rounded-full animate-spin" />
          Loading macro indicators...
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-card border border-border rounded-sm p-4">
        <div className="text-[10px] text-muted/50">{error || "Macro data unavailable"}</div>
      </div>
    );
  }

  const indicators = data.indicators;
  const yc = data.yield_curve;

  return (
    <div className="bg-card border border-border rounded-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1 h-4 bg-accent rounded-full" />
          <span className="text-[11px] font-bold tracking-wider text-foreground">MACRO DASHBOARD</span>
          <span className="text-[8px] bg-accent/10 text-accent px-1.5 py-0.5 rounded-sm font-bold tracking-widest">FRED</span>
        </div>
        <span className="text-[8px] text-muted/40">Federal Reserve Economic Data</span>
      </div>

      {/* Yield Curve */}
      {(yc["10Y"] || yc["2Y"]) && (
        <div className="px-4 py-3 border-b border-border bg-background/50">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-[9px] text-muted/60 font-medium tracking-wider">YIELD CURVE</span>
            {yc["3M"] != null && (
              <div className="text-[10px]">
                <span className="text-muted/50">3M:</span>{" "}
                <span className="text-foreground font-medium">{yc["3M"].toFixed(2)}%</span>
              </div>
            )}
            {yc["2Y"] != null && (
              <div className="text-[10px]">
                <span className="text-muted/50">2Y:</span>{" "}
                <span className="text-foreground font-medium">{yc["2Y"].toFixed(2)}%</span>
              </div>
            )}
            {yc["10Y"] != null && (
              <div className="text-[10px]">
                <span className="text-muted/50">10Y:</span>{" "}
                <span className="text-foreground font-medium">{yc["10Y"].toFixed(2)}%</span>
              </div>
            )}
            {yc["10Y_2Y_spread"] != null && (
              <div className="text-[10px]">
                <span className="text-muted/50">Spread:</span>{" "}
                <span className={`font-bold ${yc.inverted ? "text-red" : "text-green"}`}>
                  {yc["10Y_2Y_spread"] > 0 ? "+" : ""}{yc["10Y_2Y_spread"].toFixed(2)}%
                </span>
                {yc.inverted && <span className="text-[7px] text-red/70 ml-1 font-bold">INVERTED</span>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Key metrics grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-y divide-border">
        {HIGHLIGHT_SERIES.map((key) => {
          const ind = indicators[key];
          if (!ind) return null;
          const isUp = ind.change != null && ind.change > 0;
          const isDown = ind.change != null && ind.change < 0;
          return (
            <div key={key} className="p-3 hover:bg-background/50 transition-colors">
              <div className="text-[8px] text-muted/50 font-medium tracking-wider mb-1 truncate">{ind.name}</div>
              <div className="flex items-end justify-between gap-1">
                <div>
                  <div className="text-[14px] font-bold text-foreground">
                    {ind.unit === "%" ? `${ind.latest_value.toFixed(2)}%` : ind.latest_value.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                  </div>
                  {ind.change != null && (
                    <div className={`text-[9px] font-medium ${isUp ? "text-green" : isDown ? "text-red" : "text-muted/50"}`}>
                      {isUp ? "+" : ""}{ind.change.toFixed(ind.unit === "%" ? 2 : 1)}
                    </div>
                  )}
                </div>
                <Sparkline data={ind.trend} color={isDown ? "rgb(239,68,68)" : isUp ? "rgb(34,197,94)" : "rgb(100,116,139)"} />
              </div>
              <div className="text-[7px] text-muted/30 mt-1">{ind.latest_date}</div>
            </div>
          );
        })}
      </div>

      {/* All indicators table */}
      <div className="px-4 py-2 border-t border-border">
        <details>
          <summary className="text-[9px] text-muted/40 cursor-pointer hover:text-muted transition-colors tracking-wider">
            ALL {Object.keys(indicators).length} INDICATORS
          </summary>
          <div className="mt-2 space-y-1 max-h-64 overflow-y-auto">
            {Object.entries(indicators).map(([key, ind]) => (
              <div key={key} className="flex items-center justify-between text-[10px] py-1 border-b border-border/30">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-muted/40 font-mono text-[8px] w-16 flex-shrink-0">{key}</span>
                  <span className="text-foreground/80 truncate">{ind.name}</span>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <Sparkline data={ind.trend} color="rgb(100,116,139)" />
                  <span className="font-medium text-foreground w-20 text-right">
                    {ind.unit === "%" ? `${ind.latest_value.toFixed(2)}%` : ind.latest_value.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                  </span>
                  {ind.change != null && (
                    <span className={`w-12 text-right text-[9px] ${ind.change > 0 ? "text-green" : ind.change < 0 ? "text-red" : "text-muted/40"}`}>
                      {ind.change > 0 ? "+" : ""}{ind.change.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </details>
      </div>
    </div>
  );
}
