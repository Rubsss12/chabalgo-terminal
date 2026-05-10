"use client";

const FREE_FEATURES = [
  "Unlimited stock + crypto analysis",
  "All 12 global exchanges",
  "AI Bottlenecks explorer",
  "13F filings (12 famous investors)",
  "Reddit sentiment tracker",
  "Sector deep dives",
  "Watchlist with PnL tracking",
  "Price + RSI alerts",
];

const PRO_FEATURES = [
  "Everything in Free",
  "Real-time tick data (sub-second)",
  "Custom AI assistant per stock",
  "Backtest any strategy",
  "Custom screener builder",
  "Daily AI briefings via email",
  "Options chain with Greeks",
  "API access (5K calls/day)",
];

export default function PricingCTA() {
  return (
    <section className="max-w-[1280px] mx-auto px-3 sm:px-6 py-12 sm:py-16">
      <div className="text-center mb-8 sm:mb-10">
        <span className="inline-block text-[10px] font-bold tracking-[0.2em] text-accent bg-accent/8 px-3 py-1 rounded-full border border-accent/15 mb-3">
          PRICING
        </span>
        <h2 className="text-xl sm:text-3xl font-bold text-foreground tracking-tight">
          The free plan covers <span className="gradient-text">99% of investors</span>
        </h2>
        <p className="text-xs sm:text-sm text-muted mt-2">No card. No signup. Just open and use.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 max-w-3xl mx-auto">
        {/* Free tier */}
        <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 relative">
          <div className="flex items-baseline justify-between mb-1">
            <h3 className="text-lg font-bold text-foreground">Free</h3>
            <span className="text-[10px] font-bold tracking-wider text-accent bg-accent/10 px-2 py-0.5 rounded-md">CURRENT PLAN</span>
          </div>
          <div className="flex items-baseline gap-1 mb-1">
            <span className="text-4xl font-bold text-foreground tabular-nums">$0</span>
            <span className="text-sm text-muted">/forever</span>
          </div>
          <p className="text-xs text-muted mb-5">For retail investors and serious researchers</p>

          <ul className="space-y-2.5 mb-6">
            {FREE_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2 text-xs text-foreground/90">
                <svg className="w-4 h-4 text-green flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                {f}
              </li>
            ))}
          </ul>

          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="w-full text-sm font-bold py-3 rounded-xl bg-accent/10 text-accent border border-accent/20 hover:bg-accent/15 transition-colors"
          >
            Use it now
          </button>
        </div>

        {/* Pro tier */}
        <div className="relative bg-gradient-to-br from-accent/8 via-card to-card border-2 border-accent/30 rounded-2xl p-6 sm:p-8 shadow-lg shadow-accent/5">
          <div className="absolute -top-3 left-6 text-[10px] font-bold tracking-widest text-white bg-accent px-2.5 py-1 rounded-md">
            COMING SOON
          </div>
          <h3 className="text-lg font-bold text-foreground mb-1">Pro</h3>
          <div className="flex items-baseline gap-1 mb-1">
            <span className="text-4xl font-bold text-foreground tabular-nums">$19</span>
            <span className="text-sm text-muted">/month</span>
            <span className="text-[10px] text-muted/60 ml-1 line-through">vs $2,000+ Bloomberg</span>
          </div>
          <p className="text-xs text-muted mb-5">For active traders and small funds</p>

          <ul className="space-y-2.5 mb-6">
            {PRO_FEATURES.map((f, i) => (
              <li key={f} className="flex items-start gap-2 text-xs text-foreground/90">
                <svg className={`w-4 h-4 flex-shrink-0 mt-0.5 ${i === 0 ? "text-green" : "text-accent"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                {f}
              </li>
            ))}
          </ul>

          <button
            disabled
            className="w-full text-sm font-bold py-3 rounded-xl bg-accent text-white opacity-70 cursor-not-allowed"
          >
            Join the waitlist · Coming soon
          </button>
        </div>
      </div>
    </section>
  );
}
