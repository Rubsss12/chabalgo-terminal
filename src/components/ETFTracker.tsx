"use client";

import { useEffect, useState, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { formatLargeNumber } from "@/lib/format";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface ETFData {
  ticker: string;
  name: string;
  index: string;
  ter: number;
  price: number;
  currency: string;
  inception_date: string;
  total_years: number;
  annualized_return: number | null;
  return_1y: number | null;
  return_3y: number | null;
  return_5y: number | null;
  return_10y: number | null;
  return_since_inception: number | null;
  chart: { date: string; value: number; indexed: number }[];
  market_cap: number;
}

const CHART_COLORS = [
  "#F37021", "#2D8B4E", "#C0392B", "#3498DB", "#8E44AD", "#C89B3C",
  "#1ABC9C", "#E74C3C",
];

export default function ETFTracker() {
  const [data, setData] = useState<{ CTO: ETFData[]; PEA: ETFData[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"CTO" | "PEA">("CTO");
  const [selectedETFs, setSelectedETFs] = useState<Set<string>>(new Set());
  const [showChart, setShowChart] = useState(true);

  const fetchData = () => {
    setLoading(true);
    fetch(`${API_BASE}/etf`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        // Auto-select top 3 for each category
        const ctoTop = (d.CTO || []).slice(0, 3).map((e: ETFData) => e.ticker);
        const peaTop = (d.PEA || []).slice(0, 3).map((e: ETFData) => e.ticker);
        setSelectedETFs(new Set([...ctoTop, ...peaTop]));
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const toggleETF = (ticker: string) => {
    setSelectedETFs((prev) => {
      const next = new Set(prev);
      if (next.has(ticker)) next.delete(ticker);
      else next.add(ticker);
      return next;
    });
  };

  const currentETFs = data ? data[tab] || [] : [];

  // Build comparison chart data
  const chartData = useMemo(() => {
    const selected = currentETFs.filter((e) => selectedETFs.has(e.ticker));
    if (selected.length === 0) return [];

    // Find common dates
    const dateMap: Record<string, Record<string, number>> = {};
    selected.forEach((etf) => {
      etf.chart.forEach((point) => {
        if (!dateMap[point.date]) dateMap[point.date] = {};
        dateMap[point.date][etf.ticker] = point.indexed;
      });
    });

    return Object.entries(dateMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, values]) => ({ date, ...values }));
  }, [currentETFs, selectedETFs]);

  const pctColor = (v: number | null) => {
    if (v == null) return "text-muted/40";
    return v >= 0 ? "text-green" : "text-red";
  };

  const pctVal = (v: number | null) => {
    if (v == null) return "--";
    return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
  };

  return (
    <div className="bg-card border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-accent text-xs font-semibold tracking-wider">TOP INDEX ETFs</h3>
          <p className="text-muted text-[10px] mt-0.5">Classement par rendement annualisé moyen depuis création</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowChart(!showChart)}
            className={`text-[10px] px-2.5 py-1 border transition-colors ${
              showChart ? "border-accent text-accent bg-accent/5" : "border-border text-muted"
            }`}
          >
            {showChart ? "MASQUER GRAPHIQUE" : "AFFICHER GRAPHIQUE"}
          </button>
          <button
            onClick={fetchData}
            disabled={loading}
            className="text-[10px] px-2.5 py-1 border border-accent text-accent hover:bg-accent/5 transition-colors disabled:opacity-40"
          >
            {loading ? "CHARGEMENT..." : "ACTUALISER"}
          </button>
        </div>
      </div>

      {/* CTO / PEA Tabs */}
      <div className="flex gap-0 border border-border mb-4 w-fit">
        <button
          onClick={() => setTab("CTO")}
          className={`px-4 py-2 text-xs font-medium transition-colors ${
            tab === "CTO" ? "bg-accent text-white" : "text-muted hover:text-foreground"
          }`}
        >
          CTO
          <span className="text-[9px] ml-1 opacity-60">Compte-Titres</span>
        </button>
        <button
          onClick={() => setTab("PEA")}
          className={`px-4 py-2 text-xs font-medium border-l border-border transition-colors ${
            tab === "PEA" ? "bg-accent text-white" : "text-muted hover:text-foreground"
          }`}
        >
          PEA
          <span className="text-[9px] ml-1 opacity-60">Plan Épargne Actions</span>
        </button>
      </div>

      {loading && !data ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-accent/20 border-t-accent rounded-full animate-spin" />
          <span className="text-accent text-xs ml-3 animate-pulse">Chargement des ETFs...</span>
        </div>
      ) : currentETFs.length === 0 ? (
        <div className="text-muted text-sm py-8 text-center">Aucun ETF disponible</div>
      ) : (
        <>
          {/* Comparison chart */}
          {showChart && chartData.length > 0 && (
            <div className="mb-4 p-3 bg-subtle/30 border border-border/50">
              <div className="text-[10px] text-muted tracking-wider mb-2">
                PERFORMANCE COMPARÉE (Base 100)
              </div>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                    <CartesianGrid stroke="#E5E0DA" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: "#8B8680", fontSize: 9 }}
                      tickFormatter={(v) => v.slice(0, 4)}
                      interval={Math.floor(chartData.length / 8)}
                    />
                    <YAxis
                      tick={{ fill: "#8B8680", fontSize: 9 }}
                      width={45}
                      tickFormatter={(v) => `${v}`}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#FFFFFF",
                        border: "1px solid #E5E0DA",
                        fontSize: 11,
                        borderRadius: 2,
                      }}
                      labelStyle={{ color: "#8B8680" }}
                      formatter={(value: unknown, name: unknown) => [`${Number(value ?? 0).toFixed(1)}`, String(name)]}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: 10 }}
                    />
                    {currentETFs
                      .filter((e) => selectedETFs.has(e.ticker))
                      .map((etf, i) => (
                        <Line
                          key={etf.ticker}
                          type="monotone"
                          dataKey={etf.ticker}
                          stroke={CHART_COLORS[i % CHART_COLORS.length]}
                          strokeWidth={1.5}
                          dot={false}
                          name={etf.ticker}
                          connectNulls
                        />
                      ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ETF Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted border-b border-border text-right">
                  <th className="pb-2 text-left font-normal w-6"></th>
                  <th className="pb-2 text-left font-normal pr-2">#</th>
                  <th className="pb-2 text-left font-normal pr-2">ETF</th>
                  <th className="pb-2 font-normal pr-2">INDICE</th>
                  <th className="pb-2 font-normal pr-2">PRIX</th>
                  <th className="pb-2 font-normal pr-2">TER</th>
                  <th className="pb-2 font-normal pr-2">1 AN</th>
                  <th className="pb-2 font-normal pr-2">3 ANS</th>
                  <th className="pb-2 font-normal pr-2">5 ANS</th>
                  <th className="pb-2 font-normal pr-2">10 ANS</th>
                  <th className="pb-2 font-normal pr-2">ANNUALISÉ</th>
                  <th className="pb-2 font-normal">DEPUIS CRÉATION</th>
                </tr>
              </thead>
              <tbody>
                {currentETFs.map((etf, i) => (
                  <tr
                    key={etf.ticker}
                    className={`border-b border-border/50 text-right transition-colors cursor-pointer ${
                      selectedETFs.has(etf.ticker) ? "bg-accent/5" : "hover:bg-subtle"
                    }`}
                    onClick={() => toggleETF(etf.ticker)}
                  >
                    <td className="py-2 text-center">
                      <div
                        className={`w-3 h-3 border rounded-xl flex items-center justify-center ${
                          selectedETFs.has(etf.ticker)
                            ? "border-accent bg-accent"
                            : "border-border"
                        }`}
                      >
                        {selectedETFs.has(etf.ticker) && (
                          <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </div>
                    </td>
                    <td className="py-2 text-left pr-2 text-muted">{i + 1}</td>
                    <td className="py-2 text-left pr-2">
                      <div>
                        <span className="text-accent font-semibold">{etf.ticker.replace(".PA", "")}</span>
                        <div className="text-[10px] text-muted truncate max-w-[180px]">{etf.name}</div>
                      </div>
                    </td>
                    <td className="py-2 pr-2 text-muted text-[10px]">{etf.index}</td>
                    <td className="py-2 pr-2 text-foreground">
                      {etf.currency === "EUR" ? "€" : "$"}{etf.price.toFixed(2)}
                    </td>
                    <td className="py-2 pr-2 text-muted">{etf.ter}%</td>
                    <td className={`py-2 pr-2 ${pctColor(etf.return_1y)}`}>{pctVal(etf.return_1y)}</td>
                    <td className={`py-2 pr-2 ${pctColor(etf.return_3y)}`}>{pctVal(etf.return_3y)}</td>
                    <td className={`py-2 pr-2 ${pctColor(etf.return_5y)}`}>{pctVal(etf.return_5y)}</td>
                    <td className={`py-2 pr-2 ${pctColor(etf.return_10y)}`}>{pctVal(etf.return_10y)}</td>
                    <td className="py-2 pr-2">
                      {etf.annualized_return != null ? (
                        <span className={`font-semibold ${pctColor(etf.annualized_return)}`}>
                          {pctVal(etf.annualized_return)}/an
                        </span>
                      ) : "--"}
                    </td>
                    <td className={`py-2 font-medium ${pctColor(etf.return_since_inception)}`}>
                      {pctVal(etf.return_since_inception)}
                      <div className="text-[9px] text-muted font-normal">
                        ({etf.total_years}ans)
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 text-[10px] text-muted/60">
            Cliquez sur un ETF pour l&apos;ajouter/retirer du graphique comparatif. TER = Total Expense Ratio (frais annuels).
          </div>
        </>
      )}
    </div>
  );
}
