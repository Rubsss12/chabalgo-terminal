"use client";

import { AnalysisData } from "@/lib/types";
import { formatPrice, formatPct, formatLargeNumber, colorForValue } from "@/lib/format";

export default function Header({ data }: { data: AnalysisData }) {
  const { ticker, profile, price } = data;
  const changeColor = colorForValue(price.change);
  const currencySymbol = price.currency === "EUR" ? "\u20AC" : price.currency === "GBP" ? "\u00A3" : "$";
  const isUp = price.change >= 0;

  return (
    <div className="premium-card rounded-xl p-6">
      {/* Top row: ticker + name */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center">
            <span className="text-accent font-bold text-sm">{ticker.slice(0, 2)}</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-foreground text-xl font-bold tracking-tight">{ticker}</span>
              {profile.exchange && (
                <span className="text-[10px] text-muted bg-surface px-2 py-0.5 rounded-md font-medium">{profile.exchange}</span>
              )}
            </div>
            <span className="text-muted text-xs">{profile.name}</span>
          </div>
        </div>
      </div>

      {/* Price row */}
      <div className="flex items-end gap-6 mt-4 flex-wrap">
        <div>
          <div className="text-3xl font-bold text-foreground tabular-nums tracking-tight">
            {currencySymbol}{formatPrice(price.price)}
          </div>
          <div className={`flex items-center gap-2 mt-1 ${changeColor}`}>
            <svg className={`w-4 h-4 ${isUp ? "" : "rotate-180"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
            </svg>
            <span className="text-sm font-semibold tabular-nums">
              {isUp ? "+" : ""}{formatPrice(price.change)}
            </span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${isUp ? "bg-green/10" : "bg-red/10"}`}>
              {formatPct(price.change_percent)}
            </span>
          </div>
        </div>

        {/* OHLC strip */}
        <div className="flex gap-5 text-xs text-muted ml-auto flex-wrap">
          {[
            { label: "Open", val: price.open },
            { label: "High", val: price.high },
            { label: "Low", val: price.low },
            { label: "Prev Close", val: price.prev_close },
          ].map((item) => (
            <div key={item.label} className="text-center">
              <div className="text-muted/40 text-[10px] mb-0.5">{item.label}</div>
              <div className="text-foreground/80 font-medium tabular-nums">{formatPrice(item.val)}</div>
            </div>
          ))}
          <div className="text-center">
            <div className="text-muted/40 text-[10px] mb-0.5">Mkt Cap</div>
            <div className="text-foreground/80 font-medium">{formatLargeNumber(profile.market_cap)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
