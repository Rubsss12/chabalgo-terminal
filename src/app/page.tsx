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
import SectorHeatmap from "@/components/SectorHeatmap";
import FearGreedIndex from "@/components/FearGreedIndex";
import InsiderScreener from "@/components/InsiderScreener";
import DailyBriefing from "@/components/DailyBriefing";
import CollapsibleSection from "@/components/CollapsibleSection";
import Portfolio from "@/components/Portfolio";
import FairValue from "@/components/FairValue";
import SwotAnalysis from "@/components/SwotAnalysis";
import FinancialStatements from "@/components/FinancialStatements";
import StockComparison from "@/components/StockComparison";
import { AnalysisData } from "@/lib/types";
import { fetchAnalysis } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type LandingTab = "market" | "screeners" | "invest";

interface MiniIndex {
  name: string;
  price: number;
  change: number;
}

export default function Home() {
  const [data, setData] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [landingTab, setLandingTab] = useState<LandingTab>("market");
  const [indices, setIndices] = useState<MiniIndex[]>([]);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentTickerRef = useRef<string | null>(null);

  // Fetch mini indices for the ticker strip
  useEffect(() => {
    fetch(`${API_BASE}/daily-briefing`)
      .then((r) => r.json())
      .then((d) => {
        const idxSection = d.sections?.find((s: { type: string }) => s.type === "indices");
        if (idxSection?.data) {
          const arr: MiniIndex[] = Object.entries(idxSection.data as Record<string, { price: number; change_pct: number }>).map(
            ([name, v]) => ({ name, price: v.price, change: v.change_pct })
          );
          setIndices(arr);
        }
      })
      .catch(() => {});
  }, []);

  const silentRefresh = useCallback(async () => {
    const ticker = currentTickerRef.current;
    if (!ticker) return;
    try {
      const result = await fetchAnalysis(ticker);
      setData(result);
      setLastRefresh(new Date());
    } catch {
      // Silent fail
    }
  }, []);

  useEffect(() => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }
    if (data && currentTickerRef.current) {
      refreshIntervalRef.current = setInterval(silentRefresh, 60_000);
    }
    return () => {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
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
      window.scrollTo({ top: 0, behavior: "smooth" });
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

  const isMarketOpen = () => {
    const now = new Date();
    const ny = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
    const h = ny.getHours();
    const m = ny.getMinutes();
    const day = ny.getDay();
    if (day === 0 || day === 6) return false;
    const mins = h * 60 + m;
    return mins >= 570 && mins <= 960; // 9:30 - 16:00
  };

  return (
    <div className="min-h-screen bg-background">
      {/* ===== HEADER ===== */}
      <div className="sticky top-0 z-40 bg-card/98 backdrop-blur-md border-b border-border">
        {/* Top bar */}
        <div className="px-6 py-2.5 flex items-center justify-between">
          <button onClick={handleClose} className="flex items-center gap-2.5 group">
            <div className="w-7 h-7 bg-accent/10 flex items-center justify-center group-hover:bg-accent/20 transition-colors rounded-sm">
              <span className="text-accent text-xs font-bold">CA</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-accent text-[13px] font-semibold tracking-[0.2em] uppercase">ChabAlgo</span>
              <span className="text-muted/40 text-[10px] tracking-wider">Terminal</span>
            </div>
          </button>

          <div className="flex items-center gap-4">
            {lastRefresh && data && (
              <div className="flex items-center gap-1.5 text-[10px] text-muted bg-green/5 border border-green/20 px-2 py-0.5 rounded-sm">
                <span className="w-1.5 h-1.5 bg-green rounded-full animate-pulse" />
                <span className="text-green/80">LIVE</span>
                <span className="text-muted/40">|</span>
                <span>{lastRefresh.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 text-[10px]">
              <span className={`w-1.5 h-1.5 rounded-full ${isMarketOpen() ? "bg-green" : "bg-red/50"}`} />
              <span className="text-muted/60">{isMarketOpen() ? "MARKET OPEN" : "MARKET CLOSED"}</span>
            </div>
            <div className="text-muted/50 text-[11px] tracking-wide hidden sm:block">
              {new Date().toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
            </div>
          </div>
        </div>

        {/* Index ticker strip */}
        {indices.length > 0 && (
          <div className="border-t border-border/50 overflow-hidden">
            <div className="flex items-center gap-6 px-6 py-1.5 ticker-scroll" style={{ width: "max-content" }}>
              {[...indices, ...indices].map((idx, i) => (
                <div key={`${idx.name}-${i}`} className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[10px] text-muted/60 font-medium">{idx.name}</span>
                  <span className="text-[10px] text-foreground font-medium">
                    {idx.name === "VIX" ? idx.price.toFixed(1) : idx.price.toLocaleString()}
                  </span>
                  <span className={`text-[10px] font-semibold ${idx.change >= 0 ? "text-green" : "text-red"}`}>
                    {idx.change >= 0 ? "+" : ""}{idx.change}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ===== SEARCH BAR ===== */}
      <div className="px-6 pt-5 pb-4">
        <div className="flex items-start gap-3 max-w-4xl mx-auto">
          <div className="flex-1">
            <SearchBar onSearch={handleSearch} loading={loading} />
          </div>
          <Rankings onSelectTicker={handleSearch} />
        </div>
      </div>

      {/* ===== LOADING ===== */}
      {loading && !data && (
        <div className="px-6 max-w-6xl mx-auto">
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-10 h-10 border-2 border-accent/20 border-t-accent rounded-full animate-spin mb-4" />
            <div className="text-accent text-xs tracking-widest animate-pulse">ANALYZING</div>
            <div className="text-muted text-[11px] mt-1">Fetching data from multiple sources...</div>
          </div>
        </div>
      )}

      {/* ===== ERROR ===== */}
      {error && (
        <div className="px-6 max-w-4xl mx-auto">
          <div className="border border-red/30 bg-red/5 p-4 flex items-start gap-3 rounded-sm">
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

      {/* ========================================= */}
      {/* STOCK ANALYSIS VIEW                       */}
      {/* ========================================= */}
      {data && (
        <div className="px-6 pb-10 max-w-6xl mx-auto space-y-4">
          {/* Nav */}
          <div className="flex items-center justify-between bg-card border border-border px-4 py-2 rounded-sm">
            <button
              onClick={handleClose}
              className="flex items-center gap-2 text-muted hover:text-accent transition-colors text-[11px] tracking-wider group"
            >
              <svg className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              DASHBOARD
            </button>
            <div className="flex items-center gap-3">
              <span className="text-accent text-xs font-semibold tracking-wide">{data.ticker}</span>
              <span className="text-muted/20">|</span>
              <button onClick={handleClose} className="text-muted hover:text-red transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <Header data={data} />

          {/* Verdicts row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Verdict ticker={data.ticker} />
            <ShortTermVerdict ticker={data.ticker} />
            <SixMonthVision ticker={data.ticker} />
          </div>

          <NewsPanel ticker={data.ticker} />

          {/* --- VALUATION --- */}
          <SectionDivider label="VALUATION" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FairValue ticker={data.ticker} />
            <SwotAnalysis ticker={data.ticker} />
          </div>

          {/* --- ANALYSIS --- */}
          <SectionDivider label="ANALYSIS" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Fundamentals data={data} />
            <Technicals data={data} />
          </div>

          <FinancialStatements ticker={data.ticker} />

          <Charts data={data.historical} ticker={data.ticker} />

          {/* --- ACTIVITY --- */}
          <SectionDivider label="ACTIVITY" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <EarningsPanel ticker={data.ticker} />
            <InsiderTransactions ticker={data.ticker} />
          </div>

          <PeerComparison ticker={data.ticker} />

          <CollapsibleSection title="Options Flow" badge="SMART MONEY" defaultOpen={false}>
            <OptionsFlow ticker={data.ticker} />
          </CollapsibleSection>

          {/* --- COMPARE --- */}
          <SectionDivider label="COMPARE" />

          <StockComparison initialTicker={data.ticker} onSearch={handleSearch} />

          {/* --- EXPLORE --- */}
          <SectionDivider label="EXPLORE" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CollapsibleSection title="Calendrier Macro" badge="MACRO" defaultOpen={false}>
              <EconomicCalendar />
            </CollapsibleSection>
            <CollapsibleSection title="Sector Heatmap" badge="FLOW" defaultOpen={false}>
              <SectorHeatmap onSearch={handleSearch} />
            </CollapsibleSection>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CollapsibleSection title="Congress Trades" defaultOpen={false}>
              <CongressTrades ticker={data.ticker} onSelectTicker={handleSearch} />
            </CollapsibleSection>
            <CollapsibleSection title="Insider Screener" badge="SMART MONEY" defaultOpen={false}>
              <InsiderScreener onSearch={handleSearch} />
            </CollapsibleSection>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CollapsibleSection title="Compounder Screener" badge="INSTITUTIONAL" defaultOpen={false}>
              <Screener onSelectTicker={handleSearch} />
            </CollapsibleSection>
            <CollapsibleSection title="IPO Watchlist" badge="2026-27" defaultOpen={false}>
              <IPOWatchlist onSelectTicker={handleSearch} />
            </CollapsibleSection>
          </div>

          {/* --- INVESTISSEMENT --- */}
          <SectionDivider label="INVESTISSEMENT" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CollapsibleSection title="Top ETFs Indiciels" badge="CTO & PEA" defaultOpen={false}>
              <ETFTracker />
            </CollapsibleSection>
            <CollapsibleSection title="Simulateur Composés" defaultOpen={false}>
              <CompoundSimulator />
            </CollapsibleSection>
          </div>

          {/* Back to top */}
          <div className="flex justify-center pt-6 pb-2">
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="flex items-center gap-1.5 text-muted hover:text-accent transition-colors text-[10px] tracking-wider group"
            >
              <svg className="w-3 h-3 group-hover:-translate-y-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
              BACK TO TOP
            </button>
          </div>
        </div>
      )}

      {/* ========================================= */}
      {/* LANDING DASHBOARD                         */}
      {/* ========================================= */}
      {!data && !loading && !error && (
        <div className="max-w-7xl mx-auto px-6 pb-10">
          {/* Tab navigation */}
          <div className="flex items-center border-b border-border mb-0">
            {([
              { key: "market" as LandingTab, label: "MARKET", icon: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" },
              { key: "screeners" as LandingTab, label: "SCREENERS", icon: "M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" },
              { key: "invest" as LandingTab, label: "INVESTIR", icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
            ]).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setLandingTab(tab.key)}
                className={`flex items-center gap-2 px-5 py-3 text-[11px] tracking-[0.12em] font-medium transition-all border-b-2 -mb-px ${
                  landingTab === tab.key
                    ? "text-accent border-accent"
                    : "text-muted/50 border-transparent hover:text-muted hover:border-border"
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
                </svg>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="pt-5 tab-content-enter" key={landingTab}>

            {/* ===== MARKET TAB ===== */}
            {landingTab === "market" && (
              <div className="space-y-5">
                {/* Daily Briefing */}
                <DailyBriefing onSearch={handleSearch} />

                {/* Fear/Greed + Heatmap */}
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                  <div className="lg:col-span-2">
                    <FearGreedIndex />
                  </div>
                  <div className="lg:col-span-3">
                    <SectorHeatmap onSearch={handleSearch} />
                  </div>
                </div>

                {/* Calendar */}
                <EconomicCalendar />
              </div>
            )}

            {/* ===== SCREENERS TAB ===== */}
            {landingTab === "screeners" && (
              <div className="space-y-5">
                {/* Quick cards row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: "Options Flow", desc: "Unusual activity scanner", color: "text-red", bg: "bg-red/5 border-red/15" },
                    { label: "Insider Buys", desc: "Smart money tracker", color: "text-green", bg: "bg-green/5 border-green/15" },
                    { label: "IPO Watch", desc: "2026-2027 upcoming", color: "text-accent", bg: "bg-accent/5 border-accent/15" },
                    { label: "Congress", desc: "Political trades", color: "text-yellow", bg: "bg-yellow/5 border-yellow/15" },
                  ].map((card) => (
                    <div key={card.label} className={`border p-3 ${card.bg} rounded-sm`}>
                      <div className={`text-[11px] font-semibold tracking-wider ${card.color}`}>{card.label}</div>
                      <div className="text-[9px] text-muted/60 mt-0.5">{card.desc}</div>
                    </div>
                  ))}
                </div>

                {/* Options + Insiders */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <OptionsFlow onSearch={handleSearch} />
                  <InsiderScreener onSearch={handleSearch} />
                </div>

                {/* IPO + Compounder */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <IPOWatchlist onSelectTicker={handleSearch} />
                  <Screener onSelectTicker={handleSearch} />
                </div>

                {/* Congress */}
                <CongressTrades onSelectTicker={handleSearch} />
              </div>
            )}

            {/* ===== INVEST TAB ===== */}
            {landingTab === "invest" && (
              <div className="space-y-5">
                <ETFTracker />
                <CompoundSimulator />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Portfolio sidebar */}
      <Portfolio />
    </div>
  );
}

/* Section divider component */
function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 pt-3 pb-1">
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
      <span className="text-muted/40 text-[9px] tracking-[0.25em] font-medium">{label}</span>
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
    </div>
  );
}
