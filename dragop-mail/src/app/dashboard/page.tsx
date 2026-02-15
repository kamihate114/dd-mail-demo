"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Copy,
  Check,
  Shield,
  ShieldCheck,
  UserMinus,
  Users,
  Link2,
  RefreshCw,
  Crown,
  Loader2,
  X,
  AlertTriangle,
  CreditCard,
} from "lucide-react";
import {
  fetchDashboardData,
  promoteToAdmin,
  removeMember,
  regenerateInviteUrl,
  type MemberRow,
  type DashboardData,
} from "./actions";

/* ── ユーティリティ ── */
function getInitials(email: string): string {
  const local = email.split("@")[0] ?? "";
  return local.slice(0, 2).toUpperCase();
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("ja-JP", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(iso));
  } catch {
    return "—";
  }
}

/* ── 確認モーダル ── */
function ConfirmModal({
  open,
  title,
  message,
  confirmLabel,
  danger,
  onConfirm,
  onCancel,
  loading,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="mx-4 w-full max-w-sm rounded-2xl border border-border-default bg-surface-raised p-6 shadow-xl"
      >
        <div className="mb-1 flex items-center gap-2">
          {danger && <AlertTriangle className="h-5 w-5 text-red-500" />}
          <h3 className="text-base font-semibold text-text-primary">{title}</h3>
        </div>
        <p className="mb-5 text-sm text-text-secondary">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border border-border-default px-4 py-2 text-sm text-text-secondary transition-colors hover:bg-surface"
          >
            キャンセル
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors ${
              danger
                ? "bg-red-500 hover:bg-red-600"
                : "bg-indigo-500 hover:bg-indigo-600"
            }`}
          >
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* ── メンバー行（デスクトップ） ── */
function MemberTableRow({
  member,
  isSelf,
  onPromote,
  onRemove,
}: {
  member: MemberRow;
  isSelf: boolean;
  onPromote: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const isAdmin = member.role === "admin";
  return (
    <tr className="group border-b border-border-default transition-colors last:border-b-0 hover:bg-indigo-500/[0.03] dark:hover:bg-indigo-400/[0.04]">
      {/* Avatar + Email */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
              isAdmin
                ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300"
                : "bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300"
            }`}
          >
            {getInitials(member.email)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-text-primary">
              {member.email}
            </p>
            {isSelf && (
              <span className="text-[10px] text-text-muted">（あなた）</span>
            )}
          </div>
        </div>
      </td>
      {/* Role badge */}
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
            isAdmin
              ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300"
              : "bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-400"
          }`}
        >
          {isAdmin ? (
            <>
              <Crown className="h-3 w-3" /> Admin
            </>
          ) : (
            <>
              <Shield className="h-3 w-3" /> Member
            </>
          )}
        </span>
      </td>
      {/* Joined */}
      <td className="px-4 py-3 text-xs text-text-muted">{formatDate(member.created_at)}</td>
      {/* Actions */}
      <td className="px-4 py-3 text-right">
        {!isSelf && (
          <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            {!isAdmin && (
              <button
                onClick={() => onPromote(member.id)}
                className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400"
                title="管理者に昇格"
              >
                <ShieldCheck className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={() => onRemove(member.id)}
              className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-red-500/10 hover:text-red-500"
              title="組織から削除"
            >
              <UserMinus className="h-4 w-4" />
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

/* ── メンバーカード（モバイル） ── */
function MemberCard({
  member,
  isSelf,
  onPromote,
  onRemove,
}: {
  member: MemberRow;
  isSelf: boolean;
  onPromote: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const isAdmin = member.role === "admin";
  return (
    <div className="rounded-xl border border-border-default bg-surface-raised p-4 transition-colors hover:border-indigo-500/20">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
              isAdmin
                ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300"
                : "bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300"
            }`}
          >
            {getInitials(member.email)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-text-primary">
              {member.email}
            </p>
            <div className="mt-1 flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  isAdmin
                    ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300"
                    : "bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-400"
                }`}
              >
                {isAdmin ? <Crown className="h-2.5 w-2.5" /> : <Shield className="h-2.5 w-2.5" />}
                {isAdmin ? "Admin" : "Member"}
              </span>
              <span className="text-[10px] text-text-muted">{formatDate(member.created_at)}</span>
              {isSelf && <span className="text-[10px] text-text-muted">（あなた）</span>}
            </div>
          </div>
        </div>
      </div>
      {!isSelf && (
        <div className="mt-3 flex items-center gap-2 border-t border-border-default pt-3">
          {!isAdmin && (
            <button
              onClick={() => onPromote(member.id)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border-default px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:border-indigo-500/30 hover:text-indigo-600 dark:hover:text-indigo-400"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              管理者に昇格
            </button>
          )}
          <button
            onClick={() => onRemove(member.id)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border-default px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:border-red-500/30 hover:text-red-500"
          >
            <UserMinus className="h-3.5 w-3.5" />
            削除
          </button>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════
   ダッシュボードページ
   ══════════════════════════════════════════ */
export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // 確認モーダル
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    type: "promote" | "remove";
    memberId: string;
    memberEmail: string;
  }>({ open: false, type: "promote", memberId: "", memberEmail: "" });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchDashboardData();
      if (result.error) {
        setError(result.error);
        if (result.error === "管理者権限が必要です" || result.error === "未ログイン") {
          router.push("/");
        }
      } else {
        setData(result);
      }
    } catch {
      setError("データの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [router]);

  // 現在のユーザーID取得
  useEffect(() => {
    async function getUser() {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
    }
    getUser();
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCopy = useCallback(async () => {
    if (!data?.inviteUrl) return;
    await navigator.clipboard.writeText(data.inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [data?.inviteUrl]);

  const handleRegenerate = useCallback(async () => {
    setActionLoading(true);
    try {
      const result = await regenerateInviteUrl();
      if (result.inviteUrl && data) {
        setData({ ...data, inviteUrl: result.inviteUrl });
      }
    } finally {
      setActionLoading(false);
    }
  }, [data]);

  const openPromoteModal = (id: string) => {
    const member = data?.members.find((m) => m.id === id);
    if (member) {
      setConfirmModal({ open: true, type: "promote", memberId: id, memberEmail: member.email });
    }
  };

  const openRemoveModal = (id: string) => {
    const member = data?.members.find((m) => m.id === id);
    if (member) {
      setConfirmModal({ open: true, type: "remove", memberId: id, memberEmail: member.email });
    }
  };

  const handleConfirm = useCallback(async () => {
    setActionLoading(true);
    try {
      if (confirmModal.type === "promote") {
        const result = await promoteToAdmin(confirmModal.memberId);
        if (result.error) {
          setError(result.error);
        }
      } else {
        const result = await removeMember(confirmModal.memberId);
        if (result.error) {
          setError(result.error);
        }
      }
      setConfirmModal({ ...confirmModal, open: false });
      await loadData();
    } finally {
      setActionLoading(false);
    }
  }, [confirmModal, loadData]);

  /* ── Loading State ── */
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
          <p className="text-sm text-text-muted">読み込み中...</p>
        </div>
      </div>
    );
  }

  /* ── Error State ── */
  if (error && !data) {
    const isTenantMissing = error === "テナント未設定";
    return (
      <div className="flex h-screen items-center justify-center bg-surface">
        <div className="flex flex-col items-center gap-5 text-center px-4">
          <div className="rounded-full bg-red-100 p-3 dark:bg-red-500/20">
            <X className="h-6 w-6 text-red-500" />
          </div>
          <div>
            <p className="text-sm font-medium text-text-primary">{error}</p>
            {isTenantMissing && (
              <p className="mt-1 text-xs text-text-muted">
                組織または個人の設定がまだ完了していません
              </p>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full max-w-xs">
            {isTenantMissing && (
              <button
                onClick={() => router.push("/onboarding")}
                className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600"
              >
                設定を完了する
              </button>
            )}
            <button
              onClick={() => router.push("/")}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                isTenantMissing
                  ? "border border-border-default text-text-secondary hover:bg-surface-raised"
                  : "bg-indigo-500 text-white hover:bg-indigo-600"
              }`}
            >
              ホームに戻る
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const adminCount = data.members.filter((m) => m.role === "admin").length;
  const memberCount = data.members.filter((m) => m.role !== "admin").length;

  return (
    <div className="min-h-screen bg-surface">
      {/* ── Confirm Modal ── */}
      <AnimatePresence>
        <ConfirmModal
          open={confirmModal.open}
          title={
            confirmModal.type === "promote"
              ? "管理者に昇格"
              : "メンバーを削除"
          }
          message={
            confirmModal.type === "promote"
              ? `${confirmModal.memberEmail} を管理者に昇格しますか？管理者はメンバーの管理が可能になります。`
              : `${confirmModal.memberEmail} を組織から削除しますか？この操作は取り消せません。`
          }
          confirmLabel={confirmModal.type === "promote" ? "昇格する" : "削除する"}
          danger={confirmModal.type === "remove"}
          onConfirm={handleConfirm}
          onCancel={() => setConfirmModal({ ...confirmModal, open: false })}
          loading={actionLoading}
        />
      </AnimatePresence>

      {/* ── Error toast ── */}
      <AnimatePresence>
        {error && data && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-xl border border-red-500/20 bg-red-50 px-4 py-2.5 text-sm text-red-700 shadow-lg dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              {error}
              <button onClick={() => setError(null)} className="ml-2 rounded p-0.5 hover:bg-red-100 dark:hover:bg-red-500/20">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Header ── */}
      <header className="sticky top-0 z-40 border-b border-border-default bg-surface/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/")}
              className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-surface-raised hover:text-text-primary"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-lg font-semibold text-text-primary">ダッシュボード</h1>
              <p className="text-xs text-text-muted">{data.tenantName}</p>
            </div>
          </div>
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-border-default px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-raised"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            更新
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        {/* ── Stats ── */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          <div className="rounded-xl border border-border-default bg-surface-raised p-4">
            <div className="flex items-center gap-2 text-text-muted">
              <CreditCard className="h-4 w-4 text-indigo-500" />
              <span className="text-xs">購入済みシート</span>
            </div>
            <p className="mt-1 text-2xl font-bold text-text-primary">
              {data.seatCount ?? "—"}
            </p>
          </div>
          <div className="rounded-xl border border-border-default bg-surface-raised p-4">
            <div className="flex items-center gap-2 text-text-muted">
              <Users className="h-4 w-4" />
              <span className="text-xs">合計メンバー</span>
            </div>
            <p className="mt-1 text-2xl font-bold text-text-primary">{data.members.length}</p>
          </div>
          <div className="rounded-xl border border-border-default bg-surface-raised p-4">
            <div className="flex items-center gap-2 text-text-muted">
              <Crown className="h-4 w-4 text-indigo-500" />
              <span className="text-xs">管理者</span>
            </div>
            <p className="mt-1 text-2xl font-bold text-text-primary">{adminCount}</p>
          </div>
          <div className="rounded-xl border border-border-default bg-surface-raised p-4">
            <div className="flex items-center gap-2 text-text-muted">
              <Shield className="h-4 w-4 text-teal" />
              <span className="text-xs">メンバー</span>
            </div>
            <p className="mt-1 text-2xl font-bold text-text-primary">{memberCount}</p>
          </div>
        </div>

        {/* ── Invite URL Card ── */}
        <div className="mb-6 overflow-hidden rounded-xl border border-border-default bg-surface-raised">
          <div className="border-b border-border-default px-5 py-4">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-indigo-100 p-1.5 dark:bg-indigo-500/20">
                <Link2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-text-primary">メンバーを招待</h2>
                <p className="text-xs text-text-muted">このURLを共有して新しいメンバーを招待できます</p>
              </div>
            </div>
          </div>
          <div className="px-5 py-4">
            {data.inviteUrlError && (
              <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{data.inviteUrlError}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <div className="flex-1 overflow-hidden rounded-lg border border-border-default bg-surface px-3 py-2.5">
                <p className="truncate font-mono text-xs text-text-secondary">
                  {data.inviteUrl || (data.inviteUrlError ? "—" : "招待URLを生成中...")}
                </p>
              </div>
              <button
                onClick={handleCopy}
                disabled={!data.inviteUrl}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-4 py-2.5 text-xs font-medium text-white transition-all ${
                  copied
                    ? "bg-green-500"
                    : "bg-indigo-500 hover:bg-indigo-600"
                }`}
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    コピー
                  </>
                )}
              </button>
              <button
                onClick={handleRegenerate}
                disabled={actionLoading}
                className="shrink-0 rounded-lg border border-border-default p-2.5 text-text-muted transition-colors hover:bg-surface hover:text-text-secondary"
                title="新しいURLを生成"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${actionLoading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>
        </div>

        {/* ── Members Section ── */}
        <div className="overflow-hidden rounded-xl border border-border-default bg-surface-raised">
          <div className="border-b border-border-default px-5 py-4">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-violet-100 p-1.5 dark:bg-violet-500/20">
                <Users className="h-4 w-4 text-violet-600 dark:text-violet-400" />
              </div>
              <h2 className="text-sm font-semibold text-text-primary">メンバー管理</h2>
              <span className="ml-auto rounded-full bg-surface px-2 py-0.5 text-xs text-text-muted">
                {data.members.length}名
              </span>
            </div>
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-default bg-surface/50">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-text-muted">ユーザー</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-text-muted">権限</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-text-muted">参加日</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-text-muted">操作</th>
                </tr>
              </thead>
              <tbody>
                {data.members.map((member) => (
                  <MemberTableRow
                    key={member.id}
                    member={member}
                    isSelf={member.id === userId}
                    onPromote={openPromoteModal}
                    onRemove={openRemoveModal}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="flex flex-col gap-3 p-4 sm:hidden">
            {data.members.map((member) => (
              <MemberCard
                key={member.id}
                member={member}
                isSelf={member.id === userId}
                onPromote={openPromoteModal}
                onRemove={openRemoveModal}
              />
            ))}
          </div>

          {data.members.length === 0 && (
            <div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
              <Users className="h-10 w-10 text-text-muted/30" />
              <p className="text-sm text-text-muted">まだメンバーがいません</p>
              <p className="text-xs text-text-muted">招待URLを共有してメンバーを追加しましょう</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
