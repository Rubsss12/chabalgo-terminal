"use client";

import { useState, useEffect } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Filing {
  form: string;
  date: string;
  description: string;
  url: string;
}

interface FilingsData {
  ticker: string;
  company_name: string;
  filings: Filing[];
  total: number;
}

const FORM_COLORS: Record<string, string> = {
  "10-K": "bg-accent/15 text-accent",
  "10-Q": "bg-blue-500/15 text-blue-400",
  "8-K": "bg-yellow-500/15 text-yellow-400",
  "4": "bg-green-500/15 text-green-400",
  "SC 13G": "bg-purple-500/15 text-purple-400",
  "SC 13G/A": "bg-purple-500/15 text-purple-400",
  DEF14A: "bg-orange-500/15 text-orange-400",
};

const FORM_LABELS: Record<string, string> = {
  "10-K": "Annual Report",
  "10-Q": "Quarterly Report",
  "8-K": "Current Report",
  "4": "Insider Transaction",
  "SC 13G": "Institutional Holdings",
  "SC 13G/A": "Holdings Amendment",
  DEF14A: "Proxy Statement",
};

type FilterType = "" | "10-K" | "10-Q" | "8-K" | "4";

export default function SECFilings({ ticker }: { ticker: string }) {
  const [data, setData] = useState<FilingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("");

  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE}/sec/filings/${ticker}`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      })
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [ticker]);

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 text-[10px] text-muted animate-pulse">
          <div className="w-3 h-3 border border-accent/30 border-t-accent rounded-full animate-spin" />
          Loading SEC filings...
        </div>
      </div>
    );
  }

  if (!data || data.filings.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="text-[10px] text-muted/50">No SEC filings available for {ticker}</div>
      </div>
    );
  }

  const filtered = filter ? data.filings.filter((f) => f.form === filter) : data.filings;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1 h-4 bg-accent rounded-full" />
          <span className="text-[11px] font-bold tracking-wider text-foreground">SEC FILINGS</span>
          <span className="text-[8px] bg-accent/10 text-accent px-1.5 py-0.5 rounded-xl font-bold tracking-widest">EDGAR</span>
        </div>
        <div className="flex items-center gap-1.5">
          {(["", "10-K", "10-Q", "8-K", "4"] as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-[8px] px-2 py-0.5 rounded-xl font-medium tracking-wider transition-colors ${
                filter === f
                  ? "bg-accent/15 text-accent"
                  : "text-muted/40 hover:text-muted"
              }`}
            >
              {f || "ALL"}
            </button>
          ))}
        </div>
      </div>

      <div className="max-h-72 overflow-y-auto divide-y divide-border/30">
        {filtered.map((f, i) => (
          <div key={i} className="px-4 py-2.5 hover:bg-background/50 transition-colors flex items-start gap-3">
            <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-xl flex-shrink-0 mt-0.5 ${FORM_COLORS[f.form] || "bg-muted/10 text-muted"}`}>
              {f.form}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] text-foreground truncate">
                  {f.description || FORM_LABELS[f.form] || f.form}
                </span>
                <span className="text-[8px] text-muted/40 flex-shrink-0">{f.date}</span>
              </div>
              {f.url && (
                <a
                  href={f.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[8px] text-accent/60 hover:text-accent transition-colors"
                >
                  View on SEC.gov
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="px-4 py-2 border-t border-border text-[8px] text-muted/30">
        {filtered.length} of {data.total} filings shown
      </div>
    </div>
  );
}
