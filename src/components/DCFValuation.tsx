"use client";

import { useState, useEffect } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface RatingData {
  score: number;
  rating: string;
  recommendation: string;
  dcf_score: number;
  roe_score: number;
  roa_score: number;
  de_score: number;
  pe_score: number;
  pb_score: number;
}

interface Ratios {
  pe_ratio: number | null;
  peg_ratio: number | null;
  price_to_book: number | null;
  price_to_sales: number | null;
  ev_to_ebitda: number | null;
  roe: number | null;
  roa: number | null;
  debt_to_equity: number | null;
  current_ratio: number | null;
  gross_margin: number | null;
  operating_margin: number | null;
  net_margin: number | null;
  dividend_yield: number | null;
}

interface DCFData {
  ticker: string;
  dcf_price: number | null;
  stock_price: number | null;
  upside_pct: number | null;
  ratios: Ratios;
  rating: RatingData | null;
}

function fmt(v: number | null | undefined, decimals = 2, suffix = ""): string {
  if (v == null || isNaN(v)) return "—";
  return v.toFixed(decimals) + suffix;
}

function pctColor(v: number | null): string {
  if (v == null) return "text-muted/50";
  return v > 0 ? "text-green" : v < 0 ? "text-red" : "text-muted/50";
}

export default function DCFValuation({ ticker }: { ticker: string }) {
  const [data, setData] = useState<DCFData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE}/dcf/${ticker}`)
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
          Computing DCF valuation...
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="text-[10px] text-muted/50">DCF valuation unavailable (FMP API key required)</div>
      </div>
    );
  }

  const r = data.ratios;
  const rating = data.rating;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1 h-4 bg-accent rounded-full" />
          <span className="text-[11px] font-bold tracking-wider text-foreground">DCF VALUATION</span>
          <span className="text-[8px] bg-accent/10 text-accent px-1.5 py-0.5 rounded-xl font-bold tracking-widest">FMP</span>
        </div>
        {rating && (
          <div className="flex items-center gap-2">
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-xl ${
              rating.recommendation === "Strong Buy" ? "bg-green/15 text-green" :
              rating.recommendation === "Buy" ? "bg-green/10 text-green/80" :
              rating.recommendation === "Hold" ? "bg-yellow/10 text-yellow" :
              "bg-red/10 text-red"
            }`}>
              {rating.rating} — {rating.recommendation}
            </span>
          </div>
        )}
      </div>

      {/* DCF hero */}
      {data.dcf_price != null && (
        <div className="px-4 py-4 border-b border-border bg-background/50">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[8px] text-muted/50 tracking-wider mb-1">INTRINSIC VALUE (DCF)</div>
              <div className="text-[22px] font-black text-foreground">${data.dcf_price.toFixed(2)}</div>
            </div>
            <div className="text-right">
              <div className="text-[8px] text-muted/50 tracking-wider mb-1">MARKET PRICE</div>
              <div className="text-[16px] font-bold text-muted">${data.stock_price?.toFixed(2) ?? "—"}</div>
            </div>
            {data.upside_pct != null && (
              <div className="text-right">
                <div className="text-[8px] text-muted/50 tracking-wider mb-1">UPSIDE</div>
                <div className={`text-[18px] font-black ${pctColor(data.upside_pct)}`}>
                  {data.upside_pct > 0 ? "+" : ""}{data.upside_pct.toFixed(1)}%
                </div>
              </div>
            )}
          </div>
          {/* Visual bar */}
          {data.stock_price != null && data.dcf_price != null && (
            <div className="mt-3 relative h-2 bg-background rounded-full overflow-hidden">
              <div
                className={`absolute inset-y-0 left-0 rounded-full ${data.dcf_price > data.stock_price ? "bg-green/40" : "bg-red/40"}`}
                style={{ width: `${Math.min(100, (Math.min(data.stock_price, data.dcf_price) / Math.max(data.stock_price, data.dcf_price)) * 100)}%` }}
              />
              <div className="absolute inset-y-0 left-0 bg-accent/20 rounded-full" style={{ width: "100%" }} />
            </div>
          )}
        </div>
      )}

      {/* Key ratios grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 divide-x divide-y divide-border">
        {[
          { label: "P/E", value: fmt(r.pe_ratio) },
          { label: "PEG", value: fmt(r.peg_ratio) },
          { label: "P/B", value: fmt(r.price_to_book) },
          { label: "P/S", value: fmt(r.price_to_sales) },
          { label: "EV/EBITDA", value: fmt(r.ev_to_ebitda) },
          { label: "ROE", value: fmt(r.roe != null ? r.roe * 100 : null, 1, "%") },
          { label: "ROA", value: fmt(r.roa != null ? r.roa * 100 : null, 1, "%") },
          { label: "D/E", value: fmt(r.debt_to_equity) },
          { label: "Gross Margin", value: fmt(r.gross_margin != null ? r.gross_margin * 100 : null, 1, "%") },
          { label: "Op Margin", value: fmt(r.operating_margin != null ? r.operating_margin * 100 : null, 1, "%") },
          { label: "Net Margin", value: fmt(r.net_margin != null ? r.net_margin * 100 : null, 1, "%") },
          { label: "Div Yield", value: fmt(r.dividend_yield != null ? r.dividend_yield * 100 : null, 2, "%") },
        ].map((m) => (
          <div key={m.label} className="p-2.5">
            <div className="text-[7px] text-muted/40 tracking-wider">{m.label}</div>
            <div className="text-[12px] font-bold text-foreground mt-0.5">{m.value}</div>
          </div>
        ))}
      </div>

      {/* Rating breakdown */}
      {rating && (
        <div className="px-4 py-2 border-t border-border">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[8px] text-muted/40 tracking-wider">SCORE</span>
            {[
              { label: "DCF", score: rating.dcf_score },
              { label: "ROE", score: rating.roe_score },
              { label: "ROA", score: rating.roa_score },
              { label: "D/E", score: rating.de_score },
              { label: "P/E", score: rating.pe_score },
              { label: "P/B", score: rating.pb_score },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-1">
                <span className="text-[8px] text-muted/50">{s.label}:</span>
                <span className={`text-[9px] font-bold ${s.score >= 4 ? "text-green" : s.score >= 3 ? "text-yellow" : "text-red"}`}>
                  {s.score}/5
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
