"use client";

import { useEffect, useRef, useState } from "react";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  ColorType,
  type IChartApi,
  type ISeriesApi,
} from "lightweight-charts";
import { HistoricalPoint } from "@/lib/types";

type ChartType = "candle" | "line" | "area";
type Range = "1M" | "3M" | "6M" | "YTD" | "1Y" | "All";

interface ProChartProps {
  data: HistoricalPoint[];
  ticker: string;
}

const CREAM = "#FAF8F5";
const GREEN = "#2D8B4E";
const RED = "#C0392B";
const ACCENT = "#F37021";
const ACCENT_LIGHT = "rgba(243, 112, 33, 0.15)";
const MUTED = "rgba(120, 113, 108, 0.4)";
const FG = "#1A1A1A";

export default function ProChart({ data, ticker }: ProChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const lineSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const ma50Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const ma200Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const volumeRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const [chartType, setChartType] = useState<ChartType>("candle");
  const [range, setRange] = useState<Range>("6M");
  const [showMA, setShowMA] = useState(true);
  const [showVolume, setShowVolume] = useState(true);

  // Filter data by range
  const filtered = (() => {
    if (range === "All") return data;
    const now = new Date();
    let cutoff: Date;
    if (range === "1M") cutoff = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    else if (range === "3M") cutoff = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
    else if (range === "6M") cutoff = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
    else if (range === "YTD") cutoff = new Date(now.getFullYear(), 0, 1);
    else cutoff = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    return data.filter((d) => d.date >= cutoffStr);
  })();

  // Initialize chart once
  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: CREAM },
        textColor: FG,
        fontFamily: "ui-sans-serif, system-ui, -apple-system",
      },
      grid: {
        vertLines: { color: "rgba(0,0,0,0.04)" },
        horzLines: { color: "rgba(0,0,0,0.04)" },
      },
      crosshair: {
        mode: 1,
        vertLine: { color: ACCENT, width: 1, style: 2, labelBackgroundColor: ACCENT },
        horzLine: { color: ACCENT, width: 1, style: 2, labelBackgroundColor: ACCENT },
      },
      timeScale: {
        borderColor: "rgba(0,0,0,0.08)",
        timeVisible: false,
      },
      rightPriceScale: {
        borderColor: "rgba(0,0,0,0.08)",
      },
      autoSize: true,
    });

    chartRef.current = chart;

    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, []);

  // Update series when data, type, or toggles change
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    // Remove existing series
    [candleSeriesRef, lineSeriesRef, ma50Ref, ma200Ref, volumeRef].forEach((ref) => {
      if (ref.current) {
        try { chart.removeSeries(ref.current); } catch {}
        ref.current = null;
      }
    });

    if (filtered.length === 0) return;

    // Volume (background histogram on price scale '')
    if (showVolume) {
      const vol = chart.addSeries(HistogramSeries, {
        color: ACCENT_LIGHT,
        priceFormat: { type: "volume" },
        priceScaleId: "vol",
      });
      chart.priceScale("vol").applyOptions({
        scaleMargins: { top: 0.85, bottom: 0 },
      });
      vol.setData(
        filtered.map((d) => ({
          time: d.date,
          value: d.volume || 0,
          color: d.close >= d.open ? "rgba(45,139,78,0.25)" : "rgba(192,57,43,0.25)",
        }))
      );
      volumeRef.current = vol;
    }

    // Price series
    if (chartType === "candle") {
      const candle = chart.addSeries(CandlestickSeries, {
        upColor: GREEN,
        downColor: RED,
        borderUpColor: GREEN,
        borderDownColor: RED,
        wickUpColor: GREEN,
        wickDownColor: RED,
      });
      candle.setData(
        filtered.map((d) => ({
          time: d.date,
          open: d.open,
          high: d.high,
          low: d.low,
          close: d.close,
        }))
      );
      candleSeriesRef.current = candle;
    } else if (chartType === "line") {
      const line = chart.addSeries(LineSeries, {
        color: ACCENT,
        lineWidth: 2,
      });
      line.setData(filtered.map((d) => ({ time: d.date, value: d.close })));
      lineSeriesRef.current = line;
    } else {
      // area
      const area = chart.addSeries(LineSeries, {
        color: ACCENT,
        lineWidth: 2,
      });
      area.setData(filtered.map((d) => ({ time: d.date, value: d.close })));
      lineSeriesRef.current = area;
    }

    // Moving averages
    if (showMA) {
      const ma50Data = filtered.filter((d) => d.ma50 != null).map((d) => ({ time: d.date, value: d.ma50! }));
      if (ma50Data.length > 0) {
        const ma50 = chart.addSeries(LineSeries, {
          color: "#4A90E2",
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        ma50.setData(ma50Data);
        ma50Ref.current = ma50;
      }
      const ma200Data = filtered.filter((d) => d.ma200 != null).map((d) => ({ time: d.date, value: d.ma200! }));
      if (ma200Data.length > 0) {
        const ma200 = chart.addSeries(LineSeries, {
          color: "#9B59B6",
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        ma200.setData(ma200Data);
        ma200Ref.current = ma200;
      }
    }

    chart.timeScale().fitContent();
  }, [filtered, chartType, showMA, showVolume]);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-1 h-4 bg-accent rounded-full" />
          <span className="text-xs font-bold tracking-wider text-foreground">PRICE CHART</span>
          <span className="text-[10px] text-muted">{ticker}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {/* Chart type */}
          <div className="flex items-center bg-subtle rounded-lg p-0.5 gap-0.5">
            {(["candle", "line"] as ChartType[]).map((t) => (
              <button
                key={t}
                onClick={() => setChartType(t)}
                className={`text-[10px] px-2.5 py-1 rounded-md font-bold tracking-wider transition-colors ${
                  chartType === t ? "bg-card text-accent shadow-sm" : "text-muted hover:text-foreground"
                }`}
                title={t === "candle" ? "Candlesticks" : "Line"}
              >
                {t === "candle" ? "🕯" : "—"}
              </button>
            ))}
          </div>
          {/* Toggles */}
          <button
            onClick={() => setShowMA(!showMA)}
            className={`text-[10px] px-2 py-1 rounded-md font-medium transition-colors ${
              showMA ? "bg-accent/10 text-accent ring-1 ring-accent/20" : "bg-subtle text-muted hover:text-foreground"
            }`}
            title="Toggle moving averages"
          >
            MA
          </button>
          <button
            onClick={() => setShowVolume(!showVolume)}
            className={`text-[10px] px-2 py-1 rounded-md font-medium transition-colors ${
              showVolume ? "bg-accent/10 text-accent ring-1 ring-accent/20" : "bg-subtle text-muted hover:text-foreground"
            }`}
            title="Toggle volume"
          >
            VOL
          </button>
          {/* Range */}
          <div className="flex items-center bg-subtle rounded-lg p-0.5 gap-0.5">
            {(["1M", "3M", "6M", "YTD", "1Y", "All"] as Range[]).map((r) => (
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
      <div ref={containerRef} className="w-full h-[420px]" />
      {showMA && (
        <div className="px-4 py-2 border-t border-border flex items-center gap-4 text-[10px] text-muted">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-[#4A90E2]" />
            <span>MA 50</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-[#9B59B6]" />
            <span>MA 200</span>
          </div>
        </div>
      )}
    </div>
  );
}
