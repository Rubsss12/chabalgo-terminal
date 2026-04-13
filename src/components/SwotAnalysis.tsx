"use client";

import { useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface SwotData {
  ticker: string;
  name: string;
  industry: string;
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
}

export default function SwotAnalysis({ ticker }: { ticker: string }) {
  const [data, setData] = useState<SwotData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    fetch(`${API_BASE}/swot/${ticker}`)
      .then((r) => {
        if (!r.ok) throw new Error("SWOT unavailable");
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
          <span className="text-[10px] text-muted tracking-wider">SWOT ANALYSIS...</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-subtle/50 rounded animate-pulse" />
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

  const quadrants = [
    {
      key: "strengths",
      label: "FORCES",
      icon: "M5 13l4 4L19 7",
      items: data.strengths,
      color: "text-green",
      bg: "bg-green/5",
      border: "border-green/15",
      dot: "bg-green",
    },
    {
      key: "weaknesses",
      label: "FAIBLESSES",
      icon: "M6 18L18 6M6 6l12 12",
      items: data.weaknesses,
      color: "text-red",
      bg: "bg-red/5",
      border: "border-red/15",
      dot: "bg-red",
    },
    {
      key: "opportunities",
      label: "OPPORTUNITÉS",
      icon: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6",
      items: data.opportunities,
      color: "text-accent",
      bg: "bg-accent/5",
      border: "border-accent/15",
      dot: "bg-accent",
    },
    {
      key: "threats",
      label: "MENACES",
      icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z",
      items: data.threats,
      color: "text-yellow",
      bg: "bg-yellow/5",
      border: "border-yellow/15",
      dot: "bg-yellow",
    },
  ];

  return (
    <div className="bg-card border border-border rounded-sm">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1 h-4 bg-accent rounded-full" />
          <span className="text-[11px] font-semibold tracking-wider text-foreground">SWOT ANALYSIS</span>
          <span className="text-[9px] text-muted/50 tracking-wider">DATA-DRIVEN</span>
        </div>
        {data.industry && (
          <span className="text-[9px] text-muted/40">{data.industry}</span>
        )}
      </div>

      {/* 2x2 Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
        {quadrants.map((q) => (
          <div key={q.key} className={`${q.bg} border ${q.border} m-2 rounded-sm p-3`}>
            <div className="flex items-center gap-1.5 mb-2">
              <svg className={`w-3.5 h-3.5 ${q.color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d={q.icon} />
              </svg>
              <span className={`text-[10px] font-bold tracking-wider ${q.color}`}>{q.label}</span>
              <span className="text-[9px] text-muted/30 ml-auto">{q.items.length}</span>
            </div>
            <div className="space-y-1.5">
              {q.items.map((item, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className={`w-1 h-1 ${q.dot} rounded-full mt-1.5 flex-shrink-0`} />
                  <span className="text-[10px] text-foreground/80 leading-relaxed">{item}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
