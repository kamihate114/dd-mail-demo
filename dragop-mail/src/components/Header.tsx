"use client";

import { ThemeToggle } from "./ThemeToggle";
import { Menu, ChevronRight, User } from "lucide-react";

interface HeaderProps {
  onToggleLeft?: () => void;
  onToggleRight?: () => void;
  rightOpen?: boolean;
}

export function Header({ onToggleLeft, onToggleRight, rightOpen }: HeaderProps) {
  return (
    <header className="glass border-b border-border-default">
      <div className="flex h-14 items-center justify-between px-4">
        {/* Left */}
        <div className="flex items-center gap-3">
          {onToggleLeft && (
            <button
              onClick={onToggleLeft}
              className="rounded-lg p-1.5 text-text-muted hover:bg-border-default hover:text-text-primary transition-colors lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
          )}
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-blue">
              <span className="text-xs font-bold text-white">P</span>
            </div>
            <h1 className="text-sm font-semibold tracking-tight text-text-primary">Poniu</h1>
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {onToggleRight && (
            <button
              onClick={onToggleRight}
              className="rounded-lg p-1.5 text-text-muted hover:bg-border-default hover:text-text-primary transition-colors"
              aria-label={rightOpen ? "右パネルを閉じる" : "右パネルを開く"}
            >
              <ChevronRight className={`h-4 w-4 transition-transform ${rightOpen ? "rotate-0" : "rotate-180"}`} />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
