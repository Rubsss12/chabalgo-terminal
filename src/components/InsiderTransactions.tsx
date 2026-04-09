"use client";

import { useEffect, useState } from "react";
import { formatLargeNumber } from "@/lib/format";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Transaction {
  name: string;
  type: string;
  shares: number;
  price: number | null;
  value: number;
  date: string;
  filing_date: string;
}

interface InsiderSummary {
  name: string;
  buy_value: number;
  sell_value: number;
  buy_shares: number;
  sell_shares: number;
  tx_count: number;
}

interface Summary {
  by_insider: InsiderSummary[];
  total_buy_value: number;
  total_sell_value: number;
  total_transactions: number;
  period_from: string;
  period_to: string;
}

type ViewMode = "summary" | "all";

function buildInsiderSummary(summary: Summary | null, transactions: Transaction[], ticker: string): string {
  if (!summary || transactions.length === 0) return "";
  const parts: string[] = [];

  const totalBuys = summary.total_buy_value;
  const totalSells = summary.total_sell_value;
  const ratio = totalSells > 0 && totalBuys > 0 ? totalSells / totalBuys : 0;
  const txCount = summary.total_transactions;

  if (totalBuys > 0 && totalSells === 0) {
    parts.push(`Over the past 6 months, insiders have been exclusively buying ${ticker} — $${formatLargeNumber(totalBuys)} in open-market purchases across ${txCount} transaction${txCount > 1 ? "s" : ""} with zero sells. This is one of the strongest bullish signals available in equity analysis. When executives and directors spend their own money buying shares — knowing full well the regulatory scrutiny and filing requirements involved — it signals genuine confidence in the company's future. Academic research consistently shows that insider buying clusters precede above-average stock returns over the following 6-12 months.`);
  } else if (totalSells > 0 && totalBuys === 0) {
    if (totalSells > 50e6) {
      parts.push(`Significant insider selling: $${formatLargeNumber(totalSells)} in total sales over ${txCount} transactions with no insider buying to offset. While it's important to remember that insiders sell for many legitimate reasons — diversification, taxes, estate planning, home purchases — selling of this magnitude with zero offsetting buys is worth monitoring. The key distinction is between planned 10b5-1 sales (systematic, pre-scheduled) and discretionary sales (which may reflect the insider's view on valuation). Without buying to counterbalance, the overall insider sentiment picture leans bearish.`);
    } else if (totalSells > 10e6) {
      parts.push(`Insiders have been net sellers with $${formatLargeNumber(totalSells)} in sales and no buys in the period. While insider selling alone is not a reliable bearish signal (executives routinely sell for compensation diversification, tax obligations, and liquidity needs), the absence of any buying suggests no insider felt the stock was undervalued enough to commit personal capital. This is more of a neutral-to-cautious signal than an outright red flag.`);
    } else {
      parts.push(`Modest insider selling of $${formatLargeNumber(totalSells)} across ${txCount} transaction${txCount > 1 ? "s" : ""}. This level of selling is generally considered routine — it's common for executives at growth companies to regularly sell small portions of vested equity compensation. The dollar amounts here don't suggest any urgency or large-scale liquidation by management.`);
    }
  } else if (ratio > 10) {
    parts.push(`Insider selling outpaces buying by a striking ${ratio.toFixed(0)}:1 ratio — $${formatLargeNumber(totalSells)} in sales versus just $${formatLargeNumber(totalBuys)} in purchases. While the extreme skew looks alarming at first glance, it's important to contextualize this: most large-cap companies see sell-heavy insider activity because executive compensation is heavily equity-based, creating a natural flow of shares being sold as they vest. The small amount of buying is actually more meaningful than the large amount of selling — it shows at least some insiders see value at current prices.`);
  } else if (ratio > 3) {
    parts.push(`Insider selling exceeds buying by a ${ratio.toFixed(1)}:1 ratio ($${formatLargeNumber(totalSells)} sold vs $${formatLargeNumber(totalBuys)} bought). This is a common pattern at growing technology and healthcare companies where equity compensation represents a significant portion of total pay. The buying activity, while smaller, is the more informative data point — insiders choose to buy, but they're often required to sell for diversification and tax purposes.`);
  } else if (totalBuys > totalSells && totalBuys > 0) {
    const netBuy = totalBuys - totalSells;
    parts.push(`Net insider buying of $${formatLargeNumber(netBuy)} is a positive signal. When insiders collectively purchase more than they sell, it indicates that those with the deepest knowledge of the company's operations, pipeline, and financial outlook believe the stock is undervalued. This is especially meaningful if the buying comes from C-suite executives or board members rather than lower-level officers, as senior leadership has the most visibility into the company's trajectory.`);
  }

  // Notable individuals
  if (summary.by_insider.length > 0) {
    const biggestSeller = summary.by_insider.reduce((a, b) => b.sell_value > a.sell_value ? b : a);
    const biggestBuyer = summary.by_insider.reduce((a, b) => b.buy_value > a.buy_value ? b : a);

    if (biggestBuyer.buy_value > 500000) {
      parts.push(`The largest buyer was ${biggestBuyer.name}, who purchased $${formatLargeNumber(biggestBuyer.buy_value)} worth of shares. Purchases above $500K are considered "high-conviction" buys — the insider is making a meaningful financial bet on the stock, not just a symbolic gesture.`);
    } else if (biggestBuyer.buy_value > 100000) {
      parts.push(`Notable buyer: ${biggestBuyer.name} purchased $${formatLargeNumber(biggestBuyer.buy_value)} in shares.`);
    }

    if (biggestSeller.sell_value > 5e6) {
      parts.push(`The largest seller was ${biggestSeller.name} with $${formatLargeNumber(biggestSeller.sell_value)} in sales. Large individual sells from a single insider can be concerning if they represent a significant portion of that insider's total holdings — check SEC Form 4 filings for the remaining ownership percentage.`);
    } else if (biggestSeller.sell_value > 1e6) {
      parts.push(`Largest seller: ${biggestSeller.name} ($${formatLargeNumber(biggestSeller.sell_value)}). This is a moderate-sized sale that could easily be part of a routine diversification plan.`);
    }
  }

  return parts.join(" ");
}

export default function InsiderTransactions({ ticker }: { ticker: string }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>("summary");

  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE}/insiders/${ticker}`)
      .then((r) => r.json())
      .then((d) => {
        setTransactions(d.transactions || []);
        setSummary(d.summary || null);
      })
      .catch(() => {
        setTransactions([]);
        setSummary(null);
      })
      .finally(() => setLoading(false));
  }, [ticker]);

  const typeColor = (t: string) => {
    if (t === "BUY") return "text-green";
    if (t === "SELL") return "text-red";
    return "text-yellow";
  };

  const totalBuys = summary?.total_buy_value || 0;
  const totalSells = summary?.total_sell_value || 0;
  const totalFlow = totalBuys + totalSells;

  return (
    <div className="bg-card border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-accent text-xs font-semibold tracking-wider">INSIDER TRANSACTIONS</h3>
        {transactions.length > 0 && (
          <div className="flex gap-0 border border-border">
            <button
              onClick={() => setView("summary")}
              className={`px-3 py-1 text-xs transition-colors ${
                view === "summary" ? "bg-accent text-white" : "text-muted hover:text-foreground"
              }`}
            >
              SUMMARY
            </button>
            <button
              onClick={() => setView("all")}
              className={`px-3 py-1 text-xs border-l border-border transition-colors ${
                view === "all" ? "bg-accent text-white" : "text-muted hover:text-foreground"
              }`}
            >
              ALL ({transactions.length})
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-accent text-xs animate-pulse">Loading insider data...</div>
      ) : transactions.length === 0 ? (
        <div className="text-muted text-sm">No insider transactions in last 6 months</div>
      ) : (
        <>
          <div className="flex gap-4 mb-3 text-xs">
            <span className="text-green font-medium">BUYS: ${formatLargeNumber(totalBuys)}</span>
            <span className="text-red font-medium">SELLS: ${formatLargeNumber(totalSells)}</span>
            <span className="text-muted">{summary?.period_from} to {summary?.period_to}</span>
          </div>

          {totalFlow > 0 && (
            <div className="w-full h-1.5 bg-subtle mb-4 flex rounded-full overflow-hidden">
              {totalBuys > 0 && (
                <div className="h-full bg-green" style={{ width: `${(totalBuys / totalFlow) * 100}%` }} />
              )}
              {totalSells > 0 && (
                <div className="h-full bg-red" style={{ width: `${(totalSells / totalFlow) * 100}%` }} />
              )}
            </div>
          )}

          {view === "summary" && summary ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted text-left border-b border-border">
                    <th className="pb-2 pr-2 font-normal">INSIDER</th>
                    <th className="pb-2 pr-2 font-normal text-right">BUYS</th>
                    <th className="pb-2 pr-2 font-normal text-right">SELLS</th>
                    <th className="pb-2 font-normal text-right">NET</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.by_insider.map((ins, i) => {
                    const net = ins.buy_value - ins.sell_value;
                    return (
                      <tr key={i} className="border-b border-border/50 hover:bg-subtle transition-colors">
                        <td className="py-2 pr-2 text-foreground truncate max-w-[180px]">
                          {ins.name}
                          <span className="text-muted ml-1 text-[10px]">({ins.tx_count})</span>
                        </td>
                        <td className="py-2 pr-2 text-right text-green">
                          {ins.buy_value > 0 ? `$${formatLargeNumber(ins.buy_value)}` : "--"}
                        </td>
                        <td className="py-2 pr-2 text-right text-red">
                          {ins.sell_value > 0 ? `$${formatLargeNumber(ins.sell_value)}` : "--"}
                        </td>
                        <td className={`py-2 text-right font-semibold ${net >= 0 ? "text-green" : "text-red"}`}>
                          {net >= 0 ? "+" : "-"}${formatLargeNumber(Math.abs(net))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-card">
                  <tr className="text-muted text-left border-b border-border">
                    <th className="pb-2 pr-2 font-normal">DATE</th>
                    <th className="pb-2 pr-2 font-normal">INSIDER</th>
                    <th className="pb-2 pr-2 font-normal">TYPE</th>
                    <th className="pb-2 pr-2 font-normal text-right">SHARES</th>
                    <th className="pb-2 pr-2 font-normal text-right">PRICE</th>
                    <th className="pb-2 font-normal text-right">VALUE</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx, i) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-subtle transition-colors">
                      <td className="py-1.5 pr-2 text-muted whitespace-nowrap">{tx.date}</td>
                      <td className="py-1.5 pr-2 text-foreground truncate max-w-[140px]">{tx.name}</td>
                      <td className={`py-1.5 pr-2 font-semibold ${typeColor(tx.type)}`}>{tx.type}</td>
                      <td className={`py-1.5 pr-2 text-right ${tx.shares > 0 ? "text-green" : "text-red"}`}>
                        {tx.shares > 0 ? "+" : ""}{formatLargeNumber(tx.shares)}
                      </td>
                      <td className="py-1.5 pr-2 text-right text-muted">
                        {tx.price ? `$${tx.price.toFixed(2)}` : "--"}
                      </td>
                      <td className={`py-1.5 text-right ${tx.type === "BUY" ? "text-green" : "text-red"}`}>
                        ${formatLargeNumber(tx.value)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Summary */}
          <div className="mt-3 pt-3 border-t border-border/50">
            <div className="bg-subtle/50 border-l-2 border-accent/30 pl-3 pr-3 py-2.5">
              <div className="text-accent/60 text-[9px] font-semibold tracking-[0.15em] mb-1.5">AI ANALYSIS</div>
              <p className="text-[11px] text-muted leading-[1.7]">
                {buildInsiderSummary(summary, transactions, ticker)}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
