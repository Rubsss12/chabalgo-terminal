"use client";

import { useState, useEffect } from "react";

import { API_BASE } from "../lib/apiBase";

interface Exchange {
  key: string;
  name: string;
  flag: string;
  currency: string;
  index: string;
  ticker_count: number;
}

interface Stock {
  ticker: string;
  name: string;
  price: number;
  change_pct: number;
  market_cap: number | null;
  volume: number | null;
  currency: string | null;
}

interface MarketData {
  exchange: string;
  name: string;
  flag: string;
  currency: string;
  index: { symbol: string; price: number; change_pct: number } | null;
  stocks: Stock[];
  updated: string;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$", EUR: "€", GBP: "£", JPY: "¥", CNY: "¥", KRW: "₩",
  HKD: "HK$", INR: "₹", AUD: "A$", CAD: "C$", BRL: "R$", TWD: "NT$",
};

function fmtPrice(v: number, cur: string | null): string {
  const sym = CURRENCY_SYMBOLS[cur || ""] || "";
  if (v >= 1000) return `${sym}${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (v >= 1) return `${sym}${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  return `${sym}${v.toFixed(4)}`;
}

function fmtCap(v: number | null, cur: string | null): string {
  if (!v) return "—";
  const sym = CURRENCY_SYMBOLS[cur || ""] || "";
  if (v >= 1e12) return `${sym}${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `${sym}${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${sym}${(v / 1e6).toFixed(1)}M`;
  return `${sym}${v.toLocaleString()}`;
}

interface GlobalMarketsProps {
  onSearch?: (ticker: string) => void;
}

export default function GlobalMarkets({ onSearch }: GlobalMarketsProps) {
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [activeExchange, setActiveExchange] = useState<string>("korea");
  const [data, setData] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/global/exchanges`)
      .then((r) => r.json())
      .then((d) => setExchanges(d.exchanges || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE}/global/markets/${activeExchange}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [activeExchange]);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-1 h-4 bg-accent rounded-full" />
          <span className="text-xs font-bold tracking-wider text-foreground">GLOBAL MARKETS</span>
          <span className="text-[9px] bg-accent/10 text-accent px-2 py-0.5 rounded-md font-bold tracking-wider">{exchanges.length} EXCHANGES</span>
        </div>
        {data?.index && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted/50">{data.index.symbol}</span>
            <span className="font-bold tabular-nums">{data.index.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            <span className={`tabular-nums font-bold ${data.index.change_pct >= 0 ? "text-green" : "text-red"}`}>
              {data.index.change_pct >= 0 ? "+" : ""}{data.index.change_pct.toFixed(2)}%
            </span>
          </div>
        )}
      </div>

      {/* Country tabs */}
      <div className="flex items-center gap-1 px-2 py-2 border-b border-border bg-subtle/30 overflow-x-auto">
        {exchanges.map((ex) => (
          <button
            key={ex.key}
            onClick={() => setActiveExchange(ex.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
              activeExchange === ex.key
                ? "bg-accent/10 text-accent ring-1 ring-accent/20"
                : "text-muted hover:text-foreground hover:bg-card"
            }`}
          >
            <span className="text-base leading-none">{ex.flag}</span>
            <span>{ex.name.split(" (")[0]}</span>
          </button>
        ))}
      </div>

      {/* Stocks table */}
      {loading ? (
        <div className="p-12 flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-accent/20 border-t-accent rounded-full animate-spin" />
          <span className="text-xs text-muted">Loading {data?.name || activeExchange}...</span>
        </div>
      ) : !data || data.stocks.length === 0 ? (
        <div className="p-12 text-center">
          <span className="text-sm text-muted">No data available for this market.</span>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-subtle/50">
                <th className="text-left px-4 py-2 text-muted/50 font-medium w-10">#</th>
                <th className="text-left px-3 py-2 text-muted/50 font-medium">Stock</th>
                <th className="text-right px-3 py-2 text-muted/50 font-medium">Price</th>
                <th className="text-right px-3 py-2 text-muted/50 font-medium">Change</th>
                <th className="text-right px-3 py-2 text-muted/50 font-medium hidden md:table-cell">Market Cap</th>
                <th className="text-right px-3 py-2 text-muted/50 font-medium hidden lg:table-cell">Volume</th>
                <th className="text-right px-3 py-2 text-muted/50 font-medium hidden sm:table-cell">Ticker</th>
              </tr>
            </thead>
            <tbody>
              {data.stocks.map((s, i) => (
                <tr
                  key={s.ticker}
                  onClick={() => onSearch?.(s.ticker)}
                  className="border-b border-border/40 hover:bg-subtle/30 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-2.5 text-muted/50 tabular-nums">{i + 1}</td>
                  <td className="px-3 py-2.5">
                    <div className="font-bold text-foreground truncate max-w-[300px]">{s.name}</div>
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold text-foreground tabular-nums">
                    {fmtPrice(s.price, s.currency)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-[11px]">
                    <span className={`tabular-nums font-bold ${s.change_pct > 0 ? "text-green" : s.change_pct < 0 ? "text-red" : "text-muted"}`}>
                      {s.change_pct > 0 ? "+" : ""}{s.change_pct.toFixed(2)}%
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right text-muted tabular-nums hidden md:table-cell">{fmtCap(s.market_cap, s.currency)}</td>
                  <td className="px-3 py-2.5 text-right text-muted tabular-nums hidden lg:table-cell">
                    {s.volume ? s.volume.toLocaleString(undefined, { notation: "compact" }) : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right hidden sm:table-cell">
                    <span className="text-[10px] font-mono text-muted/40">{s.ticker}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
