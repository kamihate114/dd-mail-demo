"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { MailLoginScreen } from "./MailLoginScreen";
import { MailInbox } from "./MailInbox";
import { EmailItem } from "@/lib/mockEmails";
import { GmailLabel } from "@/lib/gmail";

interface LeftSidebarProps {
  isLoggedIn: boolean;
  isLoading: boolean;
  mailProvider: "outlook" | "gmail" | null;
  emails: EmailItem[];
  selectedEmailId: string | null;
  onSelectEmail: (id: string | null) => void;
  onLogin: (provider: "outlook" | "gmail") => void;
  onGmailAuth: (accessToken: string) => void;
  onOutlookAuth: (accessToken: string) => void;
  onLogout: () => void;
  onFullLogout: (provider: "outlook" | "gmail") => void;
  onRestoreSession: (provider: "outlook" | "gmail") => void;
  savedProviders: ("outlook" | "gmail")[];
  logoutMessage?: string | null;
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

export function LeftSidebar({
  isLoggedIn, isLoading, mailProvider, emails,
  selectedEmailId, onSelectEmail,
  onLogin, onGmailAuth, onOutlookAuth, onLogout, onFullLogout, onRestoreSession, savedProviders,
  logoutMessage,
  onRefresh, onMarkAsRead, onArchive, onLoadMore, isLoadingMore, hasMore, onSelectLabel,
  onSearch, isSearching, isRefreshing, labels, activeLabelId, activeLabelTotal,
}: LeftSidebarProps) {
  return (
    <aside className="flex h-full flex-col overflow-hidden p-4">
      {logoutMessage && (
        <div
          role="status"
          className="mb-3 rounded-lg border border-green-500/30 bg-green-500/10 dark:bg-green-500/15 px-3 py-2 text-xs text-green-700 dark:text-green-300"
        >
          {logoutMessage}
        </div>
      )}
      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex h-full flex-col gap-3"
          >
            <div className="flex items-center gap-2 px-1 pb-2">
              <div className="h-2 w-2 rounded-full bg-text-muted/30 animate-pulse" />
              <div className="h-3 w-16 rounded bg-text-muted/20 animate-pulse" />
            </div>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="rounded-lg border border-border-default bg-surface-raised/50 dark:bg-surface-raised px-3 py-3"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 space-y-1.5">
                    <div className="h-2.5 w-20 rounded bg-text-muted/20 animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
                    <div className="h-2.5 w-full rounded bg-text-muted/15 animate-pulse" style={{ animationDelay: `${i * 80 + 40}ms` }} />
                    <div className="h-2 w-3/4 rounded bg-text-muted/10 animate-pulse" style={{ animationDelay: `${i * 80 + 80}ms` }} />
                  </div>
                  <div className="h-2 w-8 rounded bg-text-muted/15 animate-pulse" />
                </div>
              </div>
            ))}
            <div className="flex items-center justify-center gap-2 pt-2">
              <Loader2 className="h-3 w-3 text-brand-blue animate-spin" />
              <span className="text-[10px] text-text-muted">メールを取得中...</span>
            </div>
          </motion.div>
        ) : !isLoggedIn ? (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden w-full">
            <MailLoginScreen
              key="login"
              onLogin={onLogin}
              onGmailAuth={onGmailAuth}
              onOutlookAuth={onOutlookAuth}
              onRestoreSession={onRestoreSession}
              onFullLogout={onFullLogout}
              savedProviders={savedProviders}
            />
          </div>
        ) : (
          <MailInbox
            key="inbox"
            provider={mailProvider!}
            emails={emails}
            selectedEmailId={selectedEmailId}
            onSelectEmail={onSelectEmail}
            onLogout={onLogout}
            onRefresh={onRefresh}
            onMarkAsRead={onMarkAsRead}
            onArchive={onArchive}
            onLoadMore={onLoadMore}
            isLoadingMore={isLoadingMore}
            hasMore={hasMore}
            onSelectLabel={onSelectLabel}
            onSearch={onSearch}
            isSearching={isSearching}
            isRefreshing={isRefreshing}
            labels={labels}
            activeLabelId={activeLabelId}
            activeLabelTotal={activeLabelTotal}
          />
        )}
      </AnimatePresence>
    </aside>
  );
}
