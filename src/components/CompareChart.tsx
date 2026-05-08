"use client";

import { useEffect, useRef, useState } from "react";
import {
  createChart,
  LineSeries,
  ColorType,
  type IChartApi,
  type ISeriesApi,
} from "lightweight-charts";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const COLORS = ["#F37021", "#4A90E2", "#9B59B6", "#2D8B4E", "#C0392B"];

function readVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

type Range = "1M" | "3M" | "6M" | "YTD" | "1Y";
const RANGE_DAYS: Record<Range, number> = { "1M": 30, "3M": 90, "6M": 180, "YTD": 365, "1Y": 365 };

interface SeriesPoint { time: string; value: number; }

export default function CompareChart() {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRefs = useRef<ISeriesApi<"Line">[]>([]);
  const [tickers, setTickers] = useState<string[]>(["NVDA", "AMD", "AVGO"]);
  const [input, setInput] = useState("");
  const [range, setRange] = useState<Range>("3M");
  const [normalized, setNormalized] = useState(true);
  const [data, setData] = useState<Record<string, SeriesPoint[]>>({});
  const [loading, setLoading] = useState(false);

  // Init chart
  useEffect(() => {
    if (!containerRef.current) return;
    const isDark = document.documentElement.dataset.theme === "dark";
    const bg = readVar("--background", isDark ? "#0E0F11" : "#FAF8F5");
    const fg = readVar("--foreground", isDark ? "#F5F4F1" : "#1A1A1A");
    const grid = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)";
    const border = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)";
    const chart = createChart(containerRef.current, {
      layout: { background: { type: ColorType.Solid, color: bg }, textColor: fg, fontFamily: "ui-sans-serif, system-ui, -apple-system" },
      grid: { vertLines: { color: grid }, horzLines: { color: grid } },
      crosshair: { mode: 1, vertLine: { color: "#F37021", width: 1, style: 2 }, horzLine: { color: "#F37021", width: 1, style: 2 } },
      timeScale: { borderColor: border },
      rightPriceScale: { borderColor: border },
      autoSize: true,
    });
    chartRef.current = chart;
    const obs = new MutationObserver(() => {
      const newDark = document.documentElement.dataset.theme === "dark";
      const newBg = readVar("--background", newDark ? "#0E0F11" : "#FAF8F5");
      const newFg = readVar("--foreground", newDark ? "#F5F4F1" : "#1A1A1A");
      const newGrid = newDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)";
      const newBorder = newDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)";
      chart.applyOptions({
        layout: { background: { type: ColorType.Solid, color: newBg }, textColor: newFg },
        grid: { vertLines: { color: newGrid }, horzLines: { color: newGrid } },
        timeScale: { borderColor: newBorder },
        rightPriceScale: { borderColor: newBorder },
      });
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => { obs.disconnect(); chart.remove(); chartRef.current = null; };
  }, []);

  // Fetch data for each ticker
  useEffect(() => {
    let cancelled = false;
    const fetchAll = async () => {
      setLoading(true);
      const days = RANGE_DAYS[range];
      const startDate = (() => {
        const d = new Date();
        if (range === "YTD") return new Date(d.getFullYear(), 0, 1);
        d.setDate(d.getDate() - days);
        return d;
      })();
      const startStr = startDate.toISOString().slice(0, 10);
      const out: Record<string, SeriesPoint[]> = {};
      for (const t of tickers) {
        try {
          const r = await fetch(`${API_BASE}/analyze/${encodeURIComponent(t)}`);
          if (!r.ok) continue;
          const d = await r.json();
          const hist = (d.historical || []) as { date: string; close: number }[];
          const filtered = hist.filter((p) => p.date >= startStr);
          out[t] = filtered.map((p) => ({ time: p.date, value: p.close }));
        } catch {}
      }
      if (!cancelled) {
        setData(out);
        setLoading(false);
      }
    };
    if (tickers.length > 0) fetchAll();
    return () => { cancelled = true; };
  }, [tickers, range]);

  // Update chart series
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    seriesRefs.current.forEach((s) => { try { chart.removeSeries(s); } catch {} });
    seriesRefs.current = [];

    tickers.forEach((t, i) => {
      const points = data[t];
      if (!points || points.length === 0) return;
      const transformed = normalized
        ? points.map((p) => ({ time: p.time, value: ((p.value - points[0].value) / points[0].value) * 100 }))
        : points;
      const series = chart.addSeries(LineSeries, {
        color: COLORS[i % COLORS.length],
        lineWidth: 2,
        title: t,
      });
      series.setData(transformed);
      seriesRefs.current.push(series);
    });

    chart.timeScale().fitContent();
  }, [data, tickers, normalized]);

  const addTicker = () => {
    const t = input.trim().toUpperCase();
    if (!t || tickers.includes(t) || tickers.length >= 5) return;
    setTickers([...tickers, t]);
    setInput("");
  };

  const removeTicker = (t: string) => setTickers(tickers.filter((x) => x !== t));

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-1 h-4 bg-accent rounded-full" />
          <span className="text-xs font-bold tracking-wider text-foreground">COMPARE</span>
          <span className="text-[9px] bg-accent/10 text-accent px-2 py-0.5 rounded-md font-bold tracking-wider">UP TO 5</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setNormalized(!normalized)}
            className={`text-[10px] px-2 py-1 rounded-md font-medium transition-colors ${
              normalized ? "bg-accent/10 text-accent ring-1 ring-accent/20" : "bg-subtle text-muted hover:text-foreground"
            }`}
            title="Normalize to % from start"
          >
            % CHANGE
          </button>
          <div className="flex items-center bg-subtle rounded-lg p-0.5 gap-0.5">
            {(["1M", "3M", "6M", "YTD", "1Y"] as Range[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`text-[10px] px-2 py-1 rounded-md font-medium tracking-wider transition-colors ${
                  range === r ? "bg-card text-accent shadow-sm" : "text-muted hover:text-foreground"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Ticker pills + input */}
      <div className="px-4 py-3 border-b border-border flex items-center gap-2 flex-wrap">
        {tickers.map((t, i) => (
          <span
            key={t}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border bg-card"
            style={{ borderColor: COLORS[i % COLORS.length] + "55", color: COLORS[i % COLORS.length] }}
          >
            <span className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
            {t}
            <button onClick={() => removeTicker(t)} className="text-muted hover:text-red ml-0.5">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </span>
        ))}
        {tickers.length < 5 && (
          <form onSubmit={(e) => { e.preventDefault(); addTicker(); }} className="flex items-center gap-1.5">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="+ ticker"
              className="bg-subtle border border-border rounded-lg px-2.5 py-1 text-xs w-24 outline-none focus:border-accent/40"
            />
            <button type="submit" className="text-[10px] text-accent font-bold hover:text-accent/80">ADD</button>
          </form>
        )}
        {loading && <span className="text-[10px] text-muted animate-pulse">Loading...</span>}
      </div>

      <div ref={containerRef} className="w-full h-[380px]" />
    </div>
  );
}
