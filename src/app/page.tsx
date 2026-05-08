"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import SearchBar from "@/components/SearchBar";
import Rankings from "@/components/Rankings";
import CollapsibleSection from "@/components/CollapsibleSection";
import { AnalysisData } from "@/lib/types";
import { fetchAnalysis } from "@/lib/api";

/* ─── Skeleton loader for lazy components ─── */
function LazyFallback() {
  return (
    <div className="bg-card border border-border rounded-xl p-8 flex items-center justify-center min-h-[120px]">
      <div className="flex flex-col items-center gap-2">
        <div className="w-8 h-8 border-2 border-accent/20 border-t-accent rounded-full animate-spin" />
        <span className="text-xs text-muted">Loading...</span>
      </div>
    </div>
  );
}

/* ─── Eagerly loaded: only what's visible on first paint ─── */
/* SearchBar + Rankings already imported above (nav bar) */

/* ─── Lazy loaded: everything else splits into separate chunks ─── */
const Header = dynamic(() => import("@/components/Header"), { ssr: false });
const Fundamentals = dynamic(() => import("@/components/Fundamentals"), { ssr: false });
const Technicals = dynamic(() => import("@/components/Technicals"), { ssr: false });
const Charts = dynamic(() => import("@/components/Charts"), { ssr: false });
const Verdict = dynamic(() => import("@/components/Verdict"), { ssr: false });
const ShortTermVerdict = dynamic(() => import("@/components/ShortTermVerdict"), { ssr: false });
const EarningsPanel = dynamic(() => import("@/components/EarningsPanel"), { ssr: false });
const InsiderTransactions = dynamic(() => import("@/components/InsiderTransactions"), { ssr: false });
const PeerComparison = dynamic(() => import("@/components/PeerComparison"), { ssr: false });
const NewsPanel = dynamic(() => import("@/components/NewsPanel"), { ssr: false });
const SixMonthVision = dynamic(() => import("@/components/SixMonthVision"), { ssr: false });
const CongressTrades = dynamic(() => import("@/components/CongressTrades"), { ssr: false });
const Screener = dynamic(() => import("@/components/Screener"), { ssr: false });
const ETFTracker = dynamic(() => import("@/components/ETFTracker"), { ssr: false });
const CompoundSimulator = dynamic(() => import("@/components/CompoundSimulator"), { ssr: false });
const IPOWatchlist = dynamic(() => import("@/components/IPOWatchlist"), { ssr: false });
const OptionsFlow = dynamic(() => import("@/components/OptionsFlow"), { ssr: false });
const EconomicCalendar = dynamic(() => import("@/components/EconomicCalendar"), { ssr: false });
const SectorHeatmap = dynamic(() => import("@/components/SectorHeatmap"), { ssr: false });
const FearGreedIndex = dynamic(() => import("@/components/FearGreedIndex"), { ssr: false });
const InsiderScreener = dynamic(() => import("@/components/InsiderScreener"), { ssr: false });
const DailyBriefing = dynamic(() => import("@/components/DailyBriefing"), { ssr: false });
const Portfolio = dynamic(() => import("@/components/Portfolio"), { ssr: false });
const FairValue = dynamic(() => import("@/components/FairValue"), { ssr: false });
const SwotAnalysis = dynamic(() => import("@/components/SwotAnalysis"), { ssr: false });
const FinancialStatements = dynamic(() => import("@/components/FinancialStatements"), { ssr: false });
const StockComparison = dynamic(() => import("@/components/StockComparison"), { ssr: false });
const SectorDeepDive = dynamic(() => import("@/components/SectorDeepDive"), { ssr: false });
const MacroDashboard = dynamic(() => import("@/components/MacroDashboard"), { ssr: false });
const SECFilings = dynamic(() => import("@/components/SECFilings"), { ssr: false });
const DCFValuation = dynamic(() => import("@/components/DCFValuation"), { ssr: false });
const CryptoMarkets = dynamic(() => import("@/components/CryptoMarkets"), { ssr: false });
const CryptoAnalysis = dynamic(() => import("@/components/CryptoAnalysis"), { ssr: false });
const RedditTracker = dynamic(() => import("@/components/RedditTracker"), { ssr: false });
const GlobalMarkets = dynamic(() => import("@/components/GlobalMarkets"), { ssr: false });
const Watchlist = dynamic(() => import("@/components/Watchlist"), { ssr: false });
const WatchButton = dynamic(() => import("@/components/WatchButton"), { ssr: false });
const ProChart = dynamic(() => import("@/components/ProChart"), { ssr: false });
const InvestorTracker = dynamic(() => import("@/components/InvestorTracker"), { ssr: false });
const CompareChart = dynamic(() => import("@/components/CompareChart"), { ssr: false });
const MorningBrief = dynamic(() => import("@/components/MorningBrief"), { ssr: false });
const ThemeToggle = dynamic(() => import("@/components/ThemeToggle"), { ssr: false });
const AlertsManager = dynamic(() => import("@/components/PriceAlerts"), { ssr: false });
const AlertWatcher = dynamic(() => import("@/components/PriceAlerts").then((m) => m.AlertWatcher), { ssr: false });

import { API_BASE } from "../lib/apiBase";

type LandingTab = "sectors" | "overview" | "crypto" | "screeners" | "invest";

interface MiniIndex {
  name: string;
  price: number;
  change: number;
}

/* ─── SECTOR DATA ─── */
const FEATURED_SECTORS = [
  { key: "photonics-optical", name: "Photonics & Optical", tagline: "The invisible backbone of AI", gradient: "from-blue-500/8 via-cyan-500/5 to-transparent", ring: "ring-blue-500/15", accent: "text-blue-600", badge: "HOT", badgeColor: "bg-red-500/90", stocks: "COHR  AAOI  LITE  CIEN", desc: "800G/1.6T transceivers, optical datacenter supply chain" },
  { key: "ai-infrastructure", name: "AI Infrastructure", tagline: "The biggest CapEx cycle in history", gradient: "from-purple-500/8 via-violet-500/5 to-transparent", ring: "ring-purple-500/15", accent: "text-purple-600", badge: "MEGA", badgeColor: "bg-violet-500/90", stocks: "SMCI  PATH  AI  SOUN", desc: "$200B+ hyperscaler spend, GPU clusters, AI software" },
  { key: "space-defense-tech", name: "Space & Defense Tech", tagline: "NewSpace 2.0 goes commercial", gradient: "from-slate-500/8 via-zinc-500/5 to-transparent", ring: "ring-slate-500/15", accent: "text-slate-600", badge: "GROWTH", badgeColor: "bg-accent/90", stocks: "RKLB  ASTS  LUNR  PL", desc: "Launchers, LEO constellations, satellite imaging" },
];

const OTHER_SECTORS = [
  { key: "cybersecurity-ai", name: "Cybersecurity AI", icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z", desc: "Zero-trust platforms, AI defense", stocks: "CRWD  ZS  S  RBRK" },
  { key: "robotics-automation", name: "Robotics & Automation", icon: "M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z", desc: "Surgical robots, eVTOL, industrial automation", stocks: "ISRG  JOBY  ACHR  TER" },
  { key: "synthetic-biology-genomics", name: "Synthetic Biology", icon: "M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z", desc: "CRISPR, gene therapy, AI drug discovery", stocks: "CRSP  BEAM  TXG  RXRX" },
  { key: "fintech-infrastructure", name: "Fintech Infrastructure", icon: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z", desc: "Neobanks, BNPL, embedded payments", stocks: "SOFI  AFRM  HOOD  BILL" },
  { key: "clean-energy-grid", name: "Clean Energy & Grid", icon: "M13 10V3L4 14h7v7l9-11h-7z", desc: "Solar, battery storage, EV charging", stocks: "ENPH  RUN  QS  CHPT" },
  { key: "edge-computing-iot", name: "Edge Computing & IoT", icon: "M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01", desc: "Edge AI, CDN, industrial IoT, 5G MEC", stocks: "NET  PSTG  UI  ESTC" },
];

export default function Home() {
  const [data, setData] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [landingTab, setLandingTab] = useState<LandingTab>("sectors");
  const [deepDiveSector, setDeepDiveSector] = useState<string | null>(null);
  const [indices, setIndices] = useState<MiniIndex[]>([]);
  const [cryptoCoinId, setCryptoCoinId] = useState<string | null>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentTickerRef = useRef<string | null>(null);

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

  // Read URL params on mount → auto-load stock or crypto
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const t = params.get("t");
    const c = params.get("c");
    const tab = params.get("tab") as LandingTab | null;
    if (t) {
      handleSearch(t.toUpperCase());
    } else if (c) {
      setLandingTab("crypto");
      setCryptoCoinId(c);
    } else if (tab && ["sectors", "overview", "crypto", "screeners", "invest"].includes(tab)) {
      setLandingTab(tab);
    }
    // Listen for back/forward
    const onPop = () => {
      const p = new URLSearchParams(window.location.search);
      const tt = p.get("t");
      const cc = p.get("c");
      if (tt) handleSearch(tt.toUpperCase());
      else { setData(null); currentTickerRef.current = null; }
      if (cc) { setLandingTab("crypto"); setCryptoCoinId(cc); }
      else setCryptoCoinId(null);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync URL when stock/crypto changes
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams();
    if (data) params.set("t", data.ticker);
    else if (cryptoCoinId) params.set("c", cryptoCoinId);
    else if (landingTab !== "sectors") params.set("tab", landingTab);
    const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname;
    if (window.location.search !== `?${params.toString()}` && window.location.pathname + window.location.search !== newUrl) {
      window.history.replaceState({}, "", newUrl);
    }
  }, [data, cryptoCoinId, landingTab]);

  const silentRefresh = useCallback(async () => {
    const ticker = currentTickerRef.current;
    if (!ticker) return;
    try {
      const result = await fetchAnalysis(ticker);
      setData(result);
      setLastRefresh(new Date());
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
    refreshIntervalRef.current = null;
    if (data && currentTickerRef.current) {
      refreshIntervalRef.current = setInterval(silentRefresh, 60_000);
    }
    return () => { if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current); };
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
      setError(err instanceof Error ? err.message : "Unknown error");
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
    const h = ny.getHours(), m = ny.getMinutes(), day = ny.getDay();
    if (day === 0 || day === 6) return false;
    const mins = h * 60 + m;
    return mins >= 570 && mins <= 960;
  };

  const TABS: { key: LandingTab; label: string; icon: string }[] = [
    { key: "sectors", label: "Sectors", icon: "M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" },
    { key: "overview", label: "Overview", icon: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" },
    { key: "crypto", label: "Crypto", icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 10v1m6-6a6 6 0 11-12 0 6 6 0 0112 0z" },
    { key: "screeners", label: "Screeners", icon: "M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" },
    { key: "invest", label: "Invest", icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  ];

  return (
    <div className="min-h-screen bg-background grid-pattern">

      {/* ═══════════════════════════════════════════ */}
      {/* TOP NAV BAR                                 */}
      {/* ═══════════════════════════════════════════ */}
      <nav className="sticky top-0 z-50 glass border-b border-border">
        <div className="max-w-[1440px] mx-auto px-6 h-14 flex items-center justify-between">
          {/* Logo */}
          <button onClick={handleClose} className="flex items-center gap-3 group">
            <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center group-hover:bg-accent/20 group-hover:border-accent/30 transition-all">
              <span className="text-accent font-bold text-sm">C</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-foreground text-[15px] font-semibold tracking-tight">ChabAlgo</span>
              <span className="text-muted text-[11px] font-medium">Terminal</span>
            </div>
          </button>

          {/* Center search — visible everywhere */}
          <div className="hidden md:block flex-1 max-w-lg mx-8">
            <SearchBar onSearch={handleSearch} loading={loading} />
          </div>

          {/* Right side */}
          <div className="flex items-center gap-5">
            {lastRefresh && data && (
              <div className="flex items-center gap-2 text-xs text-muted bg-green/5 border border-green/15 px-3 py-1.5 rounded-lg">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green opacity-50"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green"></span>
                </span>
                <span className="text-green font-medium">LIVE</span>
                <span className="text-border-light">|</span>
                <span className="tabular-nums">{lastRefresh.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-xs">
              <span className={`w-2 h-2 rounded-full ${isMarketOpen() ? "bg-green shadow-[0_0_6px_rgba(45,139,78,0.4)]" : "bg-red/40"}`} />
              <span className="text-muted font-medium">{isMarketOpen() ? "Market Open" : "Market Closed"}</span>
            </div>
            <div className="hidden sm:block text-muted text-xs tabular-nums">
              {new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
            </div>
            <ThemeToggle />
            <Rankings onSelectTicker={handleSearch} />
          </div>
        </div>

        {/* Ticker strip */}
        {indices.length > 0 && (
          <div className="border-t border-border/60 overflow-hidden bg-background/40">
            <div className="flex items-center gap-8 px-6 py-1.5 ticker-scroll" style={{ width: "max-content" }}>
              {[...indices, ...indices].map((idx, i) => (
                <div key={`${idx.name}-${i}`} className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[11px] text-muted font-medium">{idx.name}</span>
                  <span className="text-[11px] text-foreground font-semibold tabular-nums">
                    {idx.name === "VIX" ? idx.price.toFixed(1) : idx.price.toLocaleString()}
                  </span>
                  <span className={`text-[11px] font-bold tabular-nums ${idx.change >= 0 ? "text-green" : "text-red"}`}>
                    {idx.change >= 0 ? "+" : ""}{idx.change}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* ═══════════════════════════════════════════ */}
      {/* LOADING STATE                               */}
      {/* ═══════════════════════════════════════════ */}
      {loading && !data && (
        <div className="flex flex-col items-center justify-center py-32 fade-in">
          <div className="relative">
            <div className="w-14 h-14 rounded-full border-2 border-accent/20 border-t-accent animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-accent text-xs font-bold">CA</span>
            </div>
          </div>
          <div className="mt-6 text-accent text-sm font-semibold tracking-widest">ANALYZING</div>
          <div className="text-muted text-xs mt-1">Aggregating data from 6 sources...</div>
        </div>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* ERROR STATE                                 */}
      {/* ═══════════════════════════════════════════ */}
      {error && (
        <div className="max-w-xl mx-auto px-6 pt-12">
          <div className="border border-red/20 bg-red/5 rounded-xl p-5 flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-red/10 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            </div>
            <div>
              <div className="text-red text-sm font-semibold">Analysis Failed</div>
              <div className="text-red/60 text-xs mt-1">{error}</div>
              <button onClick={() => setError("")} className="mt-3 text-xs text-muted hover:text-foreground transition-colors">Dismiss</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* STOCK ANALYSIS VIEW                         */}
      {/* ═══════════════════════════════════════════ */}
      {data && (
        <div className="max-w-[1280px] mx-auto px-6 pb-16 pt-6 space-y-5 fade-in">
          {/* Breadcrumb nav */}
          <div className="flex items-center justify-between">
            <button onClick={handleClose} className="flex items-center gap-2 text-muted hover:text-accent transition-colors text-sm group">
              <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Dashboard
            </button>
            <div className="flex items-center gap-3">
              <span className="text-accent text-sm font-bold tracking-wide">{data.ticker}</span>
              <WatchButton ticker={data.ticker} entryPrice={data.price?.price} size="sm" />
              <AlertsManager ticker={data.ticker} currentPrice={data.price?.price} />
              <button
                onClick={() => navigator.clipboard?.writeText(window.location.href)}
                className="w-8 h-8 rounded-lg hover:bg-card border border-transparent hover:border-border flex items-center justify-center text-muted hover:text-accent transition-all"
                title="Copy share link"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </button>
              <button onClick={handleClose} className="w-8 h-8 rounded-lg hover:bg-card flex items-center justify-center text-muted hover:text-red transition-all">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <Header data={data} />

          {/* Search inline when viewing stock */}
          <div className="max-w-md">
            <SearchBar onSearch={handleSearch} loading={loading} />
          </div>

          {/* Verdicts */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Verdict ticker={data.ticker} />
            <ShortTermVerdict ticker={data.ticker} />
            <SixMonthVision ticker={data.ticker} />
          </div>

          <NewsPanel ticker={data.ticker} />

          {/* ── VALUATION ── */}
          <SectionDivider label="VALUATION" accent />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <FairValue ticker={data.ticker} />
            <SwotAnalysis ticker={data.ticker} />
          </div>
          <DCFValuation ticker={data.ticker} />

          {/* ── ANALYSIS ── */}
          <SectionDivider label="FUNDAMENTALS & TECHNICALS" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Fundamentals data={data} />
            <Technicals data={data} />
          </div>
          <FinancialStatements ticker={data.ticker} />
          <ProChart data={data.historical} ticker={data.ticker} />

          {/* ── ACTIVITY ── */}
          <SectionDivider label="INSIDER & EARNINGS ACTIVITY" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <EarningsPanel ticker={data.ticker} />
            <InsiderTransactions ticker={data.ticker} />
          </div>
          <PeerComparison ticker={data.ticker} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <CollapsibleSection title="SEC Filings" badge="EDGAR" defaultOpen={false}>
              <SECFilings ticker={data.ticker} />
            </CollapsibleSection>
            <CollapsibleSection title="Options Flow" badge="SMART MONEY" defaultOpen={false}>
              <OptionsFlow ticker={data.ticker} />
            </CollapsibleSection>
          </div>

          {/* ── COMPARE ── */}
          <SectionDivider label="COMPARE" />
          <StockComparison initialTicker={data.ticker} onSearch={handleSearch} />

          {/* ── EXPLORE ── */}
          <SectionDivider label="EXPLORE MORE" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <CollapsibleSection title="Economic Calendar" badge="MACRO" defaultOpen={false}>
              <EconomicCalendar />
            </CollapsibleSection>
            <CollapsibleSection title="Sector Heatmap" badge="FLOW" defaultOpen={false}>
              <SectorHeatmap onSearch={handleSearch} />
            </CollapsibleSection>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <CollapsibleSection title="Congress Trades" badge="POLITICAL" defaultOpen={false}>
              <CongressTrades ticker={data.ticker} onSelectTicker={handleSearch} />
            </CollapsibleSection>
            <CollapsibleSection title="Insider Screener" badge="SMART MONEY" defaultOpen={false}>
              <InsiderScreener onSearch={handleSearch} />
            </CollapsibleSection>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <CollapsibleSection title="Compounder Screener" badge="QUALITY" defaultOpen={false}>
              <Screener onSelectTicker={handleSearch} />
            </CollapsibleSection>
            <CollapsibleSection title="IPO Watchlist" badge="2026-27" defaultOpen={false}>
              <IPOWatchlist onSelectTicker={handleSearch} />
            </CollapsibleSection>
          </div>

          {/* ── INVEST ── */}
          <SectionDivider label="INVEST" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <CollapsibleSection title="Top Index ETFs" badge="CTO & PEA" defaultOpen={false}>
              <ETFTracker />
            </CollapsibleSection>
            <CollapsibleSection title="Compound Simulator" defaultOpen={false}>
              <CompoundSimulator />
            </CollapsibleSection>
          </div>

          {/* Back to top */}
          <div className="flex justify-center pt-8">
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-muted hover:text-foreground hover:bg-card border border-transparent hover:border-border transition-all text-xs"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
              Back to top
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* SECTOR DEEP DIVE VIEW                       */}
      {/* ═══════════════════════════════════════════ */}
      {deepDiveSector && !data && !loading && (
        <SectorDeepDive
          sectorKey={deepDiveSector}
          onClose={() => setDeepDiveSector(null)}
          onSearch={(ticker) => { setDeepDiveSector(null); handleSearch(ticker); }}
        />
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* LANDING DASHBOARD                           */}
      {/* ═══════════════════════════════════════════ */}
      {!data && !loading && !error && !deepDiveSector && (
        <div className="fade-in">

          {/* Hero section — compact */}
          <div className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-accent/3 via-transparent to-transparent pointer-events-none" />
            <div className="max-w-[1280px] mx-auto px-6 pt-6 pb-4 text-center relative">
              <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight leading-tight">
                Institutional-grade research,{" "}
                <span className="gradient-text">built for everyone.</span>
              </h1>
              <p className="text-muted text-[11px] sm:text-xs mt-1.5 max-w-lg mx-auto">
                Sectors, AI valuations, insider flow, macro, crypto, global markets — one terminal.
              </p>

              {/* Search — mobile only (desktop has it in nav) */}
              <div className="md:hidden mt-4 max-w-md mx-auto">
                <SearchBar onSearch={handleSearch} loading={loading} />
              </div>
            </div>
          </div>

          {/* Tab navigation */}
          <div className="max-w-[1280px] mx-auto px-6">
            <div className="flex items-center gap-1 border-b border-border">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setLandingTab(tab.key)}
                  className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-all border-b-2 -mb-px rounded-t-lg ${
                    landingTab === tab.key
                      ? "text-accent border-accent bg-accent/5"
                      : "text-muted border-transparent hover:text-foreground hover:bg-card/50"
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
                  </svg>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab content */}
          <div className="max-w-[1280px] mx-auto px-6 pt-8 pb-16 tab-content-enter" key={landingTab}>

            {/* ═══════ SECTORS TAB ═══════ */}
            {landingTab === "sectors" && (
              <div className="space-y-8">

                {/* Featured sectors — hero cards */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {FEATURED_SECTORS.map((s) => (
                    <button
                      key={s.key}
                      onClick={() => setDeepDiveSector(s.key)}
                      className={`relative overflow-hidden bg-gradient-to-br ${s.gradient} border border-border rounded-xl p-6 text-left transition-all hover:border-border-light hover:shadow-xl hover:shadow-black/5 group ring-1 ${s.ring} ring-inset`}
                    >
                      {/* Badge */}
                      <div className="absolute top-4 right-4">
                        <span className={`text-[9px] px-2 py-0.5 rounded-md font-bold tracking-widest text-white ${s.badgeColor}`}>{s.badge}</span>
                      </div>
                      {/* Content */}
                      <div className={`text-xs font-bold tracking-wider mb-2 ${s.accent}`}>{s.name}</div>
                      <div className="text-lg font-bold text-foreground leading-snug mb-2 group-hover:text-accent transition-colors">{s.tagline}</div>
                      <div className="text-xs text-muted leading-relaxed mb-4">{s.desc}</div>
                      <div className="flex items-center justify-between">
                        <div className="text-[10px] text-muted/50 font-mono tracking-wider">{s.stocks}</div>
                        <div className="flex items-center gap-1.5 text-xs text-accent opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all">
                          Deep Dive
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                {/* All sectors grid */}
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <h3 className="text-sm font-semibold text-foreground">All Sectors</h3>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {OTHER_SECTORS.map((s) => (
                      <button
                        key={s.key}
                        onClick={() => setDeepDiveSector(s.key)}
                        className="premium-card rounded-xl p-5 text-left group"
                      >
                        <div className="flex items-start gap-4">
                          <div className="w-10 h-10 rounded-lg bg-accent/8 border border-accent/10 flex items-center justify-center flex-shrink-0 group-hover:bg-accent/15 group-hover:border-accent/20 transition-all">
                            <svg className="w-5 h-5 text-accent/70" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d={s.icon} />
                            </svg>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold text-foreground group-hover:text-accent transition-colors">{s.name}</div>
                            <div className="text-xs text-muted leading-relaxed mt-1">{s.desc}</div>
                            <div className="text-[10px] text-muted/40 font-mono mt-2 tracking-wider">{s.stocks}</div>
                          </div>
                          <svg className="w-4 h-4 text-muted/20 group-hover:text-accent/50 transition-colors flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Market pulse */}
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <h3 className="text-sm font-semibold text-foreground">Market Pulse</h3>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                    <div className="lg:col-span-2"><FearGreedIndex /></div>
                    <div className="lg:col-span-3"><SectorHeatmap onSearch={handleSearch} /></div>
                  </div>
                </div>

                {/* Compare any stocks */}
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <h3 className="text-sm font-semibold text-foreground">Compare Stocks</h3>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                  <CompareChart />
                </div>
              </div>
            )}

            {/* ═══════ OVERVIEW TAB ═══════ */}
            {landingTab === "overview" && (
              <div className="space-y-8">
                <DailyBriefing onSearch={handleSearch} />
                <MacroDashboard />
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                  <div className="lg:col-span-2"><FearGreedIndex /></div>
                  <div className="lg:col-span-3"><SectorHeatmap onSearch={handleSearch} /></div>
                </div>
                <GlobalMarkets onSearch={handleSearch} />
                <EconomicCalendar />
              </div>
            )}

            {/* ═══════ CRYPTO TAB ═══════ */}
            {landingTab === "crypto" && (
              cryptoCoinId ? (
                <CryptoAnalysis coinId={cryptoCoinId} onClose={() => setCryptoCoinId(null)} />
              ) : (
                <CryptoMarkets onSelectCoin={(id) => { setCryptoCoinId(id); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
              )
            )}

            {/* ═══════ SCREENERS TAB ═══════ */}
            {landingTab === "screeners" && (
              <div className="space-y-8">
                {/* Quick stats */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { label: "Options Flow", desc: "Unusual activity scanner", color: "text-red", border: "border-red/15", bg: "bg-red/5" },
                    { label: "Insider Buys", desc: "Smart money tracker", color: "text-green", border: "border-green/15", bg: "bg-green/5" },
                    { label: "IPO Watch", desc: "2026-2027 upcoming", color: "text-accent", border: "border-accent/15", bg: "bg-accent/5" },
                    { label: "Congress", desc: "Political trades", color: "text-yellow", border: "border-yellow/15", bg: "bg-yellow/5" },
                  ].map((card) => (
                    <div key={card.label} className={`${card.bg} border ${card.border} rounded-xl p-4`}>
                      <div className={`text-sm font-semibold ${card.color}`}>{card.label}</div>
                      <div className="text-xs text-muted mt-1">{card.desc}</div>
                    </div>
                  ))}
                </div>

                <RedditTracker onSearch={handleSearch} />
                <InvestorTracker onSearch={handleSearch} />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <OptionsFlow onSearch={handleSearch} />
                  <InsiderScreener onSearch={handleSearch} />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <IPOWatchlist onSelectTicker={handleSearch} />
                  <Screener onSelectTicker={handleSearch} />
                </div>
                <CongressTrades onSelectTicker={handleSearch} />
              </div>
            )}

            {/* ═══════ INVEST TAB ═══════ */}
            {landingTab === "invest" && (
              <div className="space-y-8">
                <div className="premium-card rounded-xl p-6">
                  <h3 className="text-lg font-bold text-foreground mb-1">Investment Tools</h3>
                  <p className="text-sm text-muted">Track index ETFs, simulate compound returns, and build your long-term strategy.</p>
                </div>
                <ETFTracker />
                <CompoundSimulator />
              </div>
            )}
          </div>

          {/* Footer */}
          <footer className="border-t border-border py-6 text-center">
            <div className="text-xs text-muted/40">
              ChabAlgo Terminal &middot; Data: Finnhub · Yahoo Finance · CoinGecko · FRED · SEC EDGAR · ApeWisdom · Reddit &middot; Not financial advice
            </div>
          </footer>
        </div>
      )}

      {/* Background alert watcher — invisible, polls every 60s */}
      <AlertWatcher />

      {/* Watchlist floating panel — persistent across all views */}
      <Watchlist onSelectTicker={handleSearch} />

      {/* Portfolio sidebar */}
      <Portfolio />
    </div>
  );
}

/* ─── Section Divider ─── */
function SectionDivider({ label, accent }: { label: string; accent?: boolean }) {
  return (
    <div className="flex items-center gap-4 pt-6 pb-2">
      {accent && <div className="w-1 h-4 rounded-full bg-accent" />}
      <span className={`text-xs font-semibold tracking-[0.15em] ${accent ? "text-accent" : "text-muted/50"}`}>{label}</span>
      <div className="h-px flex-1 bg-gradient-to-r from-border to-transparent" />
    </div>
  );
}
