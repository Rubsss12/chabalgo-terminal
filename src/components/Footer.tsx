"use client";

interface FooterProps {
  onTabSelect?: (tab: string) => void;
  onSearch?: (ticker: string) => void;
}

export default function Footer({ onTabSelect }: FooterProps) {
  const handleTab = (tab: string) => {
    onTabSelect?.(tab);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <footer className="border-t border-border bg-card/50 backdrop-blur-sm">
      <div className="max-w-[1280px] mx-auto px-3 sm:px-6 py-8 sm:py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6 sm:gap-8">
          {/* Brand */}
          <div className="col-span-2 lg:col-span-2">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center">
                <span className="text-accent font-bold text-base">C</span>
              </div>
              <div>
                <div className="text-foreground font-bold tracking-tight">ChabAlgo</div>
                <div className="text-[10px] text-muted">Terminal · v1.0</div>
              </div>
            </div>
            <p className="text-xs text-muted leading-relaxed max-w-xs mb-4">
              Institutional-grade financial research, built for retail investors.
              Free, no signup, no ads, no data selling.
            </p>
            <div className="flex items-center gap-2">
              <a
                href="https://github.com/Rubsss12/chabalgo-terminal"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-lg border border-border bg-card flex items-center justify-center text-muted hover:text-accent hover:border-accent/30 transition-all"
                title="GitHub"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0C5.374 0 0 5.373 0 12 0 17.302 3.438 21.8 8.207 23.387c.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-[10px] font-bold tracking-[0.15em] text-muted/50 mb-3">PRODUCT</h4>
            <ul className="space-y-2 text-xs text-foreground/80">
              <li><button onClick={() => handleTab("sectors")} className="hover:text-accent transition-colors">Sectors</button></li>
              <li><button onClick={() => handleTab("overview")} className="hover:text-accent transition-colors">Market Overview</button></li>
              <li><button onClick={() => handleTab("ai")} className="hover:text-accent transition-colors">AI Bottlenecks</button></li>
              <li><button onClick={() => handleTab("crypto")} className="hover:text-accent transition-colors">Crypto Terminal</button></li>
              <li><button onClick={() => handleTab("screeners")} className="hover:text-accent transition-colors">Screeners</button></li>
              <li><button onClick={() => handleTab("invest")} className="hover:text-accent transition-colors">Invest</button></li>
            </ul>
          </div>

          {/* Data */}
          <div>
            <h4 className="text-[10px] font-bold tracking-[0.15em] text-muted/50 mb-3">DATA SOURCES</h4>
            <ul className="space-y-2 text-xs text-foreground/80">
              <li>Yahoo Finance</li>
              <li>Finnhub</li>
              <li>SEC EDGAR</li>
              <li>FRED (St. Louis Fed)</li>
              <li>CoinGecko</li>
              <li>ApeWisdom · Reddit</li>
              <li>Alpha Vantage</li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="text-[10px] font-bold tracking-[0.15em] text-muted/50 mb-3">LEGAL</h4>
            <ul className="space-y-2 text-xs text-foreground/80">
              <li className="text-muted/70">Not financial advice</li>
              <li className="text-muted/70">Use at your own risk</li>
              <li className="text-muted/70">Data may be delayed</li>
              <li className="text-muted/70">No data is sold</li>
            </ul>
          </div>
        </div>

        {/* Bottom strip */}
        <div className="mt-8 sm:mt-10 pt-6 border-t border-border/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="text-[10px] text-muted/50">
            © {new Date().getFullYear()} ChabAlgo Terminal · Built with public APIs and open source
          </div>
          <div className="text-[10px] text-muted/50">
            Made for serious investors. <span className="text-accent">No suits required.</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
