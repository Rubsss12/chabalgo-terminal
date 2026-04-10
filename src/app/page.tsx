"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import SearchBar from "@/components/SearchBar";
import Rankings from "@/components/Rankings";
import Header from "@/components/Header";
import Fundamentals from "@/components/Fundamentals";
import Technicals from "@/components/Technicals";
import Charts from "@/components/Charts";
import Verdict from "@/components/Verdict";
import ShortTermVerdict from "@/components/ShortTermVerdict";
import EarningsPanel from "@/components/EarningsPanel";
import InsiderTransactions from "@/components/InsiderTransactions";
import PeerComparison from "@/components/PeerComparison";
import NewsPanel from "@/components/NewsPanel";
import SixMonthVision from "@/components/SixMonthVision";
import CongressTrades from "@/components/CongressTrades";
import Screener from "@/components/Screener";
import ETFTracker from "@/components/ETFTracker";
import CompoundSimulator from "@/components/CompoundSimulator";
import IPOWatchlist from "@/components/IPOWatchlist";
import OptionsFlow from "@/components/OptionsFlow";
import EconomicCalendar from "@/components/EconomicCalendar";
import CollapsibleSection from "@/components/CollapsibleSection";
import Portfolio from "@/components/Portfolio";
import { AnalysisData } from "@/lib/types";
import { fetchAnalysis } from "@/lib/api";

export default function Home() {
  const [data, setData] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentTickerRef = useRef<string | null>(null);

  // Silent background refresh - updates data without showing loading state
  const silentRefresh = useCallback(async () => {
    const ticker = currentTickerRef.current;
    if (!ticker) return;
    try {
      const result = await fetchAnalysis(ticker);
      setData(result);
      setLastRefresh(new Date());
    } catch {
      // Silent fail on auto-refresh - don't disrupt the UI
    }
  }, []);

  // Set up auto-refresh interval when a stock is loaded
  useEffect(() => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }
    if (data && currentTickerRef.current) {
      // Refresh every 60 seconds
      refreshIntervalRef.current = setInterval(silentRefresh, 60_000);
    }
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [data, silentRefresh]);

  const handleSearch = async (ticker: string) => {
    setError("");
    setLoading(true);
    setData(null);
    currentTickerRef.current = ticker;
    try {
      const result = await fetchAnalysis(ticker);
      setData(result);
      setLastRefresh(new Date());
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      currentTickerRef.current = null;
    }
    setLoading(false);
  };

  const handleClose = () => {
    setData(null);
    setError("");
    setLastRefresh(null);
    currentTickerRef.current = null;
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header bar */}
      <div className="sticky top-0 z-40 border-b border-border px-6 py-3.5 flex items-center justify-between bg-card/95 backdrop-blur-sm">
        <button onClick={handleClose} className="flex items-center gap-3 group">
          <div className="w-8 h-8 bg-accent/10 flex items-center justify-center group-hover:bg-accent/20 transition-colors">
            <span className="text-accent text-sm font-bold">CA</span>
          </div>
          <div className="flex flex-col">
            <span className="text-accent text-sm font-semibold tracking-widest uppercase leading-none">ChabAlgo</span>
            <span className="text-muted text-[10px] tracking-wider leading-none mt-0.5">Terminal</span>
          </div>
        </button>
        <div className="flex items-center gap-5">
          {lastRefresh && data && (
            <div className="flex items-center gap-1.5 text-[10px] text-muted bg-green/5 border border-green/20 px-2.5 py-1">
              <span className="w-1.5 h-1.5 bg-green rounded-full animate-pulse" />
              <span className="text-green/80">LIVE</span>
              <span className="text-muted/60">|</span>
              <span>{lastRefresh.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
            </div>
          )}
          <div className="text-muted text-xs tracking-wide hidden sm:block">
            {new Date().toLocaleDateString("en-US", {
              weekday: "short",
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </div>
        </div>
      </div>

      {/* Search + Rankings */}
      <div className="px-6 py-6">
        <div className="flex items-start gap-3 max-w-4xl mx-auto">
          <div className="flex-1">
            <SearchBar onSearch={handleSearch} loading={loading} />
          </div>
          <Rankings onSelectTicker={handleSearch} />
        </div>
      </div>

      {/* Loading state */}
      {loading && !data && (
        <div className="px-6 max-w-6xl mx-auto">
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-10 h-10 border-2 border-accent/20 border-t-accent rounded-full animate-spin mb-4" />
            <div className="text-accent text-xs tracking-widest animate-pulse">ANALYZING</div>
            <div className="text-muted text-[11px] mt-1">Fetching data from multiple sources...</div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="px-6 max-w-4xl mx-auto">
          <div className="border border-red/30 bg-red/5 p-4 flex items-start gap-3">
            <svg className="w-4 h-4 text-red flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <div>
              <div className="text-red text-sm font-medium">Analysis Failed</div>
              <div className="text-red/70 text-xs mt-0.5">{error}</div>
            </div>
          </div>
        </div>
      )}

      {/* Analysis panels */}
      {data && (
        <div className="px-6 pb-10 max-w-6xl mx-auto space-y-4">
          {/* Navigation bar */}
          <div className="flex items-center justify-between bg-card border border-border px-4 py-2.5">
            <button
              onClick={handleClose}
              className="flex items-center gap-2 text-muted hover:text-accent transition-colors text-xs tracking-wider group"
            >
              <svg className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              BACK TO HOME
            </button>
            <div className="flex items-center gap-3">
              <span className="text-muted/40 text-[10px] tracking-wider">VIEWING</span>
              <span className="text-accent text-xs font-semibold tracking-wide">{data.ticker}</span>
              <span className="text-muted/30">|</span>
              <button
                onClick={handleClose}
                className="flex items-center gap-1 text-muted hover:text-red transition-colors text-xs tracking-wider"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                CLOSE
              </button>
            </div>
          </div>

          <Header data={data} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Verdict ticker={data.ticker} />
            <ShortTermVerdict ticker={data.ticker} />
          </div>

          <SixMonthVision ticker={data.ticker} />

          <NewsPanel ticker={data.ticker} />

          {/* Section divider */}
          <div className="flex items-center gap-3 pt-2">
            <div className="h-px flex-1 bg-border" />
            <span className="text-muted/50 text-[10px] tracking-[0.2em]">ANALYSIS</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Fundamentals data={data} />
            <Technicals data={data} />
          </div>

          <Charts data={data.historical} ticker={data.ticker} />

          {/* Section divider */}
          <div className="flex items-center gap-3 pt-2">
            <div className="h-px flex-1 bg-border" />
            <span className="text-muted/50 text-[10px] tracking-[0.2em]">ACTIVITY</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <EarningsPanel ticker={data.ticker} />
            <InsiderTransactions ticker={data.ticker} />
          </div>

          <PeerComparison ticker={data.ticker} />

          <CollapsibleSection title="Options Flow" badge="SMART MONEY" defaultOpen={false}>
            <OptionsFlow ticker={data.ticker} />
          </CollapsibleSection>

          {/* Section divider */}
          <div className="flex items-center gap-3 pt-2">
            <div className="h-px flex-1 bg-border" />
            <span className="text-muted/50 text-[10px] tracking-[0.2em]">EXPLORE</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <CollapsibleSection title="Calendrier Économique" badge="MACRO" defaultOpen={false}>
            <EconomicCalendar />
          </CollapsibleSection>

          <CollapsibleSection title="Congress Insider Trades" defaultOpen={false}>
            <CongressTrades ticker={data.ticker} onSelectTicker={handleSearch} />
          </CollapsibleSection>

          <CollapsibleSection title="Compounder Screener" badge="INSTITUTIONAL" defaultOpen={false}>
            <Screener onSelectTicker={handleSearch} />
          </CollapsibleSection>

          <CollapsibleSection title="IPO Watchlist 2026-2027" badge="MAJOR IPOs" defaultOpen={false}>
            <IPOWatchlist onSelectTicker={handleSearch} />
          </CollapsibleSection>

          {/* Section divider */}
          <div className="flex items-center gap-3 pt-2">
            <div className="h-px flex-1 bg-border" />
            <span className="text-muted/50 text-[10px] tracking-[0.2em]">INVESTISSEMENT</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <CollapsibleSection title="Top ETFs Indiciels" badge="CTO & PEA" defaultOpen={false}>
            <ETFTracker />
          </CollapsibleSection>

          <CollapsibleSection title="Simulateur Intérêts Composés" defaultOpen={false}>
            <CompoundSimulator />
          </CollapsibleSection>

          {/* Back to top */}
          <div className="flex justify-center pt-4 pb-2">
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="flex items-center gap-1.5 text-muted hover:text-accent transition-colors text-[10px] tracking-wider"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
              BACK TO TOP
            </button>
          </div>
        </div>
      )}

      {/* Empty state / Landing page */}
      {!data && !loading && !error && (
        <div>
          <div className="flex flex-col items-center justify-center mt-12 mb-10">
            <div className="w-14 h-14 bg-accent/10 flex items-center justify-center mb-4">
              <span className="text-accent text-xl font-bold tracking-wider">CA</span>
            </div>
            <div className="text-accent text-3xl font-light tracking-[0.3em] uppercase mb-1">
              ChabAlgo
            </div>
            <div className="text-muted text-sm tracking-wider mb-3">
              Institutional-Grade Stock Analysis
            </div>
            <div className="w-20 h-px bg-accent/30 mb-4" />
            <div className="text-muted/60 text-xs tracking-wider">
              Enter a ticker or company name to begin
            </div>
          </div>
          <div className="px-6 max-w-6xl mx-auto space-y-4 pb-10">
            <CollapsibleSection title="Calendrier Économique" badge="MACRO" defaultOpen={true}>
              <EconomicCalendar />
            </CollapsibleSection>
            <CollapsibleSection title="Options Flow Screener" badge="SMART MONEY" defaultOpen={true}>
              <OptionsFlow onSearch={handleSearch} />
            </CollapsibleSection>
            <CollapsibleSection title="IPO Watchlist 2026-2027" badge="MAJOR IPOs" defaultOpen={true}>
              <IPOWatchlist onSelectTicker={handleSearch} />
            </CollapsibleSection>
            <CollapsibleSection title="Top ETFs Indiciels" badge="CTO & PEA" defaultOpen={false}>
              <ETFTracker />
            </CollapsibleSection>
            <CollapsibleSection title="Simulateur Intérêts Composés" defaultOpen={false}>
              <CompoundSimulator />
            </CollapsibleSection>
            <CollapsibleSection title="Compounder Screener" badge="INSTITUTIONAL" defaultOpen={false}>
              <Screener onSelectTicker={handleSearch} />
            </CollapsibleSection>
            <CollapsibleSection title="Congress Insider Trades" defaultOpen={false}>
              <CongressTrades onSelectTicker={handleSearch} />
            </CollapsibleSection>
          </div>
        </div>
      )}

      {/* Portfolio sidebar */}
      <Portfolio />
    </div>
  );
}
