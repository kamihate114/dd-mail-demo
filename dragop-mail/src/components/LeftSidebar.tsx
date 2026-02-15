"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Loader2, LayoutDashboard } from "lucide-react";
import { useRouter } from "next/navigation";
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
  onLoadMail: () => void;
  onLogout: () => void;
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
  onLoadMail, onLogout,
  logoutMessage,
  onRefresh, onMarkAsRead, onArchive, onLoadMore, isLoadingMore, hasMore, onSelectLabel,
  onSearch, isSearching, isRefreshing, labels, activeLabelId, activeLabelTotal,
}: LeftSidebarProps) {
  const router = useRouter();

  return (
    <aside className="flex h-full flex-col overflow-hidden p-4">
      {logoutMessage && (
        <div
          role="status"
          className="mb-3 shrink-0 rounded-lg border border-green-500/30 bg-green-500/10 dark:bg-green-500/15 px-3 py-2 text-xs text-green-700 dark:text-green-300"
        >
          {logoutMessage}
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
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
              onLoadMail={onLoadMail}
              loading={isLoading}
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
      </div>

      {/* ログイン中は常にダッシュボードを表示。Admin でない場合はダッシュボード側で「管理者権限が必要」と表示 */}
      {isLoggedIn && (
        <div className="mt-auto shrink-0 border-t border-border-default pt-3">
          <button
            onClick={() => router.push("/dashboard")}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-indigo-500/[0.06] hover:text-indigo-600 dark:hover:bg-indigo-400/[0.08] dark:hover:text-indigo-400"
          >
            <LayoutDashboard className="h-4 w-4" />
            <span className="font-medium">ダッシュボード</span>
          </button>
        </div>
      )}
    </aside>
  );
}
