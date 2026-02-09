"use client";

import { Mail, Search } from "lucide-react";
import { MailItem } from "./MailList";

interface MailHistoryProps {
  mails: MailItem[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export function MailHistory({ mails, searchQuery, onSearchChange }: MailHistoryProps) {
  const filtered = mails.filter((m) =>
    m.fileName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
        <input
          type="text"
          placeholder="日報を検索..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full rounded-lg border border-border-default bg-surface-raised/50 dark:bg-surface-raised
                     py-1.5 pl-8 pr-3 text-xs text-text-primary placeholder:text-text-muted
                     focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue/30
                     transition-colors"
        />
      </div>

      {/* Mail list */}
      <div className="flex flex-col gap-1">
        {filtered.length === 0 ? (
          <p className="py-4 text-center text-xs text-text-muted">
            {mails.length === 0 ? "読み込み中..." : "一致するメールがありません"}
          </p>
        ) : (
          filtered.map((mail) => (
            <button
              key={mail.id}
              className="flex items-start gap-2 rounded-lg px-2 py-2 text-left transition-colors
                         hover:bg-border-default"
            >
              <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-muted" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-text-primary">{mail.fileName}</p>
                <p className="text-[10px] text-text-muted">
                  {mail.charCount.toLocaleString()}文字 ・ {mail.timestamp.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
