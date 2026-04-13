"use client";

import { useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface StockData {
  ticker: string;
  price: number;
  change_pct: number;
}

interface SectorData {
  stocks: StockData[];
  avg_change: number;
  count: number;
}

interface HeatmapData {
  period: string;
  sectors: Record<string, SectorData>;
}

type Period = "1d" | "1w" | "1m";

export default function SectorHeatmap({ onSearch }: { onSearch?: (ticker: string) => void }) {
  const [data, setData] = useState<HeatmapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("1d");

  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE}/heatmap?period=${period}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [period]);

  if (loading) {
    return (
      <div className="bg-card border border-border p-5">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-accent/20 border-t-accent rounded-full animate-spin" />
          <span className="text-accent text-xs tracking-widest animate-pulse">LOADING HEATMAP...</span>
        </div>
      </div>
    );
  }

  if (!data || Object.keys(data.sectors).length === 0) {
    return (
      <div className="bg-card border border-border p-5">
        <div className="text-muted text-xs">Heatmap unavailable</div>
      </div>
    );
  }

  const cellColor = (pct: number) => {
    if (pct > 3) return "bg-green/30 text-green";
    if (pct > 1) return "bg-green/15 text-green";
    if (pct > 0) return "bg-green/5 text-green/80";
    if (pct > -1) return "bg-red/5 text-red/80";
    if (pct > -3) return "bg-red/15 text-red";
    return "bg-red/30 text-red";
  };

  const sectorColor = (pct: number) => {
    if (pct > 1) return "text-green";
    if (pct > -1) return "text-yellow";
    return "text-red";
  };

  return (
    <div className="bg-card border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-accent text-xs font-semibold tracking-wider">SECTOR HEATMAP</h3>
            <span className="text-[9px] px-1.5 py-0.5 bg-accent/10 text-accent border border-accent/20">MARKET FLOW</span>
          </div>
          <div className="text-muted text-[10px] mt-0.5">
            {Object.keys(data.sectors).length} sectors &middot; Money flow visualization
          </div>
        </div>
        <div className="flex gap-1">
          {(["1d", "1w", "1m"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`text-[10px] px-2 py-1 border transition-colors ${
                period === p ? "bg-accent/10 text-accent border-accent/30" : "text-muted border-border hover:text-foreground"
              }`}
            >
              {p === "1d" ? "1J" : p === "1w" ? "1S" : "1M"}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {Object.entries(data.sectors).map(([sector, sectorData]) => (
          <div key={sector}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] text-foreground font-medium">{sector}</span>
              <span className={`text-[11px] font-semibold ${sectorColor(sectorData.avg_change)}`}>
                {sectorData.avg_change > 0 ? "+" : ""}{sectorData.avg_change}%
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {sectorData.stocks.map((s) => (
                <button
                  key={s.ticker}
                  onClick={() => onSearch?.(s.ticker)}
                  className={`px-2 py-1.5 text-[9px] font-medium transition-all hover:scale-105 cursor-pointer ${cellColor(s.change_pct)}`}
                >
                  <div className="font-semibold">{s.ticker}</div>
                  <div>{s.change_pct > 0 ? "+" : ""}{s.change_pct}%</div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
