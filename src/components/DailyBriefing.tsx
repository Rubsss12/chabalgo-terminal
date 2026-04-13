"use client";

import { useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface IndexData {
  price: number;
  change_pct: number;
}

interface SectorMove {
  avg_change: number;
  best: { ticker: string; change: number };
  worst: { ticker: string; change: number };
}

interface Mover {
  ticker: string;
  price: number;
  change_pct: number;
}

interface BriefingSection {
  title: string;
  type: string;
  data: unknown;
}

interface BriefingData {
  date: string;
  sections: BriefingSection[];
  ai_summary: string;
}

export default function DailyBriefing({ onSearch }: { onSearch?: (ticker: string) => void }) {
  const [data, setData] = useState<BriefingData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE}/daily-briefing`)
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
          <span className="text-accent text-xs tracking-widest animate-pulse">GENERATING DAILY BRIEFING...</span>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-card border border-border p-5">
        <div className="text-muted text-xs">Daily briefing unavailable</div>
      </div>
    );
  }

  const changeColor = (pct: number) => (pct >= 0 ? "text-green" : "text-red");

  return (
    <div className="bg-card border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-accent text-xs font-semibold tracking-wider">DAILY BRIEFING</h3>
            <span className="text-[9px] px-1.5 py-0.5 bg-accent/10 text-accent border border-accent/20 animate-pulse">LIVE</span>
          </div>
          <div className="text-muted text-[10px] mt-0.5">{data.date}</div>
        </div>
      </div>

      {/* AI Summary */}
      <div className="bg-subtle/50 border-l-2 border-accent/30 pl-3 pr-3 py-2.5 mb-4">
        <div className="text-accent/60 text-[9px] font-semibold tracking-[0.15em] mb-1.5">
          AI BRIEFING
        </div>
        <p className="text-[11px] text-muted leading-[1.7]">{data.ai_summary}</p>
      </div>

      {data.sections.map((section) => {
        if (section.type === "indices") {
          const indices = section.data as Record<string, IndexData>;
          return (
            <div key={section.type} className="mb-4">
              <div className="text-[10px] text-muted tracking-wider mb-2">{section.title.toUpperCase()}</div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {Object.entries(indices).map(([name, d]) => (
                  <div key={name} className="border border-border/50 p-2">
                    <div className="text-[9px] text-muted/60">{name}</div>
                    <div className="text-xs text-foreground font-medium">
                      {name === "VIX" ? d.price.toFixed(1) : d.price.toLocaleString()}
                    </div>
                    <div className={`text-[11px] font-semibold ${changeColor(d.change_pct)}`}>
                      {d.change_pct > 0 ? "+" : ""}{d.change_pct}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        }

        if (section.type === "sectors") {
          const sectors = section.data as Record<string, SectorMove>;
          return (
            <div key={section.type} className="mb-4">
              <div className="text-[10px] text-muted tracking-wider mb-2">{section.title.toUpperCase()}</div>
              <div className="space-y-1.5">
                {Object.entries(sectors).map(([name, d]) => (
                  <div key={name} className="flex items-center gap-3">
                    <div className="w-40 text-[10px] text-foreground truncate">{name}</div>
                    <div className="flex-1 h-2 bg-subtle rounded-full overflow-hidden relative">
                      {d.avg_change >= 0 ? (
                        <div
                          className="absolute left-1/2 h-full bg-green/50 rounded-full"
                          style={{ width: `${Math.min(50, Math.abs(d.avg_change) * 8)}%` }}
                        />
                      ) : (
                        <div
                          className="absolute h-full bg-red/50 rounded-full"
                          style={{ width: `${Math.min(50, Math.abs(d.avg_change) * 8)}%`, right: "50%" }}
                        />
                      )}
                    </div>
                    <div className={`w-12 text-right text-[10px] font-semibold ${changeColor(d.avg_change)}`}>
                      {d.avg_change > 0 ? "+" : ""}{d.avg_change}%
                    </div>
                    <div className="w-20 text-[9px] text-muted/50 truncate">
                      <span className="text-green">{d.best.ticker}</span> / <span className="text-red">{d.worst.ticker}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        }

        if (section.type === "movers") {
          const movers = section.data as { gainers: Mover[]; losers: Mover[] };
          return (
            <div key={section.type} className="mb-4">
              <div className="text-[10px] text-muted tracking-wider mb-2">{section.title.toUpperCase()}</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <div className="text-[9px] text-green tracking-wider mb-1">TOP GAINERS</div>
                  {movers.gainers.map((m) => (
                    <div
                      key={m.ticker}
                      onClick={() => onSearch?.(m.ticker)}
                      className="flex items-center justify-between py-1 px-1 hover:bg-subtle/30 cursor-pointer text-[10px]"
                    >
                      <span className="text-accent font-semibold">{m.ticker}</span>
                      <span className="text-muted">${m.price}</span>
                      <span className="text-green font-semibold">+{m.change_pct}%</span>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="text-[9px] text-red tracking-wider mb-1">TOP LOSERS</div>
                  {movers.losers.map((m) => (
                    <div
                      key={m.ticker}
                      onClick={() => onSearch?.(m.ticker)}
                      className="flex items-center justify-between py-1 px-1 hover:bg-subtle/30 cursor-pointer text-[10px]"
                    >
                      <span className="text-accent font-semibold">{m.ticker}</span>
                      <span className="text-muted">${m.price}</span>
                      <span className="text-red font-semibold">{m.change_pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        }

        if (section.type === "events") {
          const events = section.data as Array<{ event: string; time: string; impact: string; country: string }>;
          return (
            <div key={section.type} className="mb-4">
              <div className="text-[10px] text-muted tracking-wider mb-2">{section.title.toUpperCase()}</div>
              {events.map((e, i) => (
                <div key={i} className="flex items-center gap-2 text-[10px] py-0.5">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${e.impact === "high" ? "bg-red" : e.impact === "medium" ? "bg-yellow" : "bg-muted/30"}`} />
                  <span className="text-muted/60 w-10">{e.time || "—"}</span>
                  <span className={e.impact === "high" ? "text-foreground font-medium" : "text-muted"}>{e.event}</span>
                </div>
              ))}
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}
