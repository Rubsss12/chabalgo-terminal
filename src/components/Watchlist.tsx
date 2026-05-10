"use client";

import { useState, useEffect, useCallback } from "react";

import { API_BASE } from "../lib/apiBase";
const WATCHLIST_KEY = "chabalgo_watchlist";

interface WatchlistItem {
  ticker: string;
  added_at: number;
  entry_price?: number;  // optional cost-basis
}

interface Quote {
  ticker: string;
  name: string;
  price: number;
  change_pct: number;
  market_cap: number | null;
  currency: string | null;
}

function loadWatchlist(): WatchlistItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(WATCHLIST_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveWatchlist(items: WatchlistItem[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(items));
  } catch {}
}

// External API helpers — usable from anywhere
export function addToWatchlist(ticker: string, entryPrice?: number) {
  const items = loadWatchlist();
  if (items.some((i) => i.ticker === ticker)) return false;
  items.unshift({ ticker, added_at: Date.now(), entry_price: entryPrice });
  saveWatchlist(items);
  // Notify other components
  window.dispatchEvent(new Event("watchlist-changed"));
  return true;
}

export function isWatched(ticker: string): boolean {
  return loadWatchlist().some((i) => i.ticker === ticker);
}

export function removeFromWatchlist(ticker: string) {
  const items = loadWatchlist().filter((i) => i.ticker !== ticker);
  saveWatchlist(items);
  window.dispatchEvent(new Event("watchlist-changed"));
}

export default function Watchlist({ onSelectTicker }: { onSelectTicker?: (t: string) => void }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    const list = loadWatchlist();
    setItems(list);
    if (list.length === 0) {
      setQuotes({});
      return;
    }
    setLoading(true);
    try {
      const symbols = list.map((i) => i.ticker).join(",");
      const r = await fetch(`${API_BASE}/quotes/batch?symbols=${encodeURIComponent(symbols)}`);
      if (r.ok) {
        const d = await r.json();
        const map: Record<string, Quote> = {};
        (d.quotes || []).forEach((q: Quote) => { map[q.ticker] = q; });
        setQuotes(map);
      }
    } catch {}
    setLoading(false);
  }, []);

  // Escape key closes the panel
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Lock body scroll when watchlist is open (prevents background scrolling)
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    }
  }, [open]);

  useEffect(() => {
    refresh();
    const handler = () => refresh();
    window.addEventListener("watchlist-changed", handler);
    window.addEventListener("storage", handler);
    // Auto-refresh every 60s when open
    const interval = setInterval(() => { if (open) refresh(); }, 60_000);
    return () => {
      window.removeEventListener("watchlist-changed", handler);
      window.removeEventListener("storage", handler);
      clearInterval(interval);
    };
  }, [refresh, open]);

  const handleRemove = (ticker: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeFromWatchlist(ticker);
  };

  const totalChange = items.reduce((acc, i) => {
    const q = quotes[i.ticker];
    return q ? acc + q.change_pct : acc;
  }, 0);
  const avgChange = items.length > 0 ? totalChange / items.length : 0;

  return (
    <>
      {/* Floating toggle button on right edge */}
      <button
        onClick={() => setOpen(!open)}
        className={`fixed top-1/2 -translate-y-1/2 right-0 z-40 px-2 py-3 rounded-l-xl bg-card border border-r-0 border-border shadow-lg flex items-center gap-1.5 transition-all hover:bg-accent/5 hover:border-accent/30 ${
          open ? "hidden" : ""
        }`}
        title="Watchlist"
      >
        <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
        <span className="text-[10px] font-bold tracking-wider text-muted hidden sm:inline">WATCH</span>
        {items.length > 0 && (
          <span className="text-[10px] font-bold bg-accent text-white rounded-full w-5 h-5 flex items-center justify-center">{items.length}</span>
        )}
      </button>

      {/* Backdrop — visible on ALL viewports so clicking outside closes */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 bg-black/30 z-[55]"
        />
      )}

      {/* Side panel — full width on mobile, 360px on tablet+. z-[60] sits above sticky nav (z-50) so the close button is always reachable */}
      <div
        className={`fixed top-0 right-0 h-screen w-full sm:w-[360px] bg-card border-l border-border z-[60] transition-transform duration-200 ${
          open ? "translate-x-0" : "translate-x-full"
        } shadow-2xl flex flex-col`}
      >
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-1 h-4 bg-accent rounded-full" />
            <span className="text-xs font-bold tracking-wider text-foreground">WATCHLIST</span>
            {items.length > 0 && <span className="text-[9px] bg-accent/10 text-accent px-2 py-0.5 rounded-md font-bold">{items.length}</span>}
          </div>
          <div className="flex items-center gap-3">
            {items.length > 0 && (
              <span className={`text-xs font-bold tabular-nums ${avgChange >= 0 ? "text-green" : "text-red"}`}>
                {avgChange >= 0 ? "+" : ""}{avgChange.toFixed(2)}%
              </span>
            )}
            <button onClick={() => refresh()} disabled={loading} title="Refresh" className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-accent hover:bg-accent/5 transition-colors">
              <svg className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <button
              onClick={() => setOpen(false)}
              title="Close (Esc)"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-red hover:bg-red/10 transition-colors border border-border"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <div className="p-8 text-center">
              <svg className="w-12 h-12 mx-auto text-muted/30 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
              <div className="text-sm text-muted">Your watchlist is empty.</div>
              <div className="text-[11px] text-muted/50 mt-1">Star any stock to add it here.</div>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {items.map((item) => {
                const q = quotes[item.ticker];
                const change = q?.change_pct;
                const colorClass = change == null ? "text-muted" : change > 0 ? "text-green" : change < 0 ? "text-red" : "text-muted";
                const pnl = item.entry_price && q ? ((q.price - item.entry_price) / item.entry_price) * 100 : null;
                return (
                  <div
                    key={item.ticker}
                    onClick={() => onSelectTicker?.(item.ticker)}
                    className="px-4 py-3 hover:bg-subtle/50 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground text-sm">{item.ticker}</span>
                        {q?.name && <span className="text-[10px] text-muted truncate max-w-[140px]">{q.name}</span>}
                      </div>
                      <button
                        onClick={(e) => handleRemove(item.ticker, e)}
                        className="opacity-0 group-hover:opacity-100 text-muted/50 hover:text-red transition-all"
                        title="Remove"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-foreground font-semibold tabular-nums text-sm">
                        {q ? (q.currency === "USD" || !q.currency ? "$" : "") + q.price.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—"}
                      </span>
                      <span className={`text-xs font-bold tabular-nums ${colorClass}`}>
                        {change != null ? `${change > 0 ? "+" : ""}${change.toFixed(2)}%` : "—"}
                      </span>
                    </div>
                    {pnl != null && (
                      <div className="text-[10px] text-muted/60 mt-0.5">
                        Entry ${item.entry_price?.toFixed(2)} · PnL{" "}
                        <span className={pnl >= 0 ? "text-green" : "text-red"}>
                          {pnl >= 0 ? "+" : ""}{pnl.toFixed(2)}%
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="px-4 py-2 border-t border-border text-[10px] text-muted/40 text-center">
            Updates every 60s · localStorage
          </div>
        )}
      </div>
    </>
  );
}
