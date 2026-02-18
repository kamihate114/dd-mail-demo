"use client";

import { useState, useMemo, useEffect, useCallback, useRef, Fragment } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, FolderOpen, Filter, Archive, Loader2, Search, X } from "lucide-react";
import { EmailItem } from "@/lib/mockEmails";
import { GmailLabel } from "@/lib/gmail";

interface MailInboxProps {
  provider: "outlook" | "gmail";
  emails: EmailItem[];
  selectedEmailId: string | null;
  onSelectEmail: (id: string | null) => void;
  onLogout: () => void;
  onRefresh: () => void;
  onMarkAsRead: (id: string) => void;
  onArchive: (id: string) => void;
  onLoadMore: () => void;
  isLoadingMore: boolean;
  hasMore: boolean;
  onSelectLabel: (labelId: string) => void;
  onSearch: (query: string) => void;
  isSearching?: boolean;
  isRefreshing?: boolean;
  labels: GmailLabel[];
  activeLabelId: string;
  activeLabelTotal: number | null;
}

const providerInfo = {
  outlook: { label: "Outlook", color: "text-[#0078D4]", bg: "bg-[#0078D4]" },
  gmail: { label: "Gmail", color: "text-red-500", bg: "bg-red-500" },
};

/* ---------- Date grouping ---------- */

function getDateGroup(email: EmailItem): string {
  if (email.receivedDate) {
    const d = new Date(email.receivedDate + "T00:00:00");
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    const weekStart = new Date(today); weekStart.setDate(today.getDate() - today.getDay());

    if (d >= today) return "今日";
    if (d >= yesterday) return "昨日";
    if (d >= weekStart) return "今週";
    return "それ以前";
  }
  const at = email.receivedAt;
  if (at.includes(":")) return "今日";
  if (at === "昨日") return "昨日";
  return "それ以前";
}

const GROUP_ORDER = ["今日", "昨日", "今週", "それ以前"];

function groupEmails(emails: EmailItem[]): { label: string; emails: EmailItem[] }[] {
  const map = new Map<string, EmailItem[]>();
  for (const e of emails) {
    const g = getDateGroup(e);
    if (!map.has(g)) map.set(g, []);
    map.get(g)!.push(e);
  }
  return GROUP_ORDER.filter((g) => map.has(g)).map((g) => ({ label: g, emails: map.get(g)! }));
}

/* ---------- Filter options ---------- */

type FilterId = "unread" | "recent" | "starred" | "attachment" | "me";

const FILTERS: { id: FilterId; label: string }[] = [
  { id: "unread", label: "未読のみ" },
  { id: "recent", label: "直近7日間" },
  { id: "starred", label: "スター付き" },
  { id: "attachment", label: "添付ファイルあり" },
  { id: "me", label: "自分宛て" },
];

function applyFilters(emails: EmailItem[], activeFilters: Set<FilterId>, searchQuery: string): EmailItem[] {
  let result = emails;

  // Search filter
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    result = result.filter((e) =>
      e.subject.toLowerCase().includes(q) ||
      e.sender.toLowerCase().includes(q) ||
      e.senderEmail.toLowerCase().includes(q) ||
      e.preview.toLowerCase().includes(q) ||
      e.body.toLowerCase().includes(q)
    );
  }

  if (activeFilters.size === 0) return result;

  if (activeFilters.has("unread")) {
    result = result.filter((e) => e.unread);
  }
  if (activeFilters.has("recent")) {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const cutoff = sevenDaysAgo.toISOString().split("T")[0];
    result = result.filter((e) => {
      if (e.receivedDate) return e.receivedDate >= cutoff;
      return e.receivedAt.includes(":") || e.receivedAt === "昨日";
    });
  }
  if (activeFilters.has("starred")) {
    result = result.filter((e) => (e as EmailItem & { starred?: boolean }).starred);
  }
  if (activeFilters.has("attachment")) {
    result = result.filter((e) => (e as EmailItem & { hasAttachment?: boolean }).hasAttachment);
  }
  // "me" filter — would need user's email, skip for now as client-side placeholder

  return result;
}

export function MailInbox({
  provider, emails, selectedEmailId, onSelectEmail,
  onLogout, onRefresh, onMarkAsRead, onArchive, onLoadMore, isLoadingMore, hasMore, onSelectLabel,
  onSearch, isSearching,
  isRefreshing, labels, activeLabelId, activeLabelTotal,
}: MailInboxProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragImageRef = useRef<HTMLDivElement | null>(null);
  const [showPanel, setShowPanel] = useState<"folder" | "filter" | "search" | null>(null);
  const [activeFilters, setActiveFilters] = useState<Set<FilterId>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [localSearch, setLocalSearch] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const info = providerInfo[provider];
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Focus search input when search panel opens
  useEffect(() => {
    if (showPanel === "search") {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [showPanel]);

  // Delete / Backspace key → archive selected email
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === "Delete" || e.key === "Backspace") && selectedEmailId) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return;
        e.preventDefault();
        onArchive(selectedEmailId);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectedEmailId, onArchive]);

  // Infinite scroll — load more when near bottom
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el || isLoadingMore || !hasMore) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    if (scrollHeight - scrollTop - clientHeight < 150) {
      onLoadMore();
    }
  }, [isLoadingMore, hasMore, onLoadMore]);

  const toggleFilter = (id: FilterId) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSearchSubmit = () => {
    const q = localSearch.trim();
    setSearchQuery(q);
    if (q) onSearch(q);
  };

  const handleClearSearch = () => {
    setLocalSearch("");
    setSearchQuery("");
    onSearch("");
  };

  const filteredEmails = useMemo(() => applyFilters(emails, activeFilters, searchQuery), [emails, activeFilters, searchQuery]);
  const groups = useMemo(() => groupEmails(filteredEmails), [filteredEmails]);

  const handleEmailClick = (email: EmailItem) => {
    const isSelected = selectedEmailId === email.id;
    onSelectEmail(isSelected ? null : email.id);
    if (email.unread) {
      onMarkAsRead(email.id);
    }
  };

  // Count display: use activeLabelTotal (from Gmail API) if available
  const totalDisplay = activeLabelTotal != null ? activeLabelTotal : emails.length;
  const isFiltered = activeFilters.size > 0 || searchQuery.trim().length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.25 }}
      className="flex h-full flex-col min-h-0"
    >
      {/* Account header（Outlook 表示のみ。クリックでログアウトしない） */}
      <div className="shrink-0 flex items-center justify-between px-1 pb-2">
        <div className="flex items-center gap-2 rounded-md px-1.5 py-1">
          <div className={`h-2 w-2 rounded-full ${info.bg}`} />
          <span className="text-xs font-semibold text-text-primary">
            {info.label}
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setShowPanel(showPanel === "folder" ? null : "folder")}
            className={`rounded-md p-1.5 transition-colors ${
              showPanel === "folder" ? "bg-brand-blue/10 text-brand-blue" : "text-text-muted hover:bg-border-default hover:text-text-primary"
            }`}
            title="フォルダ"
          >
            <FolderOpen className="h-3 w-3" />
          </button>
          <button
            onClick={() => setShowPanel(showPanel === "filter" ? null : "filter")}
            className={`relative rounded-md p-1.5 transition-colors ${
              showPanel === "filter" || activeFilters.size > 0
                ? "bg-brand-blue/10 text-brand-blue"
                : "text-text-muted hover:bg-border-default hover:text-text-primary"
            }`}
            title="フィルター"
          >
            <Filter className="h-3 w-3" />
            {activeFilters.size > 0 && (
              <div className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-brand-blue" />
            )}
          </button>
          <button
            onClick={() => setShowPanel(showPanel === "search" ? null : "search")}
            className={`relative rounded-md p-1.5 transition-colors ${
              showPanel === "search" || searchQuery.trim()
                ? "bg-brand-blue/10 text-brand-blue"
                : "text-text-muted hover:bg-border-default hover:text-text-primary"
            }`}
            title="検索"
          >
            <Search className="h-3 w-3" />
            {searchQuery.trim() && (
              <div className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-brand-blue" />
            )}
          </button>
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="rounded-md p-1.5 text-text-muted hover:bg-border-default hover:text-text-primary transition-colors disabled:opacity-50"
            title="更新"
          >
            {isRefreshing ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
          </button>
        </div>
      </div>

      {/* Folder / Filter / Search panel */}
      <AnimatePresence>
        {showPanel && (
          <motion.div
            key={showPanel}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="shrink-0 overflow-hidden border-b border-border-default mb-2"
          >
            <div className="pb-2">
              {showPanel === "folder" && (
                <div className="flex flex-col gap-0.5">
                  <p className="text-[10px] font-semibold text-text-muted px-1 mb-1">フォルダ</p>
                  {labels.length === 0 ? (
                    <div className="px-2 py-3 text-center text-[11px] text-text-muted">
                      フォルダが読み込まれていません
                    </div>
                  ) : (
                    labels.map((label) => (
                      <button
                        key={label.id}
                        onClick={() => { onSelectLabel(label.id); setShowPanel(null); }}
                        className={`flex items-center justify-between rounded-md px-2 py-1.5 text-[11px] transition-colors ${
                          label.id === activeLabelId
                            ? "bg-brand-blue/10 text-brand-blue font-medium"
                            : "text-text-secondary hover:bg-border-default"
                        }`}
                      >
                        <span>{label.name}</span>
                        {label.messagesUnread != null && label.messagesUnread > 0 && (
                          <span className="text-[9px] rounded-full bg-brand-blue/15 text-brand-blue px-1.5 py-0.5 font-medium">
                            {label.messagesUnread}
                          </span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
              {showPanel === "filter" && (
                <div className="flex flex-col gap-0.5">
                  <p className="text-[10px] font-semibold text-text-muted px-1 mb-1">フィルター</p>
                  {FILTERS.map((f) => {
                    const isActive = activeFilters.has(f.id);
                    return (
                      <button
                        key={f.id}
                        onClick={() => toggleFilter(f.id)}
                        className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] transition-colors ${
                          isActive ? "bg-brand-blue/10 text-brand-blue font-medium" : "text-text-secondary hover:bg-border-default"
                        }`}
                      >
                        <div className={`h-3 w-3 rounded border flex items-center justify-center transition-colors ${
                          isActive ? "border-brand-blue bg-brand-blue" : "border-border-default"
                        }`}>
                          {isActive && (
                            <svg className="h-2 w-2 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={2.5}>
                              <path d="M2 6l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>
                        <span>{f.label}</span>
                      </button>
                    );
                  })}
                  {activeFilters.size > 0 && (
                    <button
                      onClick={() => setActiveFilters(new Set())}
                      className="mt-1 px-2 py-1 text-[10px] text-text-muted hover:text-text-primary transition-colors"
                    >
                      フィルターをクリア
                    </button>
                  )}
                </div>
              )}
              {showPanel === "search" && (
                <div className="flex flex-col gap-1.5">
                  <p className="text-[10px] font-semibold text-text-muted px-1">検索</p>
                  <div className="relative">
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={localSearch}
                      onChange={(e) => setLocalSearch(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleSearchSubmit(); }}
                      placeholder="件名、差出人、本文..."
                      className="w-full rounded-md border border-border-default bg-surface-raised/50 dark:bg-surface-raised
                                 px-2 py-1.5 pr-7 text-[11px] text-text-primary placeholder:text-text-muted
                                 focus:border-brand-blue focus:outline-none transition-colors"
                    />
                    {localSearch && (
                      <button
                        onClick={handleClearSearch}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-text-muted hover:text-text-primary transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  {isSearching && (
                    <div className="flex items-center gap-1.5 px-1">
                      <Loader2 className="h-2.5 w-2.5 text-brand-blue animate-spin" />
                      <span className="text-[10px] text-text-muted">検索中...</span>
                    </div>
                  )}
                  {searchQuery && (
                    <p className="text-[10px] text-text-muted px-1">
                      「{searchQuery}」の検索結果: {filteredEmails.length}件
                    </p>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mail count — show folder total + search/filter close button */}
      <div className="shrink-0 flex items-center justify-between px-1 pb-2">
        <span className="text-[10px] text-text-muted">
          {isFiltered
            ? `${filteredEmails.length}件 / ${totalDisplay}件`
            : `${totalDisplay}件`
          }
        </span>
        {isFiltered && (
          <button
            onClick={() => {
              setSearchQuery("");
              setLocalSearch("");
              setActiveFilters(new Set());
              setShowPanel(null);
              onSearch("");
            }}
            className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] text-brand-blue font-medium
                       hover:bg-brand-blue/10 transition-colors"
          >
            <span>{searchQuery.trim() ? "検索中" : "フィルター適用中"}</span>
            <X className="h-2.5 w-2.5" />
          </button>
        )}
      </div>

      {/* Email list — grouped by date (scrollable) */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 -mx-4 overflow-y-auto px-4"
      >
        <div className="flex flex-col gap-1">
          {groups.map((group) => (
            <Fragment key={group.label}>
              <div className="sticky top-0 z-10 -mx-1 px-1 py-1.5 bg-surface/90 backdrop-blur-sm">
                <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">
                  {group.label}
                </span>
              </div>
              {group.emails.map((email, i) => {
                const isSelected = selectedEmailId === email.id;
                return (
                  <motion.div
                    key={email.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    draggable
                    onClick={() => handleEmailClick(email)}
                    onDragStart={(e) => {
                      setDraggingId(email.id);
                      const de = e as unknown as React.DragEvent;
                      const payload = JSON.stringify({
                        id: email.id,
                        sender: email.sender,
                        senderEmail: email.senderEmail,
                        subject: email.subject,
                        body: email.body,
                        threadId: email.threadId,
                        conversationId: email.conversationId,
                      });
                      de.dataTransfer.setData("application/x-dragop-email", payload);
                      de.dataTransfer.setData("text/plain", email.body);
                      de.dataTransfer.effectAllowed = "copy";
                    }}
                    onDragEnd={() => setDraggingId(null)}
                    className={`
                      group cursor-grab rounded-lg border relative
                      px-3 py-2.5 transition-all duration-150
                      active:cursor-grabbing
                      ${isSelected
                        ? "border-brand-blue bg-brand-blue/5 dark:bg-brand-blue/10 shadow-sm"
                        : "border-border-default bg-surface-raised/50 dark:bg-surface-raised hover:border-brand-blue/40 hover:shadow-sm"
                      }
                      ${draggingId === email.id ? "opacity-40 scale-95" : ""}
                    `}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          {email.unread && (
                            <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-blue" />
                          )}
                          <p className={`truncate text-[11px] ${email.unread ? "font-semibold text-text-primary" : "font-medium text-text-secondary"}`}>
                            {email.sender}
                          </p>
                        </div>
                        <p className={`mt-0.5 truncate text-[11px] ${email.unread ? "font-medium text-text-primary" : "text-text-secondary"}`}>
                          {email.subject}
                        </p>
                        <p className="mt-0.5 truncate text-[10px] text-text-muted">
                          {email.preview}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="shrink-0 text-[10px] text-text-muted">{email.receivedAt}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); onArchive(email.id); }}
                          className="rounded p-0.5 text-text-muted opacity-0 group-hover:opacity-100 hover:bg-border-default hover:text-text-primary transition-all"
                          title="アーカイブ"
                        >
                          <Archive className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </Fragment>
          ))}
          {/* Load more indicator */}
          {isLoadingMore && (
            <div className="flex items-center justify-center gap-2 py-4">
              <Loader2 className="h-3 w-3 text-brand-blue animate-spin" />
              <span className="text-[10px] text-text-muted">読み込み中...</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
