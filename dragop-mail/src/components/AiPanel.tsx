"use client";

import { useState } from "react";
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
  onReset: () => void;
  onBack: () => void;
}

/* ================================================================
   Shared
   ================================================================ */

function LoadingView({ message }: { message: string }) {
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
      <p className="text-sm text-text-secondary">{message}</p>
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="flex flex-1 flex-col overflow-hidden"
    >
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Summary */}
        <div>
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-text-muted uppercase tracking-wider">
            <Sparkles className="h-3.5 w-3.5" />
            要約
          </div>
          <p className="text-sm leading-relaxed text-text-primary">{result.summary}</p>
        </div>

        {/* Extracted Todos */}
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

        {/* Action Suggestions */}
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

        {/* Custom input */}
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
              onKeyDown={(e) => {
                if (e.key === "Enter" && customInput.trim()) {
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
            className="flex items-center gap-1.5 rounded-lg border border-border-default px-3 py-2 text-xs font-medium text-text-secondary
                       hover:bg-border-default transition-colors"
          >
            <Save className="h-3.5 w-3.5" />
            下書き保存
          </button>
          <button
            onClick={onSend}
            className="flex items-center gap-1.5 rounded-lg bg-teal px-3 py-2 text-xs font-medium text-white
                       hover:bg-teal/90 transition-colors"
          >
            <Send className="h-3.5 w-3.5" />
            送信
          </button>
          <button
            onClick={() => onConfirm(draft)}
            className="flex items-center gap-1.5 rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white
                       hover:bg-brand-blue/90 transition-colors"
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
  onBack,
}: {
  emailContext: { sender: string; senderEmail: string };
  subject: string;
  draft: string;
  onEditSubject: (s: string) => void;
  onEditDraft: (d: string) => void;
  onSend: () => void;
  onSaveDraft: () => void;
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
            className="flex items-center gap-1.5 rounded-lg border border-border-default px-3 py-2 text-xs font-medium text-text-secondary
                       hover:bg-border-default transition-colors"
          >
            <Save className="h-3.5 w-3.5" />
            下書き保存
          </button>
          <button
            onClick={onSend}
            className="flex items-center gap-1.5 rounded-lg bg-teal px-4 py-2 text-sm font-medium text-white
                       hover:bg-teal/90 transition-colors"
          >
            <Send className="h-4 w-4" />
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
        <p className="text-xs text-text-secondary">最終チェック中...</p>
      </div>
    );
  }

  if (!result) return null;

  return (
    <div className="h-full overflow-y-auto space-y-3 p-3">
      {/* Todo Candidates */}
      {result.todoCandidates.length > 0 && (
        <div className="rounded-xl border border-border-default p-3">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-text-muted uppercase tracking-wider">
            <ListTodo className="h-3.5 w-3.5" />
            ToDo候補
          </div>
          <ul className="space-y-1.5">
            {result.todoCandidates.map((c, i) => (
              <li key={i} className="flex items-center gap-2 rounded-lg bg-surface/60 p-2">
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-text-primary truncate">{c.text}</div>
                  {c.notes && <div className="mt-0.5 text-[10px] text-text-muted truncate">{c.notes}</div>}
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
        <div className="rounded-xl border border-border-default p-3">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-text-muted uppercase tracking-wider">
            <CalendarPlus className="h-3.5 w-3.5" />
            カレンダー候補
          </div>
          <ul className="space-y-1.5">
            {result.calendarCandidates.map((c, i) => (
              <li key={i} className="flex items-center gap-2 rounded-lg bg-surface/60 p-2">
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-text-primary truncate">{c.title}</div>
                  <div className="mt-0.5 text-[10px] text-text-muted">
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
      <div className="rounded-xl border border-border-default p-3">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-text-muted uppercase tracking-wider">
          <ClipboardCheck className="h-3.5 w-3.5" />
          最終チェック
        </div>
        {result.checks.length > 0 ? (
          <ul className="space-y-1.5">
            {result.checks.map((c, i) => (
              <li key={i} className="flex items-start gap-2 rounded-lg bg-surface/60 p-2">
                {checkIcon(c.type)}
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-medium text-text-muted">{checkLabel(c.type)}</div>
                  <div className="text-xs text-text-primary">{c.message}</div>
                  {c.suggestion && (
                    <div className="mt-0.5 text-[10px] text-teal">{c.suggestion}</div>
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
        <LoadingView key="loading1" message="メールを分析中..." />
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
        <LoadingView key="loading2" message="返信案を生成中..." />
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
          onBack={onBack}
        />
      )}
    </AnimatePresence>
  );
}
