"use client";

import { useState, useEffect } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Coin {
  id: string;
  symbol: string;
  name: string;
  image: string;
  price: number | null;
  market_cap: number | null;
  market_cap_rank: number | null;
  volume_24h: number | null;
  change_1h: number | null;
  change_24h: number | null;
  change_7d: number | null;
  change_30d: number | null;
  ath: number | null;
  ath_change_pct: number | null;
  sparkline_7d: number[];
}

interface TrendingCoin {
  id: string;
  symbol: string;
  name: string;
  image: string;
  market_cap_rank: number | null;
  score: number | null;
}

interface GlobalStats {
  total_market_cap_usd: number | null;
  total_volume_24h_usd: number | null;
  btc_dominance: number | null;
  eth_dominance: number | null;
  market_cap_change_24h: number | null;
  active_coins: number | null;
}

function fmt(v: number | null | undefined): string {
  if (v == null) return "—";
  if (Math.abs(v) >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (Math.abs(v) >= 1) return `$${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  return `$${v.toFixed(6)}`;
}

function pctCell(v: number | null | undefined) {
  if (v == null) return <span className="text-muted/40">—</span>;
  const color = v > 0 ? "text-green" : v < 0 ? "text-red" : "text-muted";
  return <span className={`${color} tabular-nums`}>{v > 0 ? "+" : ""}{v.toFixed(1)}%</span>;
}

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length < 4) return null;
  // Sample down to ~30 points
  const step = Math.max(1, Math.floor(data.length / 30));
  const sampled = data.filter((_, i) => i % step === 0);
  const min = Math.min(...sampled);
  const max = Math.max(...sampled);
  const range = max - min || 1;
  const w = 80;
  const h = 24;
  const points = sampled
    .map((v, i) => `${(i / (sampled.length - 1)) * w},${h - ((v - min) / range) * h}`)
    .join(" ");
  return (
    <svg width={w} height={h} className="flex-shrink-0">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.2" />
    </svg>
  );
}

type SortKey = "rank" | "price" | "change_24h" | "change_7d" | "market_cap" | "volume_24h";

export default function CryptoMarkets() {
  const [coins, setCoins] = useState<Coin[]>([]);
  const [trending, setTrending] = useState<TrendingCoin[]>([]);
  const [global, setGlobal] = useState<GlobalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortAsc, setSortAsc] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/crypto/markets?limit=50`).then((r) => r.ok ? r.json() : null),
      fetch(`${API_BASE}/crypto/trending`).then((r) => r.ok ? r.json() : null),
      fetch(`${API_BASE}/crypto/global/stats`).then((r) => r.ok ? r.json() : null),
    ])
      .then(([marketsData, trendingData, globalData]) => {
        if (marketsData?.coins) setCoins(marketsData.coins);
        if (trendingData?.coins) setTrending(trendingData.coins);
        if (globalData) setGlobal(globalData);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(key === "rank"); }
  };

  const sorted = [...coins].sort((a, b) => {
    let av: number, bv: number;
    switch (sortKey) {
      case "rank": av = a.market_cap_rank ?? 999; bv = b.market_cap_rank ?? 999; break;
      case "price": av = a.price ?? 0; bv = b.price ?? 0; break;
      case "change_24h": av = a.change_24h ?? 0; bv = b.change_24h ?? 0; break;
      case "change_7d": av = a.change_7d ?? 0; bv = b.change_7d ?? 0; break;
      case "market_cap": av = a.market_cap ?? 0; bv = b.market_cap ?? 0; break;
      case "volume_24h": av = a.volume_24h ?? 0; bv = b.volume_24h ?? 0; break;
      default: av = 0; bv = 0;
    }
    return sortAsc ? av - bv : bv - av;
  });

  const arrow = (key: SortKey) => sortKey === key ? (sortAsc ? " ▲" : " ▼") : "";

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="bg-card border border-border rounded-xl p-8 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-2 border-accent/20 border-t-accent rounded-full animate-spin" />
            <span className="text-sm text-muted">Loading crypto markets...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Global stats bar */}
      {global && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: "Total Market Cap", value: global.total_market_cap_usd ? fmt(global.total_market_cap_usd) : "—" },
            { label: "24h Volume", value: global.total_volume_24h_usd ? fmt(global.total_volume_24h_usd) : "—" },
            { label: "BTC Dominance", value: global.btc_dominance ? `${global.btc_dominance.toFixed(1)}%` : "—" },
            { label: "ETH Dominance", value: global.eth_dominance ? `${global.eth_dominance.toFixed(1)}%` : "—" },
            { label: "24h Change", value: global.market_cap_change_24h != null ? `${global.market_cap_change_24h > 0 ? "+" : ""}${global.market_cap_change_24h.toFixed(2)}%` : "—", color: global.market_cap_change_24h != null ? (global.market_cap_change_24h > 0 ? "text-green" : "text-red") : "" },
            { label: "Active Coins", value: global.active_coins?.toLocaleString() ?? "—" },
          ].map((s) => (
            <div key={s.label} className="bg-card border border-border rounded-xl p-3">
              <div className="text-[10px] text-muted/50 tracking-wider">{s.label}</div>
              <div className={`text-sm font-bold mt-0.5 tabular-nums ${"color" in s && s.color ? s.color : "text-foreground"}`}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Trending coins */}
      {trending.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-4 bg-accent rounded-full" />
            <span className="text-xs font-bold tracking-wider text-foreground">TRENDING</span>
            <span className="text-[9px] bg-yellow/10 text-yellow px-2 py-0.5 rounded-md font-bold tracking-wider">24H</span>
          </div>
          <div className="flex items-center gap-3 overflow-x-auto pb-1">
            {trending.slice(0, 10).map((c) => (
              <div key={c.id} className="flex items-center gap-2 px-3 py-2 bg-subtle rounded-lg flex-shrink-0">
                {c.image && <img src={c.image} alt={c.symbol} className="w-5 h-5 rounded-full" />}
                <span className="text-xs font-bold text-foreground">{c.symbol}</span>
                <span className="text-[10px] text-muted">{c.name}</span>
                {c.market_cap_rank && <span className="text-[9px] text-muted/40">#{c.market_cap_rank}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-1 h-4 bg-accent rounded-full" />
            <span className="text-xs font-bold tracking-wider text-foreground">CRYPTO MARKETS</span>
            <span className="text-[9px] bg-accent/10 text-accent px-2 py-0.5 rounded-md font-bold tracking-wider">TOP {coins.length}</span>
          </div>
          <span className="text-[10px] text-muted/40">CoinGecko</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-subtle/50">
                <th className="text-left px-4 py-2 text-muted/50 font-medium cursor-pointer hover:text-foreground" onClick={() => handleSort("rank")}>#{arrow("rank")}</th>
                <th className="text-left px-3 py-2 text-muted/50 font-medium">Coin</th>
                <th className="text-right px-3 py-2 text-muted/50 font-medium cursor-pointer hover:text-foreground" onClick={() => handleSort("price")}>Price{arrow("price")}</th>
                <th className="text-right px-3 py-2 text-muted/50 font-medium cursor-pointer hover:text-foreground" onClick={() => handleSort("change_24h")}>24h{arrow("change_24h")}</th>
                <th className="text-right px-3 py-2 text-muted/50 font-medium cursor-pointer hover:text-foreground hidden sm:table-cell" onClick={() => handleSort("change_7d")}>7d{arrow("change_7d")}</th>
                <th className="text-right px-3 py-2 text-muted/50 font-medium cursor-pointer hover:text-foreground hidden md:table-cell" onClick={() => handleSort("market_cap")}>Market Cap{arrow("market_cap")}</th>
                <th className="text-right px-3 py-2 text-muted/50 font-medium cursor-pointer hover:text-foreground hidden lg:table-cell" onClick={() => handleSort("volume_24h")}>Volume 24h{arrow("volume_24h")}</th>
                <th className="text-right px-3 py-2 text-muted/50 font-medium hidden lg:table-cell">7d Chart</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((c) => (
                <tr key={c.id} className="border-b border-border/40 hover:bg-subtle/30 transition-colors">
                  <td className="px-4 py-2.5 text-muted/50 tabular-nums">{c.market_cap_rank ?? "—"}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      {c.image && <img src={c.image} alt={c.symbol} className="w-5 h-5 rounded-full flex-shrink-0" />}
                      <div>
                        <span className="font-bold text-foreground">{c.symbol}</span>
                        <span className="text-muted/50 ml-1.5 hidden sm:inline">{c.name}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold text-foreground tabular-nums">{c.price != null ? fmt(c.price) : "—"}</td>
                  <td className="px-3 py-2.5 text-right text-[11px]">{pctCell(c.change_24h)}</td>
                  <td className="px-3 py-2.5 text-right text-[11px] hidden sm:table-cell">{pctCell(c.change_7d)}</td>
                  <td className="px-3 py-2.5 text-right text-muted tabular-nums hidden md:table-cell">{c.market_cap != null ? fmt(c.market_cap) : "—"}</td>
                  <td className="px-3 py-2.5 text-right text-muted tabular-nums hidden lg:table-cell">{c.volume_24h != null ? fmt(c.volume_24h) : "—"}</td>
                  <td className="px-3 py-2.5 text-right hidden lg:table-cell">
                    <MiniSparkline
                      data={c.sparkline_7d}
                      color={(c.change_7d ?? 0) >= 0 ? "#2D8B4E" : "#C0392B"}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
