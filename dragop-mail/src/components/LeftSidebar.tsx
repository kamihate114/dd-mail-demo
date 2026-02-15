"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, LayoutDashboard, Settings, HelpCircle, LogOut, ChevronDown, ChevronUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { MailLoginScreen } from "./MailLoginScreen";
import { MailInbox } from "./MailInbox";
import { EmailItem } from "@/lib/mockEmails";
import { GmailLabel } from "@/lib/gmail";
import { createClient } from "@/lib/supabase/client";

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
  onOpenSettings?: () => void;
}

export function LeftSidebar({
  isLoggedIn, isLoading, mailProvider, emails,
  selectedEmailId, onSelectEmail,
  onLoadMail, onLogout,
  logoutMessage,
  onRefresh, onMarkAsRead, onArchive, onLoadMore, isLoadingMore, hasMore, onSelectLabel,
  onSearch, isSearching, isRefreshing, labels, activeLabelId, activeLabelTotal,
  onOpenSettings,
}: LeftSidebarProps) {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [accountName, setAccountName] = useState<string | null>(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  // アカウント名（display_name またはメールの@前）と Admin 判定
  useEffect(() => {
    if (!isLoggedIn) {
      setIsAdmin(false);
      setAccountName(null);
      return;
    }
    let cancelled = false;
    async function checkAdmin(retryCount = 0) {
      try {
        const res = await fetch("/api/me/role", { cache: "no-store" });
        const data = await res.json();
        if (cancelled) return;
        const name = data?.display_name ?? (data?.email ? data.email.split("@")[0] : null);
        setAccountName(name ?? null);
        if (data?.role === "admin") {
          setIsAdmin(true);
          return;
        }
        if (retryCount < 1) {
          await new Promise((r) => setTimeout(r, 600));
          if (!cancelled) checkAdmin(1);
        } else {
          setIsAdmin(false);
        }
      } catch {
        if (!cancelled) setIsAdmin(false);
      }
    }
    checkAdmin(0);
    return () => { cancelled = true; };
  }, [isLoggedIn]);

  // 設定で表示名を更新したらアカウント名を再取得
  useEffect(() => {
    const handler = () => {
      if (!isLoggedIn) return;
      fetch("/api/me/role", { cache: "no-store" })
        .then((r) => r.json())
        .then((data) => {
          const name = data?.display_name ?? (data?.email ? data.email.split("@")[0] : null);
          setAccountName(name ?? null);
        })
        .catch(() => {});
    };
    window.addEventListener("account-updated", handler);
    return () => window.removeEventListener("account-updated", handler);
  }, [isLoggedIn]);

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

      {/* ログイン中: アカウントをクリックでメニュー表示 */}
      {isLoggedIn && (
        <div className="mt-auto shrink-0 border-t border-border-default pt-2">
          <AnimatePresence initial={false}>
            {accountMenuOpen && (
              <motion.nav
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col overflow-hidden"
              >
                {isAdmin && (
                  <>
                    <button
                      onClick={() => { router.push("/dashboard"); setAccountMenuOpen(false); }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-text-secondary transition-colors hover:bg-white/[0.06] hover:text-text-primary dark:hover:bg-white/[0.04]"
                    >
                      <LayoutDashboard className="h-4 w-4 shrink-0 text-text-muted" />
                      <span className="font-medium">ダッシュボード</span>
                    </button>
                    <div className="my-0.5 border-t border-border-default" />
                  </>
                )}
                <button
                  onClick={() => { onOpenSettings?.(); setAccountMenuOpen(false); }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-text-secondary transition-colors hover:bg-white/[0.06] hover:text-text-primary dark:hover:bg-white/[0.04]"
                >
                  <Settings className="h-4 w-4 shrink-0 text-text-muted" />
                  <span className="font-medium">設定</span>
                </button>
                <div className="my-0.5 border-t border-border-default" />
                <button
                  onClick={() => setAccountMenuOpen(false)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-text-secondary transition-colors hover:bg-white/[0.06] hover:text-text-primary dark:hover:bg-white/[0.04]"
                >
                  <HelpCircle className="h-4 w-4 shrink-0 text-text-muted" />
                  <span className="font-medium">ヘルプ</span>
                </button>
                <div className="my-0.5 border-t border-border-default" />
                <button
                  onClick={async () => {
                    setAccountMenuOpen(false);
                    onLogout();
                    const supabase = createClient();
                    await supabase.auth.signOut();
                    router.push("/login");
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-text-secondary transition-colors hover:bg-white/[0.06] hover:text-text-primary dark:hover:bg-white/[0.04]"
                >
                  <LogOut className="h-4 w-4 shrink-0 text-text-muted" />
                  <span className="font-medium">ログアウト</span>
                </button>
                <div className="my-0.5 border-t border-border-default" />
              </motion.nav>
            )}
          </AnimatePresence>
          <button
            type="button"
            onClick={() => setAccountMenuOpen((o) => !o)}
            className="mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-text-primary transition-colors hover:bg-white/[0.06] dark:hover:bg-white/[0.04]"
            aria-expanded={accountMenuOpen}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-sm font-bold text-white">
              {accountName ? accountName.slice(0, 1).toUpperCase() : "?"}
            </div>
            <p className="min-w-0 flex-1 truncate text-left text-sm font-medium">
              {accountName ?? "—"}
            </p>
            {accountMenuOpen ? (
              <ChevronUp className="h-4 w-4 shrink-0 text-text-muted" />
            ) : (
              <ChevronDown className="h-4 w-4 shrink-0 text-text-muted" />
            )}
          </button>
        </div>
      )}
    </aside>
  );
}
