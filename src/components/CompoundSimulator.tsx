"use client";

import { useState, useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface SimResult {
  params: {
    initial: number;
    monthly: number;
    annual_rate: number;
    annual_fees: number;
    net_rate: number;
    years: number;
  };
  result: {
    final_capital: number;
    total_invested: number;
    total_interest: number;
    interest_pct: number;
  };
  chart: { month: number; year: number; balance: number; invested: number; interest: number }[];
}

function formatEUR(v: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
}

export default function CompoundSimulator() {
  const [initial, setInitial] = useState(10000);
  const [monthly, setMonthly] = useState(500);
  const [rate, setRate] = useState(10);
  const [fees, setFees] = useState(0.3);
  const [years, setYears] = useState(20);
  const [result, setResult] = useState<SimResult | null>(null);
  const [loading, setLoading] = useState(false);

  const simulate = () => {
    setLoading(true);
    fetch(
      `${API_BASE}/simulator/compound?initial=${initial}&monthly=${monthly}&annual_rate=${rate}&years=${years}&annual_fees=${fees}`,
      { method: "POST" }
    )
      .then((r) => r.json())
      .then((d) => setResult(d))
      .catch(() => setResult(null))
      .finally(() => setLoading(false));
  };

  // Client-side preview calculation for instant feedback
  const preview = useMemo(() => {
    const netRate = rate - fees;
    const monthlyRate = netRate / 100 / 12;
    let balance = initial;
    let totalInvested = initial;
    const points: { year: number; balance: number; invested: number; interest: number }[] = [];

    for (let m = 0; m <= years * 12; m++) {
      if (m % 12 === 0) {
        points.push({
          year: m / 12,
          balance: Math.round(balance),
          invested: Math.round(totalInvested),
          interest: Math.round(balance - totalInvested),
        });
      }
      if (m < years * 12) {
        balance = balance * (1 + monthlyRate) + monthly;
        totalInvested += monthly;
      }
    }

    const final = points[points.length - 1];
    return { points, final };
  }, [initial, monthly, rate, fees, years]);

  const chartData = result?.chart || preview.points;
  const finalResult = result?.result || {
    final_capital: preview.final.balance,
    total_invested: preview.final.invested,
    total_interest: preview.final.interest,
    interest_pct: preview.final.balance > 0
      ? Math.round((preview.final.interest / preview.final.balance) * 1000) / 10
      : 0,
  };

  const investedPct = finalResult.final_capital > 0
    ? Math.round((finalResult.total_invested / finalResult.final_capital) * 1000) / 10
    : 0;

  return (
    <div className="bg-card border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-accent text-xs font-semibold tracking-wider">SIMULATEUR INTÉRÊTS COMPOSÉS</h3>
          <p className="text-muted text-[10px] mt-0.5">Calculez la puissance de l&apos;effet cumulé sur votre épargne</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5">
        {/* Input panel */}
        <div className="space-y-4">
          {/* Placement initial */}
          <div>
            <label className="text-[10px] text-muted tracking-wider block mb-1.5">PLACEMENT INITIAL</label>
            <div className="flex items-center border border-border bg-subtle/30 px-3 py-2">
              <input
                type="number"
                value={initial}
                onChange={(e) => setInitial(Number(e.target.value) || 0)}
                className="flex-1 bg-transparent text-foreground text-sm outline-none"
                min={0}
                step={1000}
              />
              <span className="text-muted text-xs ml-2">EUR</span>
            </div>
            <input
              type="range"
              min={0}
              max={100000}
              step={1000}
              value={initial}
              onChange={(e) => setInitial(Number(e.target.value))}
              className="w-full mt-1.5 accent-accent h-1"
            />
          </div>

          {/* Versements mensuels */}
          <div>
            <label className="text-[10px] text-muted tracking-wider block mb-1.5">VERSEMENTS MENSUELS</label>
            <div className="flex items-center border border-border bg-subtle/30 px-3 py-2">
              <input
                type="number"
                value={monthly}
                onChange={(e) => setMonthly(Number(e.target.value) || 0)}
                className="flex-1 bg-transparent text-foreground text-sm outline-none"
                min={0}
                step={100}
              />
              <span className="text-muted text-xs ml-2">EUR</span>
            </div>
            <input
              type="range"
              min={0}
              max={5000}
              step={50}
              value={monthly}
              onChange={(e) => setMonthly(Number(e.target.value))}
              className="w-full mt-1.5 accent-accent h-1"
            />
          </div>

          {/* Taux d'intérêt annuel */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-muted tracking-wider block mb-1.5">TAUX ANNUEL</label>
              <div className="flex items-center border border-border bg-subtle/30 px-3 py-2">
                <input
                  type="number"
                  value={rate}
                  onChange={(e) => setRate(Number(e.target.value) || 0)}
                  className="flex-1 bg-transparent text-foreground text-sm outline-none"
                  min={0}
                  max={30}
                  step={0.5}
                />
                <span className="text-muted text-xs ml-2">%</span>
              </div>
            </div>
            <div>
              <label className="text-[10px] text-muted tracking-wider block mb-1.5">FRAIS ANNUELS</label>
              <div className="flex items-center border border-border bg-subtle/30 px-3 py-2">
                <input
                  type="number"
                  value={fees}
                  onChange={(e) => setFees(Number(e.target.value) || 0)}
                  className="flex-1 bg-transparent text-foreground text-sm outline-none"
                  min={0}
                  max={5}
                  step={0.1}
                />
                <span className="text-muted text-xs ml-2">%</span>
              </div>
            </div>
          </div>

          {/* Nombre d'années */}
          <div>
            <label className="text-[10px] text-muted tracking-wider block mb-1.5">
              DURÉE DU PLACEMENT : <span className="text-accent font-semibold">{years} ans</span>
            </label>
            <input
              type="range"
              min={1}
              max={40}
              step={1}
              value={years}
              onChange={(e) => setYears(Number(e.target.value))}
              className="w-full accent-accent h-1"
            />
            <div className="flex justify-between text-[9px] text-muted/50 mt-0.5">
              <span>1 an</span>
              <span>10</span>
              <span>20</span>
              <span>30</span>
              <span>40 ans</span>
            </div>
          </div>

          {/* Preset buttons */}
          <div>
            <div className="text-[10px] text-muted tracking-wider mb-1.5">TAUX PRÉDÉFINIS</div>
            <div className="flex gap-1.5 flex-wrap">
              {[
                { label: "Livret A", rate: 2.4, fees: 0 },
                { label: "Obligations", rate: 4, fees: 0.3 },
                { label: "MSCI World", rate: 10.5, fees: 0.38 },
                { label: "S&P 500", rate: 11.6, fees: 0.15 },
                { label: "Nasdaq 100", rate: 14, fees: 0.2 },
              ].map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => {
                    setRate(preset.rate);
                    setFees(preset.fees);
                  }}
                  className={`text-[10px] px-2 py-1 border transition-colors ${
                    rate === preset.rate && fees === preset.fees
                      ? "border-accent text-accent bg-accent/5"
                      : "border-border text-muted hover:text-foreground hover:border-border"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results panel */}
        <div>
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-subtle/50 border border-border p-3">
              <div className="text-[9px] text-muted tracking-wider mb-1">CAPITAL FINAL</div>
              <div className="text-xl font-semibold text-accent">{formatEUR(finalResult.final_capital)}</div>
              <div className="text-[10px] text-muted mt-1">
                en {years} ans à {(rate - fees).toFixed(1)}% net
              </div>
            </div>
            <div className="bg-subtle/50 border border-border p-3">
              <div className="text-[9px] text-muted tracking-wider mb-1">SOMME INVESTIE</div>
              <div className="text-xl font-semibold text-foreground">{formatEUR(finalResult.total_invested)}</div>
              <div className="text-[10px] text-muted mt-1">{investedPct}% du capital final</div>
            </div>
            <div className="bg-subtle/50 border border-border p-3">
              <div className="text-[9px] text-muted tracking-wider mb-1">INTÉRÊTS GAGNÉS</div>
              <div className="text-xl font-semibold text-green">{formatEUR(finalResult.total_interest)}</div>
              <div className="text-[10px] text-green/70 mt-1">{finalResult.interest_pct}% du capital final</div>
            </div>
          </div>

          {/* Stacked bar showing invested vs interest */}
          <div className="w-full h-3 flex rounded-full overflow-hidden mb-4">
            <div
              className="h-full bg-foreground/30"
              style={{ width: `${investedPct}%` }}
              title={`Investi: ${investedPct}%`}
            />
            <div
              className="h-full bg-green"
              style={{ width: `${finalResult.interest_pct}%` }}
              title={`Intérêts: ${finalResult.interest_pct}%`}
            />
          </div>
          <div className="flex gap-4 text-[10px] text-muted mb-4">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-foreground/30 rounded-xl" /> Somme investie
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-green rounded-xl" /> Intérêts composés
            </span>
          </div>

          {/* Chart */}
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 10 }}>
                <CartesianGrid stroke="#E5E0DA" strokeDasharray="3 3" />
                <XAxis
                  dataKey="year"
                  tick={{ fill: "#8B8680", fontSize: 10 }}
                  tickFormatter={(v) => `${Math.round(v)}a`}
                />
                <YAxis
                  tick={{ fill: "#8B8680", fontSize: 10 }}
                  width={65}
                  tickFormatter={(v) => {
                    if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M€`;
                    if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K€`;
                    return `${v}€`;
                  }}
                />
                <Tooltip
                  contentStyle={{
                    background: "#FFFFFF",
                    border: "1px solid #E5E0DA",
                    fontSize: 11,
                    borderRadius: 2,
                  }}
                  labelStyle={{ color: "#8B8680" }}
                  labelFormatter={(v) => `Année ${Math.round(Number(v))}`}
                  formatter={(value: unknown, name: unknown) => [
                    formatEUR(Number(value ?? 0)),
                    String(name) === "invested" ? "Somme investie" : String(name) === "balance" ? "Capital total" : "Intérêts",
                  ]}
                />
                <Legend
                  wrapperStyle={{ fontSize: 10 }}
                  formatter={(value) =>
                    value === "invested" ? "Somme investie" : value === "balance" ? "Capital total" : "Intérêts"
                  }
                />
                <Area
                  type="monotone"
                  dataKey="invested"
                  stackId="1"
                  stroke="#8B8680"
                  fill="#E5E0DA"
                  fillOpacity={0.6}
                />
                <Area
                  type="monotone"
                  dataKey="interest"
                  stackId="1"
                  stroke="#2D8B4E"
                  fill="#2D8B4E"
                  fillOpacity={0.3}
                />
                <Area
                  type="monotone"
                  dataKey="balance"
                  stroke="#F37021"
                  fill="none"
                  strokeWidth={2}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* AI Summary */}
          <div className="mt-4 pt-3 border-t border-border/50">
            <div className="bg-subtle/50 border-l-2 border-accent/30 pl-3 pr-3 py-2.5">
              <div className="text-accent/60 text-[9px] font-semibold tracking-[0.15em] mb-1.5">AI ANALYSE</div>
              <p className="text-[11px] text-muted leading-[1.7]">
                {monthly > 0 && initial > 0
                  ? `Avec un placement initial de ${formatEUR(initial)} et des versements mensuels de ${formatEUR(monthly)}, votre capital atteindra ${formatEUR(finalResult.final_capital)} après ${years} ans à un taux net de ${(rate - fees).toFixed(1)}%. Sur cette somme, ${formatEUR(finalResult.total_interest)} proviennent uniquement des intérêts composés — soit ${finalResult.interest_pct}% du capital final. Autrement dit, l'effet boule de neige des intérêts composés génère ${finalResult.total_interest > finalResult.total_invested ? "plus" : "moins"} que ce que vous investissez directement. ${years >= 20 ? "C'est la magie du long terme : plus la durée est longue, plus les intérêts composés prennent le dessus sur les versements." : "En allongeant la durée au-delà de 20 ans, l'effet des intérêts composés devient encore plus spectaculaire."}`
                  : monthly > 0
                  ? `Avec des versements mensuels de ${formatEUR(monthly)} à ${(rate - fees).toFixed(1)}% net pendant ${years} ans, votre capital atteindra ${formatEUR(finalResult.final_capital)} dont ${formatEUR(finalResult.total_interest)} d'intérêts composés (${finalResult.interest_pct}% du total).`
                  : `Votre placement initial de ${formatEUR(initial)} atteindra ${formatEUR(finalResult.final_capital)} en ${years} ans grâce aux intérêts composés à ${(rate - fees).toFixed(1)}% net annuel. Les intérêts représentent ${formatEUR(finalResult.total_interest)} soit ${finalResult.interest_pct}% du capital final.`
                }
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
