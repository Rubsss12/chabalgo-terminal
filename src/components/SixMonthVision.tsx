"use client";

import { useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Factor {
  name: string;
  weight: number;
  score: number;
  detail: Record<string, unknown>;
}

interface Catalyst {
  event: string;
  date: string;
  impact: string;
  description: string;
}

interface VisionData {
  ticker: string;
  name: string;
  sector: string;
  horizon: string;
  composite_score: number;
  verdict: string;
  verdict_color: string;
  outlook: string;
  entry_analysis: string;
  factors: Factor[];
  catalysts: Catalyst[];
}

export default function SixMonthVision({ ticker }: { ticker: string }) {
  const [data, setData] = useState<VisionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    fetch(`${API_BASE}/vision/${ticker}`)
      .then((r) => {
        if (!r.ok) throw new Error("Vision data unavailable");
        return r.json();
      })
      .then((d) => setData(d))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [ticker]);

  if (loading) {
    return (
      <div className="bg-card border border-border p-5">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-accent/20 border-t-accent rounded-full animate-spin" />
          <span className="text-accent text-xs tracking-widest animate-pulse">
            COMPUTING 6-MONTH VISION...
          </span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-card border border-border p-5">
        <div className="text-muted text-xs">6-month vision unavailable for {ticker}</div>
      </div>
    );
  }

  const verdictBg =
    data.verdict_color === "green"
      ? "bg-green/10 border-green/30"
      : data.verdict_color === "red"
      ? "bg-red/10 border-red/30"
      : "bg-yellow/10 border-yellow/30";

  const verdictText =
    data.verdict_color === "green"
      ? "text-green"
      : data.verdict_color === "red"
      ? "text-red"
      : "text-yellow";

  const scoreColor = (s: number) => {
    if (s >= 70) return "text-green";
    if (s >= 55) return "text-yellow";
    return "text-red";
  };

  const scoreBar = (s: number) => {
    if (s >= 70) return "bg-green";
    if (s >= 55) return "bg-yellow";
    return "bg-red";
  };

  const impactBadge = (impact: string) => {
    if (impact === "very_high")
      return "bg-accent/10 text-accent border-accent/30";
    if (impact === "high")
      return "bg-green/10 text-green border-green/30";
    return "bg-muted/10 text-muted border-border";
  };

  return (
    <div className="bg-card border border-border p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-accent text-xs font-semibold tracking-wider">
              VISION 6 MOIS
            </h3>
            <span className="text-[9px] px-1.5 py-0.5 bg-accent/10 text-accent border border-accent/20">
              FORWARD-LOOKING
            </span>
          </div>
          <div className="text-muted text-[10px] mt-0.5">
            {data.name} &middot; {data.sector}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-muted/50 tracking-wider">HORIZON</div>
          <div className="text-xs text-foreground font-medium">{data.horizon}</div>
        </div>
      </div>

      {/* Verdict banner */}
      <div className={`border ${verdictBg} p-4 mb-4`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div
              className={`text-2xl font-bold ${verdictText}`}
            >
              {data.composite_score}
            </div>
            <div>
              <div className={`text-sm font-semibold ${verdictText}`}>
                {data.verdict}
              </div>
              <div className="text-[10px] text-muted">Score composite / 100</div>
            </div>
          </div>
          {/* Score arc visualization */}
          <div className="relative w-16 h-8 overflow-hidden">
            <svg viewBox="0 0 100 50" className="w-full h-full">
              <path
                d="M 5 50 A 45 45 0 0 1 95 50"
                fill="none"
                stroke="currentColor"
                strokeWidth="6"
                className="text-subtle"
              />
              <path
                d="M 5 50 A 45 45 0 0 1 95 50"
                fill="none"
                stroke="currentColor"
                strokeWidth="6"
                className={verdictText}
                strokeDasharray={`${(data.composite_score / 100) * 141.37} 141.37`}
              />
            </svg>
          </div>
        </div>
        <p className="text-[11px] text-foreground/80 leading-relaxed">
          {data.outlook}
        </p>
      </div>

      {/* Factor scores */}
      <div className="mb-4">
        <div className="text-[10px] text-muted tracking-wider mb-2">
          FACTEURS D&apos;ANALYSE
        </div>
        <div className="space-y-2">
          {data.factors.map((f) => (
            <div key={f.name} className="flex items-center gap-3">
              <div className="w-44 text-xs text-foreground truncate">
                {f.name}
              </div>
              <div className="flex-1 h-2 bg-subtle rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${scoreBar(f.score)}`}
                  style={{ width: `${f.score}%` }}
                />
              </div>
              <div className={`w-10 text-right text-xs font-semibold ${scoreColor(f.score)}`}>
                {f.score}
              </div>
              <div className="w-10 text-right text-[9px] text-muted/50">
                x{f.weight}%
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Entry analysis */}
      <div className="bg-subtle/50 border-l-2 border-accent/30 pl-3 pr-3 py-2.5 mb-4">
        <div className="text-accent/60 text-[9px] font-semibold tracking-[0.15em] mb-1.5">
          ANALYSE D&apos;ENTRÉE
        </div>
        <p className="text-[11px] text-muted leading-[1.7]">
          {data.entry_analysis}
        </p>
      </div>

      {/* Catalysts */}
      {data.catalysts.length > 0 && (
        <div>
          <div className="text-[10px] text-muted tracking-wider mb-2">
            CATALYSEURS SECTORIELS
          </div>
          <div className="space-y-2">
            {data.catalysts.map((c) => (
              <div
                key={c.event}
                className="border border-border/50 p-3 hover:bg-subtle/30 transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-foreground">
                      {c.event}
                    </span>
                    <span
                      className={`text-[9px] px-1.5 py-0.5 border ${impactBadge(c.impact)}`}
                    >
                      {c.impact === "very_high"
                        ? "TRÈS FORT"
                        : c.impact === "high"
                        ? "FORT"
                        : "MOYEN"}
                    </span>
                  </div>
                  <span className="text-[10px] text-accent font-medium">
                    {c.date}
                  </span>
                </div>
                <p className="text-[10px] text-muted leading-relaxed">
                  {c.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-3 text-[9px] text-muted/40">
        Analyse prospective basée sur le momentum, les catalyseurs sectoriels et
        les fondamentaux. Ne constitue pas un conseil en investissement.
      </div>
    </div>
  );
}
