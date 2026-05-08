"use client";

import { useState, useEffect } from "react";
import { addToWatchlist, removeFromWatchlist, isWatched } from "./Watchlist";

interface WatchButtonProps {
  ticker: string;
  entryPrice?: number;
  size?: "sm" | "md";
}

export default function WatchButton({ ticker, entryPrice, size = "md" }: WatchButtonProps) {
  const [watching, setWatching] = useState(false);

  useEffect(() => {
    setWatching(isWatched(ticker));
    const handler = () => setWatching(isWatched(ticker));
    window.addEventListener("watchlist-changed", handler);
    return () => window.removeEventListener("watchlist-changed", handler);
  }, [ticker]);

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (watching) {
      removeFromWatchlist(ticker);
    } else {
      addToWatchlist(ticker, entryPrice);
    }
  };

  const sizeClasses = size === "sm" ? "w-8 h-8" : "w-9 h-9";
  const iconSize = size === "sm" ? "w-4 h-4" : "w-4 h-4";

  return (
    <button
      onClick={toggle}
      className={`${sizeClasses} rounded-lg flex items-center justify-center transition-all ${
        watching
          ? "bg-yellow/15 text-yellow border border-yellow/30 hover:bg-yellow/25"
          : "bg-card border border-border text-muted hover:border-accent/30 hover:text-accent hover:bg-accent/5"
      }`}
      title={watching ? "Remove from watchlist" : "Add to watchlist"}
    >
      <svg
        className={iconSize}
        fill={watching ? "currentColor" : "none"}
        stroke="currentColor"
        viewBox="0 0 24 24"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
        />
      </svg>
    </button>
  );
}
