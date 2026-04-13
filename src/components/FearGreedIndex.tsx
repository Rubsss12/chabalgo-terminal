"use client";

import { useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Signal {
  value: number;
  label: string;
  signal: string;
  score: number;
  description: string;
}

interface FearGreedData {
  composite_score: number;
  verdict: string;
  color: string;
  advice: string;
  signals: Record<string, Signal>;
}

const SIGNAL_COLORS: Record<string, string> = {
  extreme_fear: "text-green",
  fear: "text-green/80",
  neutral: "text-yellow",
  greed: "text-red/80",
  extreme_greed: "text-red",
};

const SIGNAL_LABELS: Record<string, string> = {
  extreme_fear: "PEUR EXTRÊME",
  fear: "PEUR",
  neutral: "NEUTRE",
  greed: "AVIDITÉ",
  extreme_greed: "AVIDITÉ EXTRÊME",
};

export default function FearGreedIndex() {
  const [data, setData] = useState<FearGreedData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE}/fear-greed`)
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
          <span className="text-accent text-xs tracking-widest animate-pulse">COMPUTING MARKET SENTIMENT...</span>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-card border border-border p-5">
        <div className="text-muted text-xs">Fear & Greed Index unavailable</div>
      </div>
    );
  }

  // Gauge needle rotation: 0 = extreme fear (left), 100 = extreme greed (right)
  const needleAngle = -90 + (data.composite_score / 100) * 180;

  const gaugeColor =
    data.composite_score >= 75 ? "text-red" :
    data.composite_score >= 55 ? "text-yellow" :
    data.composite_score >= 25 ? "text-yellow" :
    "text-green";

  const scoreBar = (s: number) => {
    if (s >= 60) return "bg-green";
    if (s >= 40) return "bg-yellow";
    return "bg-red";
  };

  return (
    <div className="bg-card border border-border p-5">
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-accent text-xs font-semibold tracking-wider">FEAR & GREED INDEX</h3>
        <span className="text-[9px] px-1.5 py-0.5 bg-accent/10 text-accent border border-accent/20">SENTIMENT</span>
      </div>

      {/* Main gauge */}
      <div className="flex items-center gap-6 mb-4">
        <div className="relative w-32 h-16 flex-shrink-0">
          <svg viewBox="0 0 200 100" className="w-full h-full">
            {/* Background arc */}
            <path d="M 10 95 A 90 90 0 0 1 190 95" fill="none" stroke="currentColor" strokeWidth="12" className="text-subtle" strokeLinecap="round" />
            {/* Fear zone (green) */}
            <path d="M 10 95 A 90 90 0 0 1 55 20" fill="none" stroke="currentColor" strokeWidth="12" className="text-green/40" strokeLinecap="round" />
            {/* Neutral zone */}
            <path d="M 55 20 A 90 90 0 0 1 145 20" fill="none" stroke="currentColor" strokeWidth="12" className="text-yellow/40" strokeLinecap="round" />
            {/* Greed zone (red) */}
            <path d="M 145 20 A 90 90 0 0 1 190 95" fill="none" stroke="currentColor" strokeWidth="12" className="text-red/40" strokeLinecap="round" />
            {/* Needle */}
            <line
              x1="100" y1="95" x2="100" y2="25"
              stroke="currentColor"
              strokeWidth="3"
              className={gaugeColor}
              transform={`rotate(${needleAngle}, 100, 95)`}
              strokeLinecap="round"
            />
            <circle cx="100" cy="95" r="6" fill="currentColor" className={gaugeColor} />
          </svg>
        </div>
        <div>
          <div className={`text-3xl font-bold ${gaugeColor}`}>{data.composite_score}</div>
          <div className={`text-sm font-semibold ${gaugeColor}`}>{data.verdict}</div>
          <div className="text-[9px] text-muted/50">/ 100</div>
        </div>
      </div>

      {/* Signals */}
      <div className="space-y-2 mb-4">
        {Object.entries(data.signals).map(([key, signal]) => (
          <div key={key} className="flex items-center gap-3">
            <div className="w-40 text-[10px] text-muted truncate">{signal.label}</div>
            <div className="flex-1 h-2 bg-subtle rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${scoreBar(signal.score)}`}
                style={{ width: `${signal.score}%` }}
              />
            </div>
            <div className={`w-16 text-right text-[9px] font-semibold ${SIGNAL_COLORS[signal.signal] || "text-muted"}`}>
              {SIGNAL_LABELS[signal.signal] || signal.signal}
            </div>
          </div>
        ))}
      </div>

      {/* Signal details */}
      <div className="space-y-1 mb-4">
        {Object.entries(data.signals).map(([key, signal]) => (
          <div key={`desc-${key}`} className="text-[10px] text-muted/70 leading-relaxed">
            &bull; {signal.description}
          </div>
        ))}
      </div>

      {/* AI Advice */}
      <div className="bg-subtle/50 border-l-2 border-accent/30 pl-3 pr-3 py-2.5">
        <div className="text-accent/60 text-[9px] font-semibold tracking-[0.15em] mb-1.5">
          AI ANALYSIS — MARKET SENTIMENT
        </div>
        <p className="text-[11px] text-muted leading-[1.7]">{data.advice}</p>
      </div>
    </div>
  );
}
