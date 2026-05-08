"use client";

import { useState, useRef, useEffect, useCallback } from "react";

import { API_BASE } from "../lib/apiBase";
const RECENT_KEY = "chabalgo_recent_searches";
const RECENT_LIMIT = 5;

interface SearchResult {
  symbol: string;
  description: string;
  type: string;
  exchange?: string;
}

interface SearchBarProps {
  onSearch: (query: string) => void;
  loading: boolean;
}

function loadRecent(): SearchResult[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, RECENT_LIMIT) : [];
  } catch {
    return [];
  }
}

function saveRecent(item: SearchResult) {
  if (typeof window === "undefined") return;
  try {
    const existing = loadRecent().filter((r) => r.symbol !== item.symbol);
    const next = [item, ...existing].slice(0, RECENT_LIMIT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {}
}

export default function SearchBar({ onSearch, loading }: SearchBarProps) {
  const [value, setValue] = useState("");
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [recent, setRecent] = useState<SearchResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    setRecent(loadRecent());
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) return;
      const data = await res.json();
      setSuggestions(data.results || []);
      setSelectedIdx(-1);
    } catch {
      setSuggestions([]);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setValue(v);
    setShowSuggestions(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(v.trim());
    }, 250);
  };

  const submitTicker = (ticker: string, item?: SearchResult) => {
    setValue("");
    setShowSuggestions(false);
    setSuggestions([]);
    if (item) saveRecent(item);
    else saveRecent({ symbol: ticker, description: ticker, type: "Equity" });
    setRecent(loadRecent());
    onSearch(ticker);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = value.trim();
    if (!q) return;
    const list = displayList();
    if (selectedIdx >= 0 && selectedIdx < list.length) {
      submitTicker(list[selectedIdx].symbol, list[selectedIdx]);
      return;
    }
    setShowSuggestions(false);
    submitTicker(q);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const list = displayList();
    if (!showSuggestions || list.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((prev) => Math.min(prev + 1, list.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((prev) => Math.max(prev - 1, -1));
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  const displayList = (): SearchResult[] => {
    if (value.trim().length >= 2 && suggestions.length > 0) return suggestions;
    return recent;
  };

  const list = displayList();
  const showingRecent = value.trim().length < 2 && recent.length > 0;

  return (
    <div ref={containerRef} className="w-full relative">
      <form onSubmit={handleSubmit}>
        <div className="border border-border bg-card/80 backdrop-blur-sm flex items-center px-4 py-3 rounded-xl hover:border-border-light focus-within:border-accent/40 focus-within:ring-1 focus-within:ring-accent/10 transition-all">
          <svg className="w-4 h-4 text-muted mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={() => setShowSuggestions(true)}
            placeholder="Search stocks worldwide — Apple, Samsung, LVMH..."
            className="flex-1 bg-transparent text-foreground text-sm outline-none placeholder:text-muted/50"
            disabled={loading}
          />
          {loading ? (
            <div className="w-4 h-4 border-2 border-accent/20 border-t-accent rounded-full animate-spin ml-2" />
          ) : (
            <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[9px] text-muted/40 border border-border rounded font-mono ml-2">
              Enter
            </kbd>
          )}
        </div>
      </form>

      {showSuggestions && list.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 border border-border bg-card rounded-xl shadow-2xl shadow-black/30 max-h-80 overflow-y-auto">
          {showingRecent && (
            <div className="px-4 py-1.5 text-[9px] tracking-wider text-muted/50 font-bold border-b border-border bg-subtle/30 flex items-center gap-1.5">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              RECENT SEARCHES
            </div>
          )}
          {list.map((item, i) => (
            <button
              key={`${item.symbol}-${i}`}
              type="button"
              className={`w-full text-left px-4 py-2.5 flex items-center gap-3 text-sm transition-colors ${
                i === selectedIdx ? "bg-accent/10 text-accent" : "text-foreground hover:bg-subtle/50"
              }`}
              onClick={() => submitTicker(item.symbol, item)}
              onMouseEnter={() => setSelectedIdx(i)}
            >
              <span className="text-accent font-bold min-w-[80px] font-mono text-xs">{item.symbol}</span>
              <span className="text-muted truncate text-xs flex-1">{item.description}</span>
              {item.exchange && <span className="text-muted/40 text-[10px] font-medium whitespace-nowrap">{item.exchange}</span>}
              {item.type && <span className="text-muted/30 text-[10px] font-medium whitespace-nowrap">{item.type}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
