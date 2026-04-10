"use client";

import { useEffect, useState, useMemo } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface EcoEvent {
  date: string;
  time: string;
  country: string;
  event: string;
  impact: string;
  actual: string | null;
  estimate: string | null;
  previous: string | null;
  unit: string;
}

interface CalendarData {
  events: EcoEvent[];
  this_week: EcoEvent[];
  next_week: EcoEvent[];
  high_impact_count: number;
  ai_summary: string;
}

type Filter = "ALL" | "HIGH" | "US";

const FLAG_MAP: Record<string, string> = {
  US: "\u{1F1FA}\u{1F1F8}",
  EU: "\u{1F1EA}\u{1F1FA}",
  GB: "\u{1F1EC}\u{1F1E7}",
  JP: "\u{1F1EF}\u{1F1F5}",
  CN: "\u{1F1E8}\u{1F1F3}",
  DE: "\u{1F1E9}\u{1F1EA}",
  FR: "\u{1F1EB}\u{1F1F7}",
};

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("fr-FR", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  } catch {
    return dateStr;
  }
}

function isToday(dateStr: string): boolean {
  const today = new Date().toISOString().split("T")[0];
  return dateStr === today;
}

export default function EconomicCalendar() {
  const [data, setData] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");

  useEffect(() => {
    setLoading(true);
    setError("");
    fetch(`${API_BASE}/economic-calendar?days=14`)
      .then((r) => {
        if (!r.ok) throw new Error("Calendar unavailable");
        return r.json();
      })
      .then((d) => setData(d))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filteredEvents = useMemo(() => {
    if (!data) return [];
    let events = data.events;
    if (filter === "HIGH") events = events.filter((e) => e.impact === "high");
    if (filter === "US") events = events.filter((e) => e.country === "US");
    return events;
  }, [data, filter]);

  // Group by date
  const grouped = useMemo(() => {
    const map = new Map<string, EcoEvent[]>();
    for (const ev of filteredEvents) {
      const key = ev.date;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    }
    return Array.from(map.entries());
  }, [filteredEvents]);

  // Next high-impact event countdown
  const nextHighImpact = useMemo(() => {
    if (!data) return null;
    const now = new Date();
    for (const ev of data.events) {
      if (ev.impact !== "high") continue;
      try {
        const evDate = new Date(
          `${ev.date}T${ev.time || "09:00"}:00`
        );
        if (evDate > now) return { event: ev, date: evDate };
      } catch {
        continue;
      }
    }
    return null;
  }, [data]);

  const [countdown, setCountdown] = useState("");
  useEffect(() => {
    if (!nextHighImpact) return;
    const tick = () => {
      const diff = nextHighImpact.date.getTime() - Date.now();
      if (diff <= 0) {
        setCountdown("NOW");
        return;
      }
      const days = Math.floor(diff / 86400000);
      const hrs = Math.floor((diff % 86400000) / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      if (days > 0) setCountdown(`${days}j ${hrs}h ${mins}m`);
      else setCountdown(`${hrs}h ${mins}m`);
    };
    tick();
    const interval = setInterval(tick, 60000);
    return () => clearInterval(interval);
  }, [nextHighImpact]);

  if (loading) {
    return (
      <div className="bg-card border border-border p-5">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-accent/20 border-t-accent rounded-full animate-spin" />
          <span className="text-accent text-xs tracking-widest animate-pulse">
            LOADING ECONOMIC CALENDAR...
          </span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-card border border-border p-5">
        <div className="text-muted text-xs">Economic calendar unavailable</div>
      </div>
    );
  }

  const impactDot = (impact: string) => {
    if (impact === "high") return "bg-red";
    if (impact === "medium") return "bg-yellow";
    return "bg-muted/30";
  };

  return (
    <div className="bg-card border border-border p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-accent text-xs font-semibold tracking-wider">
              CALENDRIER ÉCONOMIQUE
            </h3>
            <span className="text-[9px] px-1.5 py-0.5 bg-accent/10 text-accent border border-accent/20">
              MACRO
            </span>
            {data.high_impact_count > 0 && (
              <span className="text-[9px] px-1.5 py-0.5 bg-red/10 text-red border border-red/20">
                {data.high_impact_count} HIGH IMPACT
              </span>
            )}
          </div>
          <div className="text-muted text-[10px] mt-0.5">
            {data.events.length} events &middot; 14-day outlook
          </div>
        </div>
        {nextHighImpact && countdown && (
          <div className="text-right">
            <div className="text-[9px] text-muted/50 tracking-wider">
              NEXT HIGH IMPACT
            </div>
            <div className="text-accent text-xs font-bold">{countdown}</div>
            <div className="text-[9px] text-muted truncate max-w-[160px]">
              {nextHighImpact.event.event}
            </div>
          </div>
        )}
      </div>

      {/* AI Summary */}
      {data.ai_summary && (
        <div className="bg-subtle/50 border-l-2 border-accent/30 pl-3 pr-3 py-2.5 mb-4">
          <div className="text-accent/60 text-[9px] font-semibold tracking-[0.15em] mb-1.5">
            AI ANALYSIS — MACRO OUTLOOK
          </div>
          <p className="text-[11px] text-muted leading-[1.7]">
            {data.ai_summary}
          </p>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 mb-4">
        {(["ALL", "HIGH", "US"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-[10px] px-2.5 py-1 border transition-colors ${
              filter === f
                ? "bg-accent/10 text-accent border-accent/30"
                : "text-muted border-border hover:text-foreground hover:border-border"
            }`}
          >
            {f === "ALL"
              ? "TOUS"
              : f === "HIGH"
              ? "FORT IMPACT"
              : "US ONLY"}
          </button>
        ))}
      </div>

      {/* Calendar grouped by day */}
      <div className="space-y-1">
        {grouped.map(([date, events]) => {
          const today = isToday(date);
          return (
            <div key={date}>
              {/* Day header */}
              <div
                className={`flex items-center gap-2 py-1.5 px-2 ${
                  today ? "bg-accent/5 border-l-2 border-accent" : ""
                }`}
              >
                <span
                  className={`text-[11px] font-semibold ${
                    today ? "text-accent" : "text-foreground"
                  }`}
                >
                  {formatDate(date)}
                </span>
                {today && (
                  <span className="text-[8px] px-1.5 py-0.5 bg-accent/10 text-accent border border-accent/20 animate-pulse">
                    AUJOURD&apos;HUI
                  </span>
                )}
                <span className="text-[9px] text-muted/40">
                  {events.length} event{events.length > 1 ? "s" : ""}
                </span>
              </div>

              {/* Events for this day */}
              <div className="ml-2">
                {events.map((ev, i) => (
                  <div
                    key={`${ev.event}-${i}`}
                    className="flex items-center gap-3 py-1.5 px-2 border-b border-border/10 hover:bg-subtle/20"
                  >
                    {/* Impact dot */}
                    <div
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${impactDot(
                        ev.impact
                      )}`}
                    />
                    {/* Time */}
                    <div className="w-10 text-[10px] text-muted/60 flex-shrink-0">
                      {ev.time || "—"}
                    </div>
                    {/* Flag */}
                    <div className="w-5 text-[11px] flex-shrink-0">
                      {FLAG_MAP[ev.country] || ev.country}
                    </div>
                    {/* Event name */}
                    <div
                      className={`flex-1 text-[11px] ${
                        ev.impact === "high"
                          ? "text-foreground font-semibold"
                          : "text-muted"
                      }`}
                    >
                      {ev.event}
                    </div>
                    {/* Values */}
                    <div className="flex items-center gap-3 text-[10px]">
                      <div className="w-14 text-right">
                        {ev.actual !== null ? (
                          <span className="text-foreground font-semibold">
                            {ev.actual}
                            {ev.unit && ev.unit !== "%" ? ev.unit : ""}
                          </span>
                        ) : (
                          <span className="text-muted/30">—</span>
                        )}
                      </div>
                      <div className="w-14 text-right text-muted/60">
                        {ev.estimate !== null ? (
                          <span>Est: {ev.estimate}</span>
                        ) : (
                          <span className="text-muted/20">—</span>
                        )}
                      </div>
                      <div className="w-14 text-right text-muted/40">
                        {ev.previous !== null ? (
                          <span>Prev: {ev.previous}</span>
                        ) : (
                          <span className="text-muted/20">—</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {grouped.length === 0 && (
        <div className="text-center text-muted text-xs py-8">
          Aucun événement trouvé pour les filtres sélectionnés.
        </div>
      )}

      <div className="mt-3 text-[9px] text-muted/40">
        Impact: haute = FOMC, CPI, NFP, GDP &middot; moyenne = PCE, PPI, Retail
        Sales &middot; basse = Jobless Claims
      </div>
    </div>
  );
}
