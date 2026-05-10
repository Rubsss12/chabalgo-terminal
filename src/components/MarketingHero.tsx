"use client";

import { useState, useEffect } from "react";

interface MarketingHeroProps {
  onSearch: (ticker: string) => void;
}

const ROTATING_TAGLINES = [
  "The Bloomberg of the new generation.",
  "Institutional research, built for everyone.",
  "From sector deep dives to AI chokepoints — one terminal.",
  "Track 50+ countries, 12 famous investors, 1000s of stocks.",
];

const POPULAR_TICKERS = ["NVDA", "AAPL", "TSM", "ASML", "MSFT", "ATAI", "RKLB", "PLTR"];

export default function MarketingHero({ onSearch }: MarketingHeroProps) {
  const [tagIdx, setTagIdx] = useState(0);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const t = setInterval(() => setTagIdx((i) => (i + 1) % ROTATING_TAGLINES.length), 4000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="relative overflow-hidden">
      {/* Subtle background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-accent/5 via-transparent to-transparent pointer-events-none" />
      <div className="absolute inset-0 grid-pattern opacity-40 pointer-events-none" />

      <div className="relative max-w-[1280px] mx-auto px-3 sm:px-6 pt-8 sm:pt-12 pb-6 sm:pb-10">
        {/* Pre-headline pill */}
        <div className="flex justify-center mb-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/8 border border-accent/15">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-40" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
            </span>
            <span className="text-[11px] font-semibold tracking-wide text-accent">Live data · 20+ free sources · No signup</span>
          </div>
        </div>

        {/* Headline */}
        <h1 className="text-center text-2xl sm:text-4xl md:text-5xl font-bold text-foreground tracking-tight leading-[1.1]">
          Institutional-grade research,<br />
          <span className="gradient-text">built for everyone.</span>
        </h1>

        {/* Rotating sub-tagline */}
        <div className="text-center mt-3 sm:mt-4 h-6 sm:h-7 overflow-hidden">
          <p key={tagIdx} className="text-xs sm:text-sm text-muted fade-in">
            {ROTATING_TAGLINES[tagIdx]}
          </p>
        </div>

        {/* Big search */}
        <form
          onSubmit={(e) => { e.preventDefault(); if (query.trim()) onSearch(query.trim().toUpperCase()); }}
          className="mt-6 sm:mt-7 max-w-xl mx-auto"
        >
          <div className="border border-border bg-card/90 backdrop-blur-sm flex items-center px-4 py-3.5 rounded-xl shadow-md hover:border-border-light focus-within:border-accent/40 focus-within:ring-2 focus-within:ring-accent/15 transition-all">
            <svg className="w-5 h-5 text-muted mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Try AAPL, ATAI, 005930.KS, bitcoin..."
              className="flex-1 bg-transparent text-foreground text-sm outline-none placeholder:text-muted/50"
            />
            <button
              type="submit"
              className="text-xs font-bold px-3 py-1.5 rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors flex-shrink-0"
            >
              Analyze
            </button>
          </div>

          {/* Popular tickers chips */}
          <div className="flex items-center justify-center gap-1.5 mt-3 flex-wrap">
            <span className="text-[10px] text-muted/50 mr-1">Popular:</span>
            {POPULAR_TICKERS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => onSearch(t)}
                className="text-[11px] font-mono font-bold text-muted hover:text-accent bg-card border border-border hover:border-accent/30 px-2 py-1 rounded-md transition-all"
              >
                {t}
              </button>
            ))}
          </div>
        </form>
      </div>
    </div>
  );
}
