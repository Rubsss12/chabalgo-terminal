"use client";

import { useEffect, useState } from "react";
import { formatLargeNumber } from "@/lib/format";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface PeerData {
  ticker: string;
  name: string;
  price: number | null;
  change_pct: number | null;
  market_cap: number | null;
  pe_ratio: number | null;
  forward_pe: number | null;
  revenue_growth: number | null;
  gross_margin: number | null;
  operating_margin: number | null;
  rsi: number | null;
  is_target: boolean;
}

function buildPeerSummary(peers: PeerData[], ticker: string): string {
  if (peers.length < 2) return "";
  const target = peers.find(p => p.is_target);
  const others = peers.filter(p => !p.is_target);
  if (!target) return "";

  const parts: string[] = [];
  const peOthers = others.filter(p => p.pe_ratio != null);

  // Valuation comparison
  if (target.pe_ratio != null && peOthers.length > 0) {
    const avgPe = peOthers.reduce((s, p) => s + (p.pe_ratio || 0), 0) / peOthers.length;
    const premiumPct = ((target.pe_ratio - avgPe) / avgPe * 100);

    if (target.pe_ratio > avgPe * 1.3) {
      parts.push(`${ticker} trades at a significant premium to its peer group: ${target.pe_ratio.toFixed(1)}x earnings versus the peer average of ${avgPe.toFixed(1)}x — a ${premiumPct.toFixed(0)}% premium. This suggests the market believes ${ticker} has a competitive advantage (superior growth, stronger margins, or better execution) that justifies paying more per dollar of earnings. However, premium-valued stocks are also more vulnerable to disappointment — any stumble in execution could trigger a sharp de-rating toward the peer average.`);
    } else if (target.pe_ratio > avgPe * 1.1) {
      parts.push(`${ticker}'s valuation of ${target.pe_ratio.toFixed(1)}x PE sits modestly above the peer group average of ${avgPe.toFixed(1)}x. The slight premium suggests the market views ${ticker} as a higher-quality name in its peer group, but the gap is narrow enough that it could close quickly with a strong quarter from a competitor or a miss from ${ticker}.`);
    } else if (target.pe_ratio < avgPe * 0.7) {
      const discountPct = Math.abs(premiumPct);
      parts.push(`${ticker} trades at a notable discount to peers: ${target.pe_ratio.toFixed(1)}x earnings versus the peer average of ${avgPe.toFixed(1)}x — a ${discountPct.toFixed(0)}% discount. This could represent a genuine value opportunity if the business fundamentals are comparable to peers, or it could reflect the market pricing in specific risks (slowing growth, competitive threats, management concerns) that justify the lower multiple. The key is whether the discount is temporary or structural.`);
    } else if (target.pe_ratio < avgPe * 0.9) {
      parts.push(`${ticker}'s ${target.pe_ratio.toFixed(1)}x PE is slightly below the peer average of ${avgPe.toFixed(1)}x. A modest discount could indicate the market sees slightly less growth potential, or it could be a minor inefficiency — this is close enough to fair value relative to peers that the gap may not be meaningful.`);
    } else {
      parts.push(`${ticker}'s valuation of ${target.pe_ratio.toFixed(1)}x PE is closely aligned with the peer group average of ${avgPe.toFixed(1)}x, suggesting the market views it as fairly valued within its competitive set. At this level, relative performance will be driven by execution — whoever delivers the best earnings surprises will see the most multiple expansion.`);
    }
  }

  // Growth comparison
  if (target.revenue_growth != null) {
    const growthPeers = others.filter(p => p.revenue_growth != null);
    if (growthPeers.length > 0) {
      const avgGrowth = growthPeers.reduce((s, p) => s + (p.revenue_growth || 0), 0) / growthPeers.length;
      const sorted = [...peers].filter(p => p.revenue_growth != null).sort((a, b) => (b.revenue_growth || 0) - (a.revenue_growth || 0));
      const rank = sorted.findIndex(p => p.ticker === ticker) + 1;
      const fastest = sorted[0];

      if (fastest && fastest.ticker === ticker) {
        parts.push(`${ticker} leads the entire peer group in revenue growth at ${target.revenue_growth.toFixed(1)}%, outpacing the peer average of ${avgGrowth.toFixed(1)}%. Being the fastest grower in a competitive group is a powerful position — it typically leads to market share gains and justifies premium valuations. Investors should monitor whether this growth is sustainable or driven by one-time factors.`);
      } else if (target.revenue_growth > avgGrowth) {
        parts.push(`Revenue growth of ${target.revenue_growth.toFixed(1)}% ranks #${rank} among ${sorted.length} peers and exceeds the group average of ${avgGrowth.toFixed(1)}%. ${fastest ? `The growth leader is ${fastest.ticker} at ${fastest.revenue_growth?.toFixed(1)}%.` : ""} ${ticker}'s above-average growth while not leading the pack suggests solid execution with room to accelerate if market conditions improve.`);
      } else {
        parts.push(`${ticker}'s revenue growth of ${target.revenue_growth.toFixed(1)}% trails the peer average of ${avgGrowth.toFixed(1)}%, ranking #${rank} out of ${sorted.length} peers. Underperforming peers on growth is a concern because it suggests the company may be losing competitive positioning or market share. ${fastest ? `The group leader, ${fastest.ticker}, is growing at ${fastest.revenue_growth?.toFixed(1)}%, highlighting the gap.` : ""}`);
      }
    }
  }

  // Margin comparison
  if (target.operating_margin != null) {
    const marginPeers = others.filter(p => p.operating_margin != null);
    if (marginPeers.length > 0) {
      const avgMargin = marginPeers.reduce((s, p) => s + (p.operating_margin || 0), 0) / marginPeers.length;
      const sortedMargin = [...peers].filter(p => p.operating_margin != null).sort((a, b) => (b.operating_margin || 0) - (a.operating_margin || 0));
      const marginRank = sortedMargin.findIndex(p => p.ticker === ticker) + 1;

      if (marginRank === 1) {
        parts.push(`${ticker} boasts the highest operating margin in the peer group at ${target.operating_margin.toFixed(1)}% versus the average of ${avgMargin.toFixed(1)}%. This margin leadership typically indicates a structural competitive advantage — whether from scale economics, proprietary technology, network effects, or pricing power. Companies with best-in-class margins tend to be more resilient during economic downturns and generate superior free cash flow.`);
      } else if (target.operating_margin > avgMargin) {
        parts.push(`Operating margin of ${target.operating_margin.toFixed(1)}% is above the peer average of ${avgMargin.toFixed(1)}%, ranking #${marginRank} in the group. Above-average profitability suggests the company has some degree of competitive differentiation or operational efficiency that peers have not matched.`);
      } else if (target.operating_margin < avgMargin * 0.5 && avgMargin > 0) {
        parts.push(`Operating margin of ${target.operating_margin.toFixed(1)}% significantly lags the peer average of ${avgMargin.toFixed(1)}%. This margin gap could indicate the company is investing heavily for future growth (sacrificing near-term profitability), or it could reflect a weaker competitive position that makes it harder to charge premium prices or control costs.`);
      }
    }
  }

  // RSI / momentum comparison
  if (target.rsi != null) {
    const rsiPeers = others.filter(p => p.rsi != null);
    if (rsiPeers.length > 0) {
      const highRsiPeers = rsiPeers.filter(p => (p.rsi || 0) > 65);
      const lowRsiPeers = rsiPeers.filter(p => (p.rsi || 0) < 35);
      if (target.rsi > 65 && highRsiPeers.length >= 2) {
        parts.push(`Both ${ticker} and several peers show overbought RSI readings, suggesting the entire sector may be extended and due for a pullback rather than this being ${ticker}-specific.`);
      } else if (target.rsi < 35 && lowRsiPeers.length === 0) {
        parts.push(`${ticker}'s oversold RSI (${target.rsi.toFixed(0)}) stands out from its peer group, where no other stock is below 35. This company-specific weakness (rather than sector-wide selling) may warrant investigation into ${ticker}-specific catalysts driving the underperformance.`);
      }
    }
  }

  return parts.join(" ");
}

export default function PeerComparison({ ticker }: { ticker: string }) {
  const [peers, setPeers] = useState<PeerData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE}/peers/${ticker}`)
      .then((r) => r.json())
      .then((d) => setPeers(d.peers || []))
      .catch(() => setPeers([]))
      .finally(() => setLoading(false));
  }, [ticker]);

  const val = (v: number | null, suffix = "", prefix = "") => {
    if (v == null) return <span className="text-muted/30">--</span>;
    return `${prefix}${v.toFixed(1)}${suffix}`;
  };

  const colorVal = (v: number | null) => {
    if (v == null) return "text-muted/30";
    if (v > 0) return "text-green";
    if (v < 0) return "text-red";
    return "text-muted";
  };

  const rsiColor = (v: number | null) => {
    if (v == null) return "text-muted/30";
    if (v > 65) return "text-red";
    if (v < 35) return "text-green";
    return "text-yellow";
  };

  const bestInCol = (key: keyof PeerData, higher = true) => {
    const vals = peers
      .filter((p) => p[key] != null)
      .map((p) => ({ ticker: p.ticker, val: p[key] as number }));
    if (vals.length === 0) return "";
    vals.sort((a, b) => (higher ? b.val - a.val : a.val - b.val));
    return vals[0].ticker;
  };

  const bestGrowth = bestInCol("revenue_growth", true);
  const bestMargin = bestInCol("operating_margin", true);

  return (
    <div className="bg-card border border-border p-5">
      <h3 className="text-accent text-xs font-semibold tracking-wider mb-4">PEER COMPARISON</h3>

      {loading ? (
        <div className="text-accent text-xs animate-pulse">Loading peer data (this may take a moment)...</div>
      ) : peers.length === 0 ? (
        <div className="text-muted text-sm">No peer data available</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted border-b border-border text-right">
                <th className="pb-2 text-left font-normal">TICKER</th>
                <th className="pb-2 font-normal pr-2">PRICE</th>
                <th className="pb-2 font-normal pr-2">CHG%</th>
                <th className="pb-2 font-normal pr-2">MCAP</th>
                <th className="pb-2 font-normal pr-2">PE</th>
                <th className="pb-2 font-normal pr-2">FWD PE</th>
                <th className="pb-2 font-normal pr-2">REV GRW</th>
                <th className="pb-2 font-normal pr-2">GROSS M</th>
                <th className="pb-2 font-normal pr-2">OP M</th>
                <th className="pb-2 font-normal">RSI</th>
              </tr>
            </thead>
            <tbody>
              {peers.map((p, i) => (
                <tr
                  key={`${p.ticker}-${i}`}
                  className={`border-b border-border/50 text-right transition-colors ${
                    p.is_target ? "bg-accent/5" : "hover:bg-subtle"
                  }`}
                >
                  <td className="py-2 text-left">
                    <span className={p.is_target ? "text-accent font-semibold" : "text-foreground"}>
                      {p.ticker}
                    </span>
                    {p.is_target && <span className="text-accent/40 ml-1 text-[10px]">&lt;</span>}
                  </td>
                  <td className="py-2 pr-2 text-foreground">
                    {p.price != null ? `$${p.price.toFixed(2)}` : "--"}
                  </td>
                  <td className={`py-2 pr-2 ${colorVal(p.change_pct)}`}>
                    {p.change_pct != null ? `${p.change_pct >= 0 ? "+" : ""}${p.change_pct.toFixed(1)}%` : "--"}
                  </td>
                  <td className="py-2 pr-2 text-muted">{p.market_cap != null ? formatLargeNumber(p.market_cap) : "--"}</td>
                  <td className="py-2 pr-2 text-muted">{val(p.pe_ratio)}</td>
                  <td className="py-2 pr-2 text-muted">{val(p.forward_pe)}</td>
                  <td className={`py-2 pr-2 ${colorVal(p.revenue_growth)} ${p.ticker === bestGrowth ? "font-semibold" : ""}`}>
                    {p.revenue_growth != null ? `${p.revenue_growth >= 0 ? "+" : ""}${p.revenue_growth.toFixed(1)}%` : "--"}
                  </td>
                  <td className="py-2 pr-2 text-muted">{p.gross_margin != null ? `${p.gross_margin.toFixed(1)}%` : "--"}</td>
                  <td className={`py-2 pr-2 ${p.ticker === bestMargin ? "text-green font-semibold" : "text-muted"}`}>
                    {p.operating_margin != null ? `${p.operating_margin.toFixed(1)}%` : "--"}
                  </td>
                  <td className={`py-2 ${rsiColor(p.rsi)}`}>{p.rsi != null ? p.rsi.toFixed(1) : "--"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Summary */}
      {peers.length >= 2 && (
        <div className="mt-3 pt-3 border-t border-border/50">
          <div className="bg-subtle/50 border-l-2 border-accent/30 pl-3 pr-3 py-2.5">
            <div className="text-accent/60 text-[9px] font-semibold tracking-[0.15em] mb-1.5">AI ANALYSIS</div>
            <p className="text-[11px] text-muted leading-[1.7]">{buildPeerSummary(peers, ticker)}</p>
          </div>
        </div>
      )}
    </div>
  );
}
