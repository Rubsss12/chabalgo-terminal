"use client";

const FEATURES = [
  {
    icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
    title: "Stock Analysis",
    desc: "PE, fundamentals, technicals, SWOT, fair value — all in one click. From any ticker, anywhere in the world.",
    color: "text-blue-600 bg-blue-500/8 border-blue-500/15",
  },
  {
    icon: "M13 10V3L4 14h7v7l9-11h-7z",
    title: "AI Bottlenecks",
    desc: "12 chokepoints in the AI value chain. From EUV lithography to optical transceivers to HBM — find where the supply is stuck.",
    color: "text-accent bg-accent/8 border-accent/15",
    badge: "ALPHA",
  },
  {
    icon: "M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3",
    title: "13F Tracker",
    desc: "What Buffett, Burry, Ackman, Druckenmiller actually own — straight from SEC filings, refreshed every quarter.",
    color: "text-purple-600 bg-purple-500/8 border-purple-500/15",
  },
  {
    icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 10v1m6-6a6 6 0 11-12 0 6 6 0 0112 0z",
    title: "Crypto Terminal",
    desc: "Live BTC/ETH and 1000s of altcoins. Full analysis with technical indicators, on-chain context, and community sentiment.",
    color: "text-yellow bg-yellow/8 border-yellow/20",
  },
  {
    icon: "M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2",
    title: "Global Markets",
    desc: "12 exchanges live: Korea, Japan, Hong Kong, China, UK, Germany, France, India, Australia, Canada, Brazil, Taiwan.",
    color: "text-emerald-600 bg-emerald-500/8 border-emerald-500/15",
  },
  {
    icon: "M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z",
    title: "Watchlist + Alerts",
    desc: "Persistent watchlist with live PnL. Browser notifications when price or RSI crosses your thresholds.",
    color: "text-amber-600 bg-amber-500/8 border-amber-500/15",
  },
  {
    icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
    title: "Reddit Buzz",
    desc: "What r/wallstreetbets and 50+ stock subreddits are talking about right now. Mention counts + bullish/bearish sentiment.",
    color: "text-red bg-red/8 border-red/15",
  },
  {
    icon: "M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3",
    title: "Sector Deep Dives",
    desc: "Photonics, AI infrastructure, robotics, fintech, biotech, clean energy — full sector thesis with catalysts and stocks.",
    color: "text-cyan-600 bg-cyan-500/8 border-cyan-500/15",
  },
];

interface FeatureShowcaseProps {
  onTabSelect?: (tab: string) => void;
}

export default function FeatureShowcase({ onTabSelect }: FeatureShowcaseProps) {
  return (
    <section className="max-w-[1280px] mx-auto px-3 sm:px-6 py-12 sm:py-16">
      <div className="text-center mb-8 sm:mb-10">
        <span className="inline-block text-[10px] font-bold tracking-[0.2em] text-accent bg-accent/8 px-3 py-1 rounded-full border border-accent/15 mb-3">
          WHAT'S INSIDE
        </span>
        <h2 className="text-xl sm:text-3xl font-bold text-foreground tracking-tight">
          Eight features that would normally cost you{" "}
          <span className="gradient-text">$24,000/year</span>
        </h2>
        <p className="text-xs sm:text-sm text-muted mt-2 max-w-xl mx-auto">
          We built the tools institutional investors actually use — and gave them away free.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className="group relative bg-card border border-border rounded-xl p-4 sm:p-5 hover:border-accent/30 hover:shadow-lg hover:shadow-black/5 transition-all"
          >
            {f.badge && (
              <span className="absolute top-3 right-3 text-[8px] font-bold tracking-widest text-accent bg-accent/10 px-1.5 py-0.5 rounded border border-accent/20">
                {f.badge}
              </span>
            )}
            <div className={`w-10 h-10 rounded-xl border ${f.color} flex items-center justify-center mb-3`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}>
                <path strokeLinecap="round" strokeLinejoin="round" d={f.icon} />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-foreground mb-1.5">{f.title}</h3>
            <p className="text-[11px] sm:text-xs text-muted leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
