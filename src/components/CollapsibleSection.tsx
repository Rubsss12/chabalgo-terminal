"use client";

import { useState } from "react";

interface CollapsibleSectionProps {
  title: string;
  badge?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export default function CollapsibleSection({
  title,
  badge,
  defaultOpen = true,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-xl overflow-hidden border border-border">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3 bg-card hover:bg-card-hover transition-colors group"
      >
        <div className="flex items-center gap-3">
          <svg
            className={`w-3.5 h-3.5 text-muted transition-transform duration-200 ${open ? "rotate-90" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-sm font-semibold text-foreground">{title}</span>
          {badge && (
            <span className="text-[9px] px-2 py-0.5 rounded-md bg-accent/10 text-accent font-bold tracking-wider">
              {badge}
            </span>
          )}
        </div>
        <span className="text-[10px] text-muted/40 font-medium group-hover:text-muted transition-colors">
          {open ? "Collapse" : "Expand"}
        </span>
      </button>
      {open && <div className="border-t border-border">{children}</div>}
    </div>
  );
}
