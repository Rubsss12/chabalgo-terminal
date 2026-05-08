"use client";

import { useState, useEffect, useCallback } from "react";

import { API_BASE } from "../lib/apiBase";
const ALERTS_KEY = "chabalgo_alerts";

export interface PriceAlert {
  id: string;
  ticker: string;
  type: "above" | "below" | "rsi_above" | "rsi_below";
  threshold: number;
  created_at: number;
  triggered_at?: number;
}

function loadAlerts(): PriceAlert[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ALERTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveAlerts(items: PriceAlert[]) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(ALERTS_KEY, JSON.stringify(items)); } catch {}
  window.dispatchEvent(new Event("alerts-changed"));
}

export function addAlert(alert: Omit<PriceAlert, "id" | "created_at">) {
  const items = loadAlerts();
  items.push({ ...alert, id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, created_at: Date.now() });
  saveAlerts(items);
}

export function removeAlert(id: string) {
  saveAlerts(loadAlerts().filter((a) => a.id !== id));
}

interface AlertsManagerProps {
  ticker: string;
  currentPrice?: number;
}

export default function AlertsManager({ ticker, currentPrice }: AlertsManagerProps) {
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [type, setType] = useState<PriceAlert["type"]>("above");
  const [threshold, setThreshold] = useState("");
  const [notifyPermission, setNotifyPermission] = useState<NotificationPermission>("default");

  const refresh = useCallback(() => {
    setAlerts(loadAlerts().filter((a) => a.ticker === ticker));
  }, [ticker]);

  useEffect(() => {
    refresh();
    if (typeof Notification !== "undefined") setNotifyPermission(Notification.permission);
    const handler = () => refresh();
    window.addEventListener("alerts-changed", handler);
    return () => window.removeEventListener("alerts-changed", handler);
  }, [refresh]);

  const requestPermission = async () => {
    if (typeof Notification === "undefined") return;
    const result = await Notification.requestPermission();
    setNotifyPermission(result);
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(threshold);
    if (isNaN(num) || num <= 0) return;
    addAlert({ ticker, type, threshold: num });
    setThreshold("");
    if (notifyPermission === "default") requestPermission();
  };

  const fmt = (a: PriceAlert) => {
    if (a.type === "above") return `Price > $${a.threshold}`;
    if (a.type === "below") return `Price < $${a.threshold}`;
    if (a.type === "rsi_above") return `RSI > ${a.threshold}`;
    return `RSI < ${a.threshold}`;
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
          alerts.length > 0
            ? "bg-yellow/15 text-yellow border border-yellow/30"
            : "bg-card border border-border text-muted hover:border-accent/30 hover:text-accent"
        }`}
        title="Price alerts"
      >
        <svg className="w-4 h-4" fill={alerts.length > 0 ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {alerts.length > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-accent text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {alerts.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-card border border-border rounded-xl shadow-2xl shadow-black/20 z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <span className="text-xs font-bold tracking-wider text-foreground">PRICE ALERTS</span>
            <button onClick={() => setOpen(false)} className="text-muted hover:text-foreground">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Add form */}
          <form onSubmit={handleAdd} className="px-4 py-3 border-b border-border space-y-2">
            <div className="flex items-center gap-2">
              <select
                value={type}
                onChange={(e) => setType(e.target.value as PriceAlert["type"])}
                className="bg-subtle border border-border rounded-lg px-2 py-1.5 text-xs flex-1 outline-none"
              >
                <option value="above">Price above</option>
                <option value="below">Price below</option>
                <option value="rsi_above">RSI above</option>
                <option value="rsi_below">RSI below</option>
              </select>
              <input
                type="number"
                step="any"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                placeholder={type.startsWith("rsi") ? "70" : currentPrice ? `${currentPrice * 1.1}` : "100"}
                className="bg-subtle border border-border rounded-lg px-2 py-1.5 text-xs w-20 outline-none focus:border-accent/40"
              />
            </div>
            <button type="submit" className="w-full text-xs font-bold py-1.5 rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors">
              Set Alert
            </button>
          </form>

          {/* Permission */}
          {notifyPermission === "default" && (
            <div className="px-4 py-2 bg-yellow/5 border-b border-yellow/15 text-[10px] text-yellow/80 flex items-center justify-between">
              <span>Enable notifications?</span>
              <button onClick={requestPermission} className="text-yellow font-bold hover:underline">Allow</button>
            </div>
          )}

          {/* List */}
          <div className="max-h-60 overflow-y-auto">
            {alerts.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-muted/50">No alerts set for {ticker}</div>
            ) : (
              alerts.map((a) => (
                <div key={a.id} className="px-4 py-2.5 border-b border-border/40 flex items-center justify-between">
                  <span className="text-xs text-foreground">{fmt(a)}</span>
                  <button onClick={() => removeAlert(a.id)} className="text-muted/60 hover:text-red">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Background watcher — runs anywhere in the app
export function AlertWatcher() {
  useEffect(() => {
    const tick = async () => {
      const alerts = loadAlerts().filter((a) => !a.triggered_at);
      if (alerts.length === 0) return;
      const tickers = [...new Set(alerts.map((a) => a.ticker))];
      try {
        const r = await fetch(`${API_BASE}/quotes/batch?symbols=${tickers.join(",")}`);
        if (!r.ok) return;
        const d = await r.json();
        const quoteMap: Record<string, { price: number }> = {};
        (d.quotes || []).forEach((q: { ticker: string; price: number }) => { quoteMap[q.ticker] = q; });

        let changed = false;
        const all = loadAlerts();
        for (const alert of all) {
          if (alert.triggered_at) continue;
          const q = quoteMap[alert.ticker];
          if (!q) continue;
          let triggered = false;
          if (alert.type === "above" && q.price > alert.threshold) triggered = true;
          else if (alert.type === "below" && q.price < alert.threshold) triggered = true;
          // RSI alerts would need a separate fetch — skip for now
          if (triggered) {
            alert.triggered_at = Date.now();
            changed = true;
            // Browser notification
            if (typeof Notification !== "undefined" && Notification.permission === "granted") {
              new Notification(`${alert.ticker} price alert`, {
                body: `${alert.type === "above" ? "Above" : "Below"} $${alert.threshold} — now $${q.price.toFixed(2)}`,
                icon: "/favicon.ico",
              });
            }
          }
        }
        if (changed) saveAlerts(all);
      } catch {}
    };
    tick();
    const interval = setInterval(tick, 60_000);
    return () => clearInterval(interval);
  }, []);
  return null;
}
