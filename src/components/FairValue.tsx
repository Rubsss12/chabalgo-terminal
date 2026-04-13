"use client";

import { useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Method {
  name: string;
  value: number;
  detail: string;
  confidence: string;
}

interface FairValueData {
  ticker: string;
  name: string;
  current_price: number | null;
  currency: string;
  composite_fair_value: number | null;
  upside_pct: number | null;
  verdict: string;
  methods: Method[];
  analyst_target: { mean: number; low: number; high: number; count: number } | null;
  ai_summary: string;
}

export default function FairValue({ ticker }: { ticker: string }) {
  const [data, setData] = useState<FairValueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    fetch(`${API_BASE}/fair-value/${ticker}`)
      .then((r) => {
        if (!r.ok) throw new Error("Fair value unavailable");
        return r.json();
      })
      .then((d) => setData(d))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [ticker]);

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-sm p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-4 h-4 border-2 border-accent/20 border-t-accent rounded-full animate-spin" />
          <span className="text-[10px] text-muted tracking-wider">FAIR VALUE...</span>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-6 bg-subtle/50 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-card border border-border rounded-sm p-4">
        <div className="text-[10px] text-red/70">{error || "No data"}</div>
      </div>
    );
  }

  const verdictColor = () => {
    switch (data.verdict) {
      case "SOUS-ÉVALUÉ": return "text-green";
      case "LÉGÈREMENT SOUS-ÉVALUÉ": return "text-green/80";
      case "CORRECTEMENT VALORISÉ": return "text-yellow";
      case "SUR-ÉVALUÉ": return "text-red";
      default: return "text-muted";
    }
  };

  const verdictBg = () => {
    switch (data.verdict) {
      case "SOUS-ÉVALUÉ": return "bg-green/8 border-green/20";
      case "LÉGÈREMENT SOUS-ÉVALUÉ": return "bg-green/5 border-green/15";
      case "CORRECTEMENT VALORISÉ": return "bg-yellow/5 border-yellow/15";
      case "SUR-ÉVALUÉ": return "bg-red/5 border-red/15";
      default: return "bg-subtle border-border";
    }
  };

  const confidenceColor = (c: string) => {
    if (c === "high") return "text-green bg-green/10";
    if (c === "medium") return "text-yellow bg-yellow/10";
    return "text-muted bg-subtle";
  };

  // Gauge position: map upside from -50..+50 to 0..100
  const gaugePos = data.upside_pct
    ? Math.max(0, Math.min(100, ((data.upside_pct + 50) / 100) * 100))
    : 50;

  return (
    <div className="bg-card border border-border rounded-sm">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1 h-4 bg-accent rounded-full" />
          <span className="text-[11px] font-semibold tracking-wider text-foreground">FAIR VALUE</span>
          <span className="text-[9px] text-muted/50 tracking-wider">MULTI-MODEL</span>
        </div>
        <span className="text-[9px] text-muted/40">{data.currency}</span>
      </div>

      <div className="p-4 space-y-4">
        {/* Verdict banner */}
        <div className={`border rounded-sm p-3 ${verdictBg()}`}>
          <div className="flex items-center justify-between">
            <div>
              <div className={`text-xs font-bold tracking-wider ${verdictColor()}`}>{data.verdict}</div>
              {data.composite_fair_value && (
                <div className="text-lg font-bold text-foreground mt-0.5">
                  ${data.composite_fair_value.toFixed(2)}
                  <span className="text-[10px] text-muted/60 ml-1.5">fair value</span>
                </div>
              )}
            </div>
            <div className="text-right">
              {data.current_price && (
                <div className="text-[10px] text-muted/60">
                  Prix actuel: <span className="text-foreground font-medium">${data.current_price.toFixed(2)}</span>
                </div>
              )}
              {data.upside_pct !== null && (
                <div className={`text-sm font-bold mt-0.5 ${data.upside_pct >= 0 ? "text-green" : "text-red"}`}>
                  {data.upside_pct >= 0 ? "+" : ""}{data.upside_pct}%
                </div>
              )}
            </div>
          </div>

          {/* Gauge bar */}
          {data.upside_pct !== null && (
            <div className="mt-3">
              <div className="relative h-2 bg-gradient-to-r from-red/30 via-yellow/30 to-green/30 rounded-full">
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-foreground rounded-full border-2 border-card shadow-md transition-all"
                  style={{ left: `${gaugePos}%`, transform: `translate(-50%, -50%)` }}
                />
              </div>
              <div className="flex justify-between mt-1 text-[8px] text-muted/40">
                <span>Sur-évalué</span>
                <span>Fair value</span>
                <span>Sous-évalué</span>
              </div>
            </div>
          )}
        </div>

        {/* Methods table */}
        <div>
          <div className="text-[9px] text-muted/50 tracking-wider mb-2">MÉTHODES DE VALORISATION</div>
          <div className="space-y-1.5">
            {data.methods.map((m, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 px-2 bg-subtle/30 rounded-sm">
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] text-foreground font-medium truncate">{m.name}</div>
                  <div className="text-[9px] text-muted/50 truncate">{m.detail}</div>
                </div>
                <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                  <span className={`text-[8px] px-1.5 py-0.5 rounded-sm font-medium ${confidenceColor(m.confidence)}`}>
                    {m.confidence.toUpperCase()}
                  </span>
                  <span className="text-sm font-bold text-foreground w-20 text-right">${m.value.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Analyst target range */}
        {data.analyst_target && (
          <div className="border border-border/50 rounded-sm p-3">
            <div className="text-[9px] text-muted/50 tracking-wider mb-2">OBJECTIF ANALYSTES ({data.analyst_target.count})</div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-red/70">${data.analyst_target.low}</span>
              <div className="flex-1 relative h-1.5 bg-subtle rounded-full">
                {data.current_price && data.analyst_target.low && data.analyst_target.high && (
                  <>
                    <div
                      className="absolute h-full bg-accent/30 rounded-full"
                      style={{
                        left: "0%",
                        width: `${((data.analyst_target.mean - data.analyst_target.low) / (data.analyst_target.high - data.analyst_target.low)) * 100}%`,
                      }}
                    />
                    <div
                      className="absolute top-1/2 -translate-y-1/2 w-2 h-2 bg-accent rounded-full"
                      style={{
                        left: `${((data.analyst_target.mean - data.analyst_target.low) / (data.analyst_target.high - data.analyst_target.low)) * 100}%`,
                      }}
                    />
                  </>
                )}
              </div>
              <span className="text-[10px] text-green/70">${data.analyst_target.high}</span>
            </div>
            <div className="text-center text-[10px] text-accent font-medium mt-1">
              Moyenne: ${data.analyst_target.mean}
            </div>
          </div>
        )}

        {/* AI Summary */}
        <div className="bg-accent/5 border border-accent/10 rounded-sm p-3">
          <div className="text-[9px] text-accent/60 tracking-wider mb-1">AI ANALYSIS</div>
          <div className="text-[11px] text-foreground/80 leading-relaxed">{data.ai_summary}</div>
        </div>
      </div>
    </div>
  );
}
