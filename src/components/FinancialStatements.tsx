"use client";

import { useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type StatementType = "income" | "balance" | "cashflow";

interface FinancialData {
  ticker: string;
  name: string;
  currency: string;
  income_statement: Record<string, unknown>[];
  balance_sheet: Record<string, unknown>[];
  cash_flow: Record<string, unknown>[];
}

const KEY_ROWS: Record<StatementType, { key: string; label: string }[]> = {
  income: [
    { key: "Total Revenue", label: "Revenue" },
    { key: "Cost Of Revenue", label: "Cost of Revenue" },
    { key: "Gross Profit", label: "Gross Profit" },
    { key: "Operating Income", label: "Operating Income" },
    { key: "EBITDA", label: "EBITDA" },
    { key: "Net Income", label: "Net Income" },
    { key: "Basic EPS", label: "EPS (Basic)" },
    { key: "Diluted EPS", label: "EPS (Diluted)" },
  ],
  balance: [
    { key: "Total Assets", label: "Total Assets" },
    { key: "Current Assets", label: "Current Assets" },
    { key: "Cash And Cash Equivalents", label: "Cash & Equivalents" },
    { key: "Total Liabilities Net Minority Interest", label: "Total Liabilities" },
    { key: "Current Liabilities", label: "Current Liabilities" },
    { key: "Long Term Debt", label: "Long Term Debt" },
    { key: "Total Debt", label: "Total Debt" },
    { key: "Stockholders Equity", label: "Shareholders Equity" },
  ],
  cashflow: [
    { key: "Operating Cash Flow", label: "Operating CF" },
    { key: "Capital Expenditure", label: "CapEx" },
    { key: "Free Cash Flow", label: "Free Cash Flow" },
    { key: "Investing Cash Flow", label: "Investing CF" },
    { key: "Financing Cash Flow", label: "Financing CF" },
    { key: "Repurchase Of Capital Stock", label: "Buybacks" },
    { key: "Common Stock Dividend Paid", label: "Dividends Paid" },
    { key: "End Cash Position", label: "Ending Cash" },
  ],
};

function formatVal(v: unknown): string {
  if (v === null || v === undefined) return "—";
  const n = Number(v);
  if (isNaN(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e12) return `${(n / 1e12).toFixed(1)}T`;
  if (abs >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(0)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return n.toFixed(2);
}

export default function FinancialStatements({ ticker }: { ticker: string }) {
  const [data, setData] = useState<FinancialData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<StatementType>("income");

  useEffect(() => {
    setLoading(true);
    setError("");
    fetch(`${API_BASE}/financials/${ticker}`)
      .then((r) => {
        if (!r.ok) throw new Error("Financials unavailable");
        return r.json();
      })
      .then((d) => setData(d))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [ticker]);

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-4 h-4 border-2 border-accent/20 border-t-accent rounded-full animate-spin" />
          <span className="text-[10px] text-muted tracking-wider">FINANCIALS...</span>
        </div>
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-5 bg-subtle/50 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="text-[10px] text-red/70">{error || "No data"}</div>
      </div>
    );
  }

  const statementMap: Record<StatementType, Record<string, unknown>[]> = {
    income: data.income_statement || [],
    balance: data.balance_sheet || [],
    cashflow: data.cash_flow || [],
  };

  const rows = statementMap[tab];
  const periods = rows.map((r) => String(r.period || "").slice(0, 4));
  const keyRows = KEY_ROWS[tab];

  const tabs: { key: StatementType; label: string }[] = [
    { key: "income", label: "INCOME" },
    { key: "balance", label: "BALANCE" },
    { key: "cashflow", label: "CASH FLOW" },
  ];

  return (
    <div className="bg-card border border-border rounded-xl">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1 h-4 bg-accent rounded-full" />
          <span className="text-[11px] font-semibold tracking-wider text-foreground">FINANCIAL STATEMENTS</span>
          <span className="text-[9px] text-muted/50 tracking-wider">{data.currency}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2 text-[10px] tracking-wider font-medium transition-colors border-b-2 -mb-px ${
              tab === t.key
                ? "text-accent border-accent"
                : "text-muted/40 border-transparent hover:text-muted/70"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-[10px]">
          <thead>
            <tr className="bg-subtle/30">
              <th className="text-left text-muted/50 font-medium py-2 px-3 tracking-wider">METRIC</th>
              {periods.map((p, i) => (
                <th key={i} className="text-right text-muted/50 font-medium py-2 px-3 tracking-wider">{p}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {keyRows.map((kr, i) => {
              const hasData = rows.some((r) => r[kr.key] !== undefined && r[kr.key] !== null);
              if (!hasData) return null;
              return (
                <tr key={i} className="border-t border-border/30 hover:bg-subtle/20 transition-colors">
                  <td className="py-1.5 px-3 text-foreground/70 font-medium">{kr.label}</td>
                  {rows.map((r, j) => {
                    const val = r[kr.key];
                    const numVal = Number(val);
                    const isNeg = !isNaN(numVal) && numVal < 0;
                    return (
                      <td key={j} className={`py-1.5 px-3 text-right font-mono ${isNeg ? "text-red/70" : "text-foreground"}`}>
                        {formatVal(val)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {rows.length === 0 && (
        <div className="p-6 text-center text-[10px] text-muted/40">No data available</div>
      )}
    </div>
  );
}
