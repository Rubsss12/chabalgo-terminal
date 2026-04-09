"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface EarningsEntry {
  period: string;
  quarter: number | null;
  year: number | null;
  actual: number | null;
  estimate: number | null;
  surprise: number | null;
  surprise_pct: number | null;
}

interface NextEarnings {
  date: string;
  days_until: number;
  hour: string;
  eps_estimate: number | null;
  revenue_estimate: number | null;
}

interface EarningsData {
  ticker: string;
  history: EarningsEntry[];
  next_earnings: NextEarnings | null;
}

function buildEarningsSummary(history: EarningsEntry[], nextEarnings: NextEarnings | null, ticker: string): string {
  if (!history.length) return "";
  const parts: string[] = [];

  const withActual = history.filter(e => e.actual != null && e.estimate != null);
  const beats = withActual.filter(e => e.actual! >= e.estimate!);
  const beatRate = withActual.length > 0 ? (beats.length / withActual.length * 100) : 0;

  if (beatRate >= 80) {
    parts.push(`${ticker} has beaten analyst EPS estimates in ${beats.length} of the last ${withActual.length} quarters — a ${beatRate.toFixed(0)}% beat rate. This level of consistency is a hallmark of well-managed companies with conservative guidance practices. Management teams that routinely under-promise and over-deliver tend to build institutional investor trust, which supports premium valuations and limits downside during market corrections.`);
  } else if (beatRate >= 60) {
    parts.push(`${ticker} has beaten estimates in ${beats.length} out of ${withActual.length} recent quarters (${beatRate.toFixed(0)}% beat rate). While this is a generally solid track record, the occasional misses indicate some unpredictability in the business — either revenue timing, cost fluctuations, or one-time items that make quarter-to-quarter results harder to forecast. Investors should focus on the trend direction rather than any single quarter.`);
  } else if (beatRate >= 40) {
    parts.push(`${ticker} has a mixed earnings track record, beating estimates only ${beats.length} out of ${withActual.length} times (${beatRate.toFixed(0)}%). A sub-60% beat rate raises questions about management's ability to forecast their own business or about structural challenges making results unpredictable. This level of inconsistency often leads to a "show me" discount in the stock's valuation until the company proves it can deliver more reliably.`);
  } else {
    parts.push(`${ticker} has struggled to meet Wall Street expectations, beating estimates just ${beats.length} out of ${withActual.length} quarters (${beatRate.toFixed(0)}%). Persistent misses suggest either that analysts are too optimistic about the business trajectory, or that management is facing genuine execution challenges. Stocks with low beat rates typically trade at discounted multiples and need a clear inflection point to re-rate higher.`);
  }

  // Recent trend
  if (withActual.length >= 2) {
    const latest = withActual[0];
    const prev = withActual[1];
    if (latest.surprise_pct != null && prev.surprise_pct != null) {
      if (latest.surprise_pct > prev.surprise_pct && latest.surprise_pct > 0) {
        parts.push(`Importantly, the earnings surprise margin is improving: last quarter came in +${latest.surprise_pct.toFixed(1)}% above estimates versus +${prev.surprise_pct.toFixed(1)}% the quarter before. An expanding beat margin is one of the strongest forward-looking indicators — it often precedes analyst estimate revisions upward, which is a key catalyst for stock price appreciation.`);
      } else if (latest.surprise_pct > 0 && prev.surprise_pct > 0 && latest.surprise_pct < prev.surprise_pct) {
        parts.push(`While ${ticker} still beat estimates last quarter (+${latest.surprise_pct.toFixed(1)}%), the surprise margin narrowed from +${prev.surprise_pct.toFixed(1)}% the quarter before. A shrinking beat margin can be an early warning sign — it may indicate that the business is decelerating while analyst expectations are catching up, leaving less room for positive surprises going forward.`);
      } else if (latest.surprise_pct < 0) {
        parts.push(`Last quarter was a miss, coming in ${latest.surprise_pct.toFixed(1)}% below consensus estimates. An earnings miss after a period of beats is particularly concerning because it can trigger a re-evaluation by analysts and investors. The key question is whether this was caused by a one-time factor (timing, FX impact, restructuring charge) or reflects a fundamental deterioration in business momentum.`);
      }
    }
    if (latest.actual != null && prev.actual != null && prev.actual !== 0) {
      const epsGrowth = ((latest.actual - prev.actual) / Math.abs(prev.actual) * 100);
      if (epsGrowth > 30) {
        parts.push(`EPS grew ${epsGrowth.toFixed(0)}% quarter-over-quarter, demonstrating strong earnings acceleration. This kind of sequential improvement signals that the business is scaling effectively, with revenue growth translating into disproportionate bottom-line gains — a sign of operating leverage at work.`);
      } else if (epsGrowth > 10) {
        parts.push(`EPS grew ${epsGrowth.toFixed(0)}% versus the prior quarter, showing healthy sequential improvement in profitability.`);
      } else if (epsGrowth < -15) {
        parts.push(`EPS declined ${Math.abs(epsGrowth).toFixed(0)}% sequentially, which could reflect seasonality, increased investment spending, or weakening demand. It's important to compare this against the same quarter last year for a cleaner read on the underlying trend.`);
      }
    }
  }

  // Next earnings
  if (nextEarnings) {
    if (nextEarnings.days_until <= 7) {
      parts.push(`Upcoming earnings report is imminent — just ${nextEarnings.days_until} day${nextEarnings.days_until === 1 ? "" : "s"} away${nextEarnings.hour === "bmo" ? " (before market open)" : nextEarnings.hour === "amc" ? " (after market close)" : ""}. Expect significantly elevated volatility around the report. Options pricing typically implies a ${nextEarnings.days_until <= 3 ? "5-10%" : "3-7%"} move in either direction. If you're considering a position, be aware that the risk/reward profile changes dramatically right before earnings.`);
    } else if (nextEarnings.days_until <= 30) {
      parts.push(`Next earnings report is scheduled for ${nextEarnings.date} (${nextEarnings.days_until} days out). As the report approaches, expect the stock to increasingly trade on earnings expectations rather than broader market dynamics. This is a period where analyst estimate revisions and management commentary at conferences become the primary drivers.`);
    }
  }

  return parts.join(" ");
}

export default function EarningsPanel({ ticker }: { ticker: string }) {
  const [data, setData] = useState<EarningsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE}/earnings/${ticker}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [ticker]);

  const chartData = (data?.history || [])
    .slice()
    .reverse()
    .map((e) => ({
      label: e.quarter && e.year ? `Q${e.quarter} ${e.year}` : e.period,
      actual: e.actual,
      estimate: e.estimate,
      surprise_pct: e.surprise_pct,
      beat: e.actual != null && e.estimate != null && e.actual >= e.estimate,
    }));

  const beatCount = chartData.filter((d) => d.beat).length;
  const totalCount = chartData.filter((d) => d.actual != null).length;

  return (
    <div className="bg-card border border-border p-5">
      <h3 className="text-accent text-xs font-semibold tracking-wider mb-4">EARNINGS</h3>

      {loading ? (
        <div className="text-accent text-xs animate-pulse">Loading earnings data...</div>
      ) : !data ? (
        <div className="text-muted text-sm">Data unavailable</div>
      ) : (
        <>
          {data.next_earnings ? (
            <div className="border border-border bg-subtle p-3 mb-4">
              <div className="flex items-center justify-between">
                <div className="text-xs text-muted tracking-wider">NEXT EARNINGS</div>
                <div className="flex items-center gap-2">
                  <span className="text-accent text-sm font-semibold">
                    {data.next_earnings.days_until === 0
                      ? "TODAY"
                      : data.next_earnings.days_until === 1
                      ? "TOMORROW"
                      : `${data.next_earnings.days_until}d`}
                  </span>
                  <span className="text-muted text-xs">
                    {data.next_earnings.date}
                    {data.next_earnings.hour === "bmo"
                      ? " (Before Open)"
                      : data.next_earnings.hour === "amc"
                      ? " (After Close)"
                      : ""}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-muted mb-3">No upcoming earnings date available</div>
          )}

          {totalCount > 0 && (
            <div className="text-xs text-muted mb-3">
              BEAT RECORD: <span className="text-green font-semibold">{beatCount}/{totalCount}</span>
              {" "}({((beatCount / totalCount) * 100).toFixed(0)}%)
            </div>
          )}

          {chartData.length > 0 && (
            <div className="h-[180px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 5, left: -10, bottom: 5 }} barGap={2}>
                  <XAxis dataKey="label" tick={{ fill: "#8B8680", fontSize: 10 }} axisLine={{ stroke: "#E5E0DA" }} tickLine={false} />
                  <YAxis tick={{ fill: "#8B8680", fontSize: 10 }} axisLine={{ stroke: "#E5E0DA" }} tickLine={false} tickFormatter={(v: number) => `$${v.toFixed(2)}`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E0DA", fontSize: "11px", borderRadius: 2 }}
                    labelStyle={{ color: "#8B8680" }}
                    formatter={(value: number, name: string) => [
                      `$${value?.toFixed(4) ?? "--"}`,
                      name === "estimate" ? "Estimate" : "Actual",
                    ]}
                  />
                  <ReferenceLine y={0} stroke="#E5E0DA" />
                  <Bar dataKey="estimate" fill="#E5E0DA" radius={[2, 2, 0, 0]} barSize={16} />
                  <Bar dataKey="actual" radius={[2, 2, 0, 0]} barSize={16}>
                    {chartData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.beat ? "#F37021" : "#C0392B"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {chartData.length > 0 && (
            <div className="mt-3">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted border-b border-border">
                    <th className="text-left pb-1.5 font-normal">QTR</th>
                    <th className="text-right pb-1.5 font-normal">EST</th>
                    <th className="text-right pb-1.5 font-normal">ACT</th>
                    <th className="text-right pb-1.5 font-normal">SURPRISE</th>
                  </tr>
                </thead>
                <tbody>
                  {chartData.map((e, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-1.5 text-muted">{e.label}</td>
                      <td className="py-1.5 text-right text-muted">{e.estimate != null ? `$${e.estimate.toFixed(2)}` : "--"}</td>
                      <td className={`py-1.5 text-right font-medium ${e.beat ? "text-green" : "text-red"}`}>
                        {e.actual != null ? `$${e.actual.toFixed(2)}` : "--"}
                      </td>
                      <td className={`py-1.5 text-right ${e.surprise_pct != null && e.surprise_pct >= 0 ? "text-green" : "text-red"}`}>
                        {e.surprise_pct != null ? `${e.surprise_pct >= 0 ? "+" : ""}${e.surprise_pct.toFixed(1)}%` : "--"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Summary */}
          {data.history.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border/50">
              <div className="bg-subtle/50 border-l-2 border-accent/30 pl-3 pr-3 py-2.5">
                <div className="text-accent/60 text-[9px] font-semibold tracking-[0.15em] mb-1.5">AI ANALYSIS</div>
                <p className="text-[11px] text-muted leading-[1.7]">
                  {buildEarningsSummary(data.history, data.next_earnings, ticker)}
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
