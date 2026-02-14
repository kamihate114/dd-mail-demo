"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  ListTodo,
  AlertTriangle,
  CheckCircle2,
  Plus,
  ArrowLeft,
  Loader2,
  Send,
  ClipboardCheck,
  FileText,
  Save,
  MessageSquarePlus,
  User,
  AtSign,
  CalendarPlus,
  Zap,
  Clock,
  Target,
  Info,
} from "lucide-react";
import {
  AiWorkflowState,
  AiStep1Result,
  AiStep3Result,
} from "@/lib/ai-types";

/* ================================================================
   Props
   ================================================================ */

interface AiPanelProps {
  aiState: AiWorkflowState;
  onSelectAction: (actionPrompt: string) => void;
  onConfirm: (editedDraft: string) => void;
  onEditDraft: (draft: string) => void;
  onEditSubject: (subject: string) => void;
  onAddTodo: (candidate: { text: string; notes?: string }) => void;
  onAddEvent: (candidate: { title: string; date: string; startTime: string; endTime?: string }) => void;
  onSend: () => void;
  onSaveDraft: () => void;
  isSendingMail?: boolean;
  onReset: () => void;
  onBack: () => void;
}

/* ================================================================
   Shared
   ================================================================ */

function LoadingView({ message, messages }: { message?: string; messages?: string[] }) {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const displayMessages = messages || [message || "処理中..."];

  useEffect(() => {
    if (!messages || messages.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentMessageIndex((prev) => (prev + 1) % messages.length);
    }, 3000); // 3秒ごとにメッセージを切り替え

    return () => clearInterval(interval);
  }, [messages]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-1 flex-col items-center justify-center gap-4 p-8"
    >
      <div className="relative">
        <Loader2 className="h-8 w-8 animate-spin text-brand-blue" />
        <Sparkles className="absolute -right-1 -top-1 h-4 w-4 text-brand-blue/60" />
      </div>
      <AnimatePresence mode="wait">
        <motion.p
          key={currentMessageIndex}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          className="text-sm text-text-secondary text-center"
        >
          {displayMessages[currentMessageIndex]}
        </motion.p>
      </AnimatePresence>
    </motion.div>
  );
}

function ErrorView({ error, onReset }: { error: string; onReset: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-1 flex-col items-center justify-center gap-4 p-8"
    >
      <AlertTriangle className="h-8 w-8 text-red-500" />
      <p className="text-center text-sm text-text-secondary">{error}</p>
      <button
        onClick={onReset}
        className="rounded-lg bg-brand-blue/10 px-4 py-2 text-sm font-medium text-brand-blue hover:bg-brand-blue/20 transition-colors"
      >
        やり直す
      </button>
    </motion.div>
  );
}

/* ================================================================
   Email compose header (shared by Step2 & Step3)
   ================================================================ */

function ComposeHeader({
  emailContext,
  subject,
  onEditSubject,
}: {
  emailContext: { sender: string; senderEmail: string };
  subject: string;
  onEditSubject: (s: string) => void;
}) {
  return (
    <div className="space-y-0 border-b border-border-default">
      {/* To */}
      <div className="flex items-center gap-2 border-b border-border-default/50 px-4 py-2">
        <span className="flex items-center gap-1 text-xs text-text-muted shrink-0">
          <User className="h-3.5 w-3.5" />
          宛先
        </span>
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-md bg-brand-blue/10 px-2 py-0.5 text-xs text-brand-blue">
            <AtSign className="h-3 w-3" />
            {emailContext.sender}
            <span className="text-brand-blue/60">&lt;{emailContext.senderEmail}&gt;</span>
          </span>
        </div>
      </div>
      {/* Subject */}
      <div className="flex items-center gap-2 px-4 py-2">
        <span className="flex items-center gap-1 text-xs text-text-muted shrink-0">
          <FileText className="h-3.5 w-3.5" />
          件名
        </span>
        <input
          type="text"
          value={subject}
          onChange={(e) => onEditSubject(e.target.value)}
          className="flex-1 bg-transparent text-sm text-text-primary focus:outline-none"
        />
      </div>
    </div>
  );
}

/* ================================================================
   Step 1: AI Analysis (no original mail — that's shown externally)
   ================================================================ */

/* ── Status badge helper ── */
const STATUS_STYLES: Record<string, { bg: string; text: string; icon: typeof Zap }> = {
  "緊急":   { bg: "bg-red-500/15 dark:bg-red-500/20", text: "text-red-600 dark:text-red-400", icon: Zap },
  "要返信": { bg: "bg-amber-500/15 dark:bg-amber-500/20", text: "text-amber-600 dark:text-amber-400", icon: Send },
  "確認のみ": { bg: "bg-sky-500/15 dark:bg-sky-500/20", text: "text-sky-600 dark:text-sky-400", icon: Info },
  "対応不要": { bg: "bg-emerald-500/15 dark:bg-emerald-500/20", text: "text-emerald-600 dark:text-emerald-400", icon: CheckCircle2 },
};

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES["確認のみ"];
  const Icon = style.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${style.bg} ${style.text}`}>
      <Icon className="h-3 w-3" />
      {status}
    </span>
  );
}

function Step1View({
  result,
  onSelectAction,
  onReset,
}: {
  result: AiStep1Result;
  onSelectAction: (prompt: string) => void;
  onReset: () => void;
}) {
  const [customInput, setCustomInput] = useState("");
  const [isComposing, setIsComposing] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="flex flex-1 flex-col overflow-hidden"
    >
      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* ── AI Summary Card ── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="ai-summary-card bg-surface-raised dark:bg-white/[0.03] p-4 space-y-3"
        >
          {/* Card header: headline + status badge */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles className="h-4 w-4 shrink-0 text-indigo-500 dark:text-indigo-400" />
              <h2 className="text-lg font-bold text-text-primary truncate leading-tight">
                {result.headline || "メール分析"}
              </h2>
            </div>
            <StatusBadge status={result.status || "確認のみ"} />
          </div>

          {/* Structured summary: situation / expected action / time */}
          <div className="space-y-2">
            {/* 状況 */}
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-indigo-500/10 dark:bg-indigo-500/15">
                <Info className="h-3 w-3 text-indigo-500 dark:text-indigo-400" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-text-muted/70 mb-0.5">状況</div>
                <p className="text-sm leading-relaxed text-text-secondary">
                  {result.structuredSummary?.situation || result.summary}
                </p>
              </div>
            </div>

            {/* 期待されるアクション */}
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-violet-500/10 dark:bg-violet-500/15">
                <Target className="h-3 w-3 text-violet-500 dark:text-violet-400" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-text-muted/70 mb-0.5">期待されるアクション</div>
                <p className="text-sm leading-relaxed text-text-secondary">
                  {result.structuredSummary?.expectedAction || "内容をご確認ください。"}
                </p>
              </div>
            </div>

            {/* 所要時間（あれば） */}
            {result.structuredSummary?.estimatedTime && (
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-fuchsia-500/10 dark:bg-fuchsia-500/15">
                  <Clock className="h-3 w-3 text-fuchsia-500 dark:text-fuchsia-400" />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-text-muted/70 mb-0.5">所要時間</div>
                  <p className="text-sm leading-relaxed text-text-secondary">
                    {result.structuredSummary.estimatedTime}
                  </p>
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* ── Extracted Todos ── */}
        {result.extractedTodos.length > 0 && (
          <div>
            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-text-muted uppercase tracking-wider">
              <ListTodo className="h-3.5 w-3.5" />
              相手からのToDo
            </div>
            <ul className="space-y-1">
              {result.extractedTodos.map((todo, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-text-primary">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-blue" />
                  {todo}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ── Action Suggestions ── */}
        <div>
          <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-text-muted uppercase tracking-wider">
            <Send className="h-3.5 w-3.5" />
            次のアクション
          </div>
          <div className="flex flex-wrap gap-2">
            {result.suggestedActions.map((action, i) => (
              <button
                key={i}
                onClick={() => onSelectAction(action.prompt)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  i === result.suggestedActions.length - 1
                    ? "border-red-300/30 bg-red-50/50 text-red-600 hover:bg-red-100/50 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-400 dark:hover:bg-red-400/20"
                    : "border-brand-blue/20 bg-brand-blue/5 text-brand-blue hover:bg-brand-blue/10 hover:border-brand-blue/40 dark:bg-brand-blue/10 dark:hover:bg-brand-blue/20"
                }`}
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Custom input ── */}
        <div>
          <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-text-muted uppercase tracking-wider">
            <MessageSquarePlus className="h-3.5 w-3.5" />
            カスタム入力
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={() => setIsComposing(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isComposing && customInput.trim()) {
                  onSelectAction(customInput.trim());
                  setCustomInput("");
                }
              }}
              placeholder="独自の返信方針を入力..."
              className="flex-1 rounded-lg border border-border-default bg-transparent px-3 py-2 text-sm text-text-primary
                         placeholder:text-text-muted focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue/30 transition-colors"
            />
            <button
              onClick={() => {
                if (customInput.trim()) {
                  onSelectAction(customInput.trim());
                  setCustomInput("");
                }
              }}
              disabled={!customInput.trim()}
              className="rounded-lg bg-brand-blue/10 px-3 py-2 text-sm font-medium text-brand-blue hover:bg-brand-blue/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-border-default px-4 py-2.5">
        <button
          onClick={onReset}
          className="flex items-center gap-1 text-xs text-text-muted hover:text-text-primary transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          戻る
        </button>
        <div className="text-xs text-text-muted">Step 1 / 3</div>
      </div>
    </motion.div>
  );
}

/* ================================================================
   Step 2: Email Compose with Send/Draft buttons
   ================================================================ */

function Step2View({
  emailContext,
  subject,
  draft,
  onEditSubject,
  onEditDraft,
  onConfirm,
  onSend,
  onSaveDraft,
  isSendingMail,
  onBack,
}: {
  emailContext: { sender: string; senderEmail: string };
  subject: string;
  draft: string;
  onEditSubject: (s: string) => void;
  onEditDraft: (d: string) => void;
  onConfirm: (d: string) => void;
  onSend: () => void;
  onSaveDraft: () => void;
  isSendingMail?: boolean;
  onBack: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="flex flex-1 flex-col"
    >
      <ComposeHeader emailContext={emailContext} subject={subject} onEditSubject={onEditSubject} />

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4">
        <textarea
          value={draft}
          onChange={(e) => onEditDraft(e.target.value)}
          className="h-full w-full resize-none bg-transparent text-sm leading-relaxed text-text-primary
                     placeholder:text-text-muted focus:outline-none"
          placeholder="メール本文を入力..."
        />
      </div>

      {/* Footer with send/draft/confirm */}
      <div className="flex items-center justify-between border-t border-border-default px-4 py-2.5">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-xs text-text-muted hover:text-text-primary transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          戻る
        </button>
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-muted">Step 2 / 3</span>
          <button
            onClick={onSaveDraft}
            disabled={isSendingMail}
            className="flex items-center gap-1.5 rounded-lg border border-border-default px-3 py-2 text-xs font-medium text-text-secondary
                       hover:bg-border-default transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSendingMail ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            下書き保存
          </button>
          <button
            onClick={onSend}
            disabled={isSendingMail}
            className="flex items-center gap-1.5 rounded-lg bg-teal px-3 py-2 text-xs font-medium text-white
                       hover:bg-teal/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSendingMail ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            送信
          </button>
          <button
            onClick={() => onConfirm(draft)}
            disabled={isSendingMail}
            className="flex items-center gap-1.5 rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white
                       hover:bg-brand-blue/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ClipboardCheck className="h-4 w-4" />
            最終確認
          </button>
        </div>
      </div>
    </motion.div>
  );
}

/* ================================================================
   Step 3: Email Compose only (sidebar is external)
   ================================================================ */

function Step3ComposeView({
  emailContext,
  subject,
  draft,
  onEditSubject,
  onEditDraft,
  onSend,
  onSaveDraft,
  isSendingMail,
  onBack,
}: {
  emailContext: { sender: string; senderEmail: string };
  subject: string;
  draft: string;
  onEditSubject: (s: string) => void;
  onEditDraft: (d: string) => void;
  onSend: () => void;
  onSaveDraft: () => void;
  isSendingMail?: boolean;
  onBack: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="flex flex-1 flex-col"
    >
      <ComposeHeader emailContext={emailContext} subject={subject} onEditSubject={onEditSubject} />

      <div className="flex-1 overflow-y-auto p-4">
        <textarea
          value={draft}
          onChange={(e) => onEditDraft(e.target.value)}
          className="h-full w-full resize-none bg-transparent text-sm leading-relaxed text-text-primary focus:outline-none"
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-border-default px-4 py-2.5">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-xs text-text-muted hover:text-text-primary transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          戻る
        </button>
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-muted">Step 3 / 3</span>
          <button
            onClick={onSaveDraft}
            disabled={isSendingMail}
            className="flex items-center gap-1.5 rounded-lg border border-border-default px-3 py-2 text-xs font-medium text-text-secondary
                       hover:bg-border-default transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSendingMail ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            下書き保存
          </button>
          <button
            onClick={onSend}
            disabled={isSendingMail}
            className="flex items-center gap-1.5 rounded-lg bg-teal px-4 py-2 text-sm font-medium text-white
                       hover:bg-teal/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSendingMail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            送信
          </button>
        </div>
      </div>
    </motion.div>
  );
}

/* ================================================================
   Step 3 Sidebar (exported for use by MainEditor)
   ================================================================ */

export function Step3Sidebar({
  result,
  isLoading,
  onAddTodo,
  onAddEvent,
}: {
  result: AiStep3Result | null;
  isLoading: boolean;
  onAddTodo: (c: { text: string; notes?: string }) => void;
  onAddEvent: (c: { title: string; date: string; startTime: string; endTime?: string }) => void;
}) {
  const [addedTodos, setAddedTodos] = useState<Set<number>>(new Set());
  const [addedEvents, setAddedEvents] = useState<Set<number>>(new Set());
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);

  const loadingMessages = [
    "プロの校正者の視点で、誤字脱字を徹底スキャンしています...",
    "二重敬語や不自然な日本語がないか、最終精査中です...",
    "ビジネス文書として、相手に失礼のない品格があるか確認しています...",
    "返信内容から、あなたがやるべきタスクを洗い出しています...",
    "期限が設定された依頼事項を、ToDoリスト化しています...",
    "文中の日付や時間を検知し、カレンダー登録の準備をしています...",
    "あなたの信頼を守るため、細部まで磨きをかけています...",
    "まもなく最終チェック結果をお届けします...",
  ];

  useEffect(() => {
    if (!isLoading) return;

    const interval = setInterval(() => {
      setCurrentMessageIndex((prev) => (prev + 1) % loadingMessages.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [isLoading, loadingMessages.length]);

  const handleAddTodo = (c: { text: string; notes?: string }, i: number) => {
    onAddTodo(c);
    setAddedTodos((prev) => new Set(prev).add(i));
  };

  const handleAddEvent = (c: { title: string; date: string; startTime: string; endTime?: string }, i: number) => {
    onAddEvent(c);
    setAddedEvents((prev) => new Set(prev).add(i));
  };

  const checkIcon = (type: string) => {
    if (type === "typo") return <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />;
    if (type === "keigo") return <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />;
    return <AlertTriangle className="h-3.5 w-3.5 text-red-500" />;
  };

  const checkLabel = (type: string) => {
    if (type === "typo") return "誤字脱字";
    if (type === "keigo") return "敬語";
    return "情報不足";
  };

  if (isLoading) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-4">
        <div className="relative">
          <Loader2 className="h-6 w-6 animate-spin text-brand-blue" />
          <Sparkles className="absolute -right-1 -top-1 h-3 w-3 text-brand-blue/60" />
        </div>
        <AnimatePresence mode="wait">
          <motion.p
            key={currentMessageIndex}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="text-xs text-text-secondary text-center px-2"
          >
            {loadingMessages[currentMessageIndex]}
          </motion.p>
        </AnimatePresence>
      </div>
    );
  }

  if (!result) return null;

  return (
    <div className="h-full overflow-y-auto space-y-3 p-3">
      {/* Todo Candidates */}
      {result.todoCandidates.length > 0 && (
        <div className="rounded-xl border border-border-default/50 bg-gray-100 dark:bg-slate-900/30 p-3">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-text-muted/90 uppercase tracking-wider">
            <ListTodo className="h-3.5 w-3.5" />
            ToDo候補
          </div>
          <ul className="space-y-1.5">
            {result.todoCandidates.map((c, i) => (
              <li key={i} className="flex items-center gap-2 rounded-lg bg-white dark:bg-surface/40 p-2">
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-text-secondary/90 truncate">{c.text}</div>
                  {c.notes && <div className="mt-0.5 text-[10px] text-text-muted/80 truncate">{c.notes}</div>}
                </div>
                {addedTodos.has(i) ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-teal" />
                ) : (
                  <button
                    onClick={() => handleAddTodo(c, i)}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-teal/10 text-teal hover:bg-teal/20 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Calendar Candidates */}
      {result.calendarCandidates.length > 0 && (
        <div className="rounded-xl border border-border-default/50 bg-gray-100 dark:bg-slate-900/30 p-3">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-text-muted/90 uppercase tracking-wider">
            <CalendarPlus className="h-3.5 w-3.5" />
            カレンダー候補
          </div>
          <ul className="space-y-1.5">
            {result.calendarCandidates.map((c, i) => (
              <li key={i} className="flex items-center gap-2 rounded-lg bg-white dark:bg-surface/40 p-2">
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-text-secondary/90 truncate">{c.title}</div>
                  <div className="mt-0.5 text-[10px] text-text-muted/80">
                    {c.date} {c.startTime}{c.endTime ? ` - ${c.endTime}` : ""}
                  </div>
                </div>
                {addedEvents.has(i) ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-teal" />
                ) : (
                  <button
                    onClick={() => handleAddEvent(c, i)}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand-blue/10 text-brand-blue hover:bg-brand-blue/20 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Checks */}
      <div className="rounded-xl border border-border-default/50 bg-gray-100 dark:bg-slate-900/30 p-3">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-text-muted/90 uppercase tracking-wider">
          <ClipboardCheck className="h-3.5 w-3.5" />
          最終チェック
        </div>
        {result.checks.length > 0 ? (
          <ul className="space-y-1.5">
            {result.checks.map((c, i) => (
              <li key={i} className="flex items-start gap-2 rounded-lg bg-white dark:bg-surface/40 p-2">
                {checkIcon(c.type)}
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-medium text-text-muted/80">{checkLabel(c.type)}</div>
                  <div className="text-xs text-text-secondary/90">{c.message}</div>
                  {c.suggestion && (
                    <div className="mt-0.5 text-[10px] text-teal/90">{c.suggestion}</div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex items-center gap-2 rounded-lg bg-teal/5 p-2">
            <CheckCircle2 className="h-4 w-4 text-teal" />
            <span className="text-xs text-teal">問題なし</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ================================================================
   Main Panel
   ================================================================ */

export function AiPanel({
  aiState,
  onSelectAction,
  onConfirm,
  onEditDraft,
  onEditSubject,
  onSend,
  onSaveDraft,
  isSendingMail,
  onReset,
  onBack,
}: AiPanelProps) {
  const emailCtx = aiState.emailContext
    ? { sender: aiState.emailContext.sender, senderEmail: aiState.emailContext.senderEmail }
    : { sender: "", senderEmail: "" };

  return (
    <AnimatePresence mode="wait">
      {aiState.error && (
        <ErrorView key="error" error={aiState.error} onReset={onReset} />
      )}

      {aiState.step === "step1-loading" && (
        <LoadingView
          key="loading1"
          messages={[
            "メールの重要ポイントをスキャンしています...",
            "送り主が最も伝えたいことを読み取っています...",
            "文脈から緊急度と重要度を判定しています...",
            "返信が必要な項目をピックアップしています...",
            "期限や具体的なタスクを整理しています...",
            "あなたが次に取るべきアクションを特定中です...",
            "パッと見て理解できる形式に整えています...",
          ]}
        />
      )}

      {aiState.step === "step1" && aiState.step1Result && (
        <Step1View
          key="step1"
          result={aiState.step1Result}
          onSelectAction={onSelectAction}
          onReset={onReset}
        />
      )}

      {aiState.step === "step2-loading" && (
        <LoadingView
          key="loading2"
          messages={[
            "選択された返信方針に基づき、構成を組み立てています...",
            "ご希望のニュアンスに合わせた最適な表現を検討中です...",
            "あなたの意図を、プロフェッショナルな文章へ変換しています...",
            "信頼関係を深める、誠実な言い回しを考案中です...",
            "一文を短く、読みやすいリズムに整えています...",
            "誤字脱字や、不自然な表現がないか最終精査しています...",
            "あなたの『右腕』として、完璧な下書きに仕上げています...",
            "まもなく、返信案をご提示します...",
          ]}
        />
      )}

      {aiState.step === "step2" && (
        <Step2View
          key="step2"
          emailContext={emailCtx}
          subject={aiState.editedSubject || aiState.step2Result?.replySubject || ""}
          draft={aiState.editedDraft || aiState.step2Result?.draftReply || ""}
          onEditSubject={onEditSubject}
          onEditDraft={onEditDraft}
          onConfirm={onConfirm}
          onSend={onSend}
          onSaveDraft={onSaveDraft}
          isSendingMail={isSendingMail}
          onBack={onBack}
        />
      )}

      {/* Step 3 loading + Step 3 done: both show compose (center keeps email visible) */}
      {(aiState.step === "step3-loading" || aiState.step === "step3") && (
        <Step3ComposeView
          key="step3-compose"
          emailContext={emailCtx}
          subject={aiState.editedSubject || aiState.step2Result?.replySubject || ""}
          draft={aiState.editedDraft || aiState.step2Result?.draftReply || ""}
          onEditSubject={onEditSubject}
          onEditDraft={onEditDraft}
          onSend={onSend}
          onSaveDraft={onSaveDraft}
          isSendingMail={isSendingMail}
          onBack={onBack}
        />
      )}
    </AnimatePresence>
  );
}
