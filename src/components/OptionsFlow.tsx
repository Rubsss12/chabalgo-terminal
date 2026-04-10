"use client";

import { useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Contract {
  ticker?: string;
  strike: number;
  expiry: string;
  type: string;
  volume: number;
  open_interest: number;
  vol_oi_ratio: number;
  last_price: number;
  bid?: number;
  ask?: number;
  implied_volatility: number;
  in_the_money: boolean;
  premium: number;
}

interface OptionsData {
  ticker: string;
  expiries_analyzed: string[];
  unusual_calls: Contract[];
  unusual_puts: Contract[];
  put_call_ratio: number;
  total_call_volume: number;
  total_put_volume: number;
  total_call_oi: number;
  total_put_oi: number;
  top_contracts: Contract[];
  ai_summary: string;
}

interface ScreenerData {
  results: Contract[];
  scan_time: number;
  tickers_scanned: number;
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

// ====== TICKER MODE ======
function TickerOptionsFlow({ ticker }: { ticker: string }) {
  const [data, setData] = useState<OptionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    fetch(`${API_BASE}/options-flow/${ticker}`)
      .then((r) => {
        if (!r.ok) throw new Error("Options data unavailable");
        return r.json();
      })
      .then((d) => setData(d))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [ticker]);

  if (loading) {
    return (
      <div className="bg-card border border-border p-5">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-accent/20 border-t-accent rounded-full animate-spin" />
          <span className="text-accent text-xs tracking-widest animate-pulse">
            SCANNING OPTIONS CHAIN...
          </span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-card border border-border p-5">
        <div className="text-muted text-xs">Options flow unavailable for {ticker}</div>
      </div>
    );
  }

  const totalVol = data.total_call_volume + data.total_put_volume;
  const callPct = totalVol > 0 ? (data.total_call_volume / totalVol) * 100 : 50;
  const allUnusual = [
    ...data.unusual_calls,
    ...data.unusual_puts,
  ].sort((a, b) => b.vol_oi_ratio - a.vol_oi_ratio);

  const pcrColor =
    data.put_call_ratio > 1.2
      ? "text-red"
      : data.put_call_ratio < 0.7
      ? "text-green"
      : "text-yellow";

  return (
    <div className="bg-card border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-accent text-xs font-semibold tracking-wider">
              OPTIONS FLOW
            </h3>
            <span className="text-[9px] px-1.5 py-0.5 bg-accent/10 text-accent border border-accent/20">
              UNUSUAL ACTIVITY
            </span>
          </div>
          <div className="text-muted text-[10px] mt-0.5">
            {data.expiries_analyzed.length} expiries analyzed &middot;{" "}
            {formatNum(totalVol)} contracts traded
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-muted/50 tracking-wider">PUT/CALL</div>
          <div className={`text-lg font-bold ${pcrColor}`}>
            {data.put_call_ratio}
          </div>
        </div>
      </div>

      {/* Put/Call bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-[10px] mb-1">
          <span className="text-green">CALLS {formatNum(data.total_call_volume)}</span>
          <span className="text-red">PUTS {formatNum(data.total_put_volume)}</span>
        </div>
        <div className="h-3 bg-subtle rounded-full overflow-hidden flex">
          <div className="h-full bg-green/60 transition-all" style={{ width: `${callPct}%` }} />
          <div className="h-full bg-red/60 transition-all" style={{ width: `${100 - callPct}%` }} />
        </div>
        <div className="flex items-center justify-between text-[9px] text-muted/50 mt-0.5">
          <span>OI: {formatNum(data.total_call_oi)}</span>
          <span>OI: {formatNum(data.total_put_oi)}</span>
        </div>
      </div>

      {/* Unusual Activity table */}
      {allUnusual.length > 0 && (
        <div className="mb-4">
          <div className="text-[10px] text-muted tracking-wider mb-2">
            ACTIVIT&Eacute; INHABITUELLE ({allUnusual.length} contrats)
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="text-muted/50 border-b border-border/50">
                  <th className="text-left py-1 pr-2">TYPE</th>
                  <th className="text-right py-1 px-2">STRIKE</th>
                  <th className="text-right py-1 px-2">EXPIRY</th>
                  <th className="text-right py-1 px-2">VOL</th>
                  <th className="text-right py-1 px-2">OI</th>
                  <th className="text-right py-1 px-2">VOL/OI</th>
                  <th className="text-right py-1 px-2">PRIX</th>
                  <th className="text-right py-1 px-2">IV</th>
                  <th className="text-right py-1 pl-2">PRIME</th>
                </tr>
              </thead>
              <tbody>
                {allUnusual.slice(0, 15).map((c, i) => (
                  <tr key={`${c.type}-${c.strike}-${c.expiry}-${i}`} className="border-b border-border/20 hover:bg-subtle/30">
                    <td className="py-1.5 pr-2">
                      <span className={`px-1.5 py-0.5 text-[9px] font-semibold ${c.type === "CALL" ? "bg-green/10 text-green" : "bg-red/10 text-red"}`}>
                        {c.type}
                      </span>
                    </td>
                    <td className="text-right py-1.5 px-2 text-foreground font-medium">${c.strike}</td>
                    <td className="text-right py-1.5 px-2 text-muted">{c.expiry}</td>
                    <td className="text-right py-1.5 px-2 text-foreground">{formatNum(c.volume)}</td>
                    <td className="text-right py-1.5 px-2 text-muted">{formatNum(c.open_interest)}</td>
                    <td className="text-right py-1.5 px-2">
                      <span className={`font-semibold ${c.vol_oi_ratio >= 5 ? "text-accent" : c.vol_oi_ratio >= 3 ? "text-yellow" : "text-foreground"}`}>
                        {c.vol_oi_ratio}x
                      </span>
                    </td>
                    <td className="text-right py-1.5 px-2 text-foreground">${c.last_price}</td>
                    <td className="text-right py-1.5 px-2 text-muted">{c.implied_volatility}%</td>
                    <td className="text-right py-1.5 pl-2 text-foreground">${formatNum(c.premium)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Top contracts if no unusual */}
      {data.top_contracts.length > 0 && allUnusual.length === 0 && (
        <div className="mb-4">
          <div className="text-[10px] text-muted tracking-wider mb-2">CONTRATS LES PLUS ACTIFS</div>
          <div className="overflow-x-auto">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="text-muted/50 border-b border-border/50">
                  <th className="text-left py-1 pr-2">TYPE</th>
                  <th className="text-right py-1 px-2">STRIKE</th>
                  <th className="text-right py-1 px-2">EXPIRY</th>
                  <th className="text-right py-1 px-2">VOL</th>
                  <th className="text-right py-1 px-2">OI</th>
                  <th className="text-right py-1 pl-2">PRIME</th>
                </tr>
              </thead>
              <tbody>
                {data.top_contracts.slice(0, 10).map((c, i) => (
                  <tr key={`top-${c.strike}-${c.expiry}-${i}`} className="border-b border-border/20 hover:bg-subtle/30">
                    <td className="py-1.5 pr-2">
                      <span className={`px-1.5 py-0.5 text-[9px] font-semibold ${c.type === "CALL" ? "bg-green/10 text-green" : "bg-red/10 text-red"}`}>
                        {c.type}
                      </span>
                    </td>
                    <td className="text-right py-1.5 px-2 text-foreground font-medium">${c.strike}</td>
                    <td className="text-right py-1.5 px-2 text-muted">{c.expiry}</td>
                    <td className="text-right py-1.5 px-2 text-foreground">{formatNum(c.volume)}</td>
                    <td className="text-right py-1.5 px-2 text-muted">{formatNum(c.open_interest)}</td>
                    <td className="text-right py-1.5 pl-2 text-foreground">${formatNum(c.premium)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* AI Summary */}
      {data.ai_summary && (
        <div className="bg-subtle/50 border-l-2 border-accent/30 pl-3 pr-3 py-2.5">
          <div className="text-accent/60 text-[9px] font-semibold tracking-[0.15em] mb-1.5">
            AI ANALYSIS — OPTIONS FLOW
          </div>
          <p className="text-[11px] text-muted leading-[1.7]">{data.ai_summary}</p>
        </div>
      )}
    </div>
  );
}

// ====== SCREENER MODE ======
function OptionsScreener({ onSearch }: { onSearch?: (ticker: string) => void }) {
  const [data, setData] = useState<ScreenerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    fetch(`${API_BASE}/options-flow/screener/unusual`)
      .then((r) => {
        if (!r.ok) throw new Error("Screener unavailable");
        return r.json();
      })
      .then((d) => setData(d))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="bg-card border border-border p-5">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-accent/20 border-t-accent rounded-full animate-spin" />
          <span className="text-accent text-xs tracking-widest animate-pulse">
            SCANNING 100+ TICKERS FOR UNUSUAL OPTIONS...
          </span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-card border border-border p-5">
        <div className="text-muted text-xs">Options screener unavailable</div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-accent text-xs font-semibold tracking-wider">OPTIONS FLOW SCREENER</h3>
            <span className="text-[9px] px-1.5 py-0.5 bg-red/10 text-red border border-red/20">UNUSUAL ACTIVITY</span>
          </div>
          <div className="text-muted text-[10px] mt-0.5">
            {data.tickers_scanned} tickers scanned in {data.scan_time}s &middot; {data.results.length} unusual contracts found
          </div>
        </div>
      </div>

      {data.results.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-[10px]">
            <thead>
              <tr className="text-muted/50 border-b border-border/50">
                <th className="text-left py-1 pr-2">TICKER</th>
                <th className="text-left py-1 px-2">TYPE</th>
                <th className="text-right py-1 px-2">STRIKE</th>
                <th className="text-right py-1 px-2">EXPIRY</th>
                <th className="text-right py-1 px-2">VOL</th>
                <th className="text-right py-1 px-2">OI</th>
                <th className="text-right py-1 px-2">VOL/OI</th>
                <th className="text-right py-1 px-2">IV</th>
                <th className="text-right py-1 pl-2">PRIME</th>
              </tr>
            </thead>
            <tbody>
              {data.results.map((c, i) => (
                <tr
                  key={`${c.ticker}-${c.strike}-${c.expiry}-${i}`}
                  className="border-b border-border/20 hover:bg-subtle/30 cursor-pointer"
                  onClick={() => c.ticker && onSearch?.(c.ticker)}
                >
                  <td className="py-1.5 pr-2 text-accent font-semibold">{c.ticker}</td>
                  <td className="py-1.5 px-2">
                    <span className={`px-1.5 py-0.5 text-[9px] font-semibold ${c.type === "CALL" ? "bg-green/10 text-green" : "bg-red/10 text-red"}`}>
                      {c.type}
                    </span>
                  </td>
                  <td className="text-right py-1.5 px-2 text-foreground">${c.strike}</td>
                  <td className="text-right py-1.5 px-2 text-muted">{c.expiry}</td>
                  <td className="text-right py-1.5 px-2 text-foreground">{formatNum(c.volume)}</td>
                  <td className="text-right py-1.5 px-2 text-muted">{formatNum(c.open_interest)}</td>
                  <td className="text-right py-1.5 px-2">
                    <span className="flex items-center justify-end gap-1">
                      {c.vol_oi_ratio >= 3 && (
                        <span className="text-[8px] px-1 py-0 bg-accent/10 text-accent border border-accent/20">UNUSUAL</span>
                      )}
                      <span className={`font-semibold ${c.vol_oi_ratio >= 5 ? "text-accent" : c.vol_oi_ratio >= 3 ? "text-yellow" : "text-foreground"}`}>
                        {c.vol_oi_ratio}x
                      </span>
                    </span>
                  </td>
                  <td className="text-right py-1.5 px-2 text-muted">{c.implied_volatility}%</td>
                  <td className="text-right py-1.5 pl-2 text-foreground">${formatNum(c.premium)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center text-muted text-xs py-8">
          No unusual options activity detected across scanned tickers.
        </div>
      )}
    </div>
  );
}

// ====== MAIN EXPORT ======
export default function OptionsFlow({
  ticker,
  onSearch,
}: {
  ticker?: string;
  onSearch?: (ticker: string) => void;
}) {
  if (ticker) return <TickerOptionsFlow ticker={ticker} />;
  return <OptionsScreener onSearch={onSearch} />;
}
