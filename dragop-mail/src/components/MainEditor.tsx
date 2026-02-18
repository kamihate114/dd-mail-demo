"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Upload, HelpCircle, Sparkles, Check, X, Loader2, Send, Save, ArrowLeft } from "lucide-react";
import { AiWorkflowState, AiEmailContext, DropZoneId, QuickReplyResponse } from "@/lib/ai-types";
import { AiPanel } from "@/components/AiPanel";
import { getGreeting } from "@/lib/greetings";

interface DropDetail {
  types: string[];
  files: File[];
  data: Record<string, string>;
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

interface MainEditorProps {
  onMailLoaded: (text: string, source: string) => void;
  onLoadThread?: (threadId?: string, conversationId?: string) => Promise<string | null>;
  onAppleMailDrop: (subject: string) => void;
  aiState: AiWorkflowState;
  onAiAnalyze: (emailContext: AiEmailContext) => void;
  onAiSelectAction: (actionPrompt: string) => void;
  onAiConfirm: (editedDraft: string) => void;
  onAiEditDraft: (draft: string) => void;
  onAiEditSubject: (subject: string) => void;
  onAiAddTodo: (candidate: { text: string; notes?: string }) => void;
  onAiAddEvent: (candidate: { title: string; date: string; startTime: string; endTime?: string }) => void;
  onAiSend: () => void;
  onAiSaveDraft: () => void;
  isSendingMail?: boolean;
  onAiReset: () => void;
  onAiBack: () => void;
  onMailContentChange: (content: string) => void;
  onQuickReplySend?: (to: string, subject: string, body: string, emailId?: string) => Promise<void>;
  onQuickReplySaveDraft?: (to: string, subject: string, body: string, emailId?: string) => Promise<void>;
}

export function MainEditor({
  onMailLoaded,
  onLoadThread,
  onAppleMailDrop,
  aiState,
  onAiAnalyze,
  onAiSelectAction,
  onAiConfirm,
  onAiEditDraft,
  onAiEditSubject,
  onAiAddTodo,
  onAiAddEvent,
  onAiSend,
  onAiSaveDraft,
  isSendingMail,
  onAiReset,
  onAiBack,
  onMailContentChange,
  onQuickReplySend,
  onQuickReplySaveDraft,
}: MainEditorProps) {
  const [mailContent, setMailContent] = useState("");
  const [source, setSource] = useState("");
  const [showSparkle, setShowSparkle] = useState(false);
  const [externalDragOver, setExternalDragOver] = useState(false);
  const [contentOrigin, setContentOrigin] = useState<"paste" | "sidebar" | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastEmailRef = useRef<AiEmailContext | null>(null);

  // Quick reply state
  const [quickReplyLoading, setQuickReplyLoading] = useState(false);
  const [quickReplyResult, setQuickReplyResult] = useState<QuickReplyResponse | null>(null);
  const [quickReplyDraftIndex, setQuickReplyDraftIndex] = useState(0);
  const [quickReplyEditedDraft, setQuickReplyEditedDraft] = useState("");
  const [quickReplyEditedSubject, setQuickReplyEditedSubject] = useState("");
  const [quickReplyEmailCtx, setQuickReplyEmailCtx] = useState<AiEmailContext | null>(null);
  const [quickReplySending, setQuickReplySending] = useState(false);

  // Drop zone hover tracking
  const [hoveredZone, setHoveredZone] = useState<DropZoneId | null>(null);
  const [isEmailDrag, setIsEmailDrag] = useState(false);
  const dropZoneRefs = useRef<Record<DropZoneId, HTMLDivElement | null>>({
    "drop-yes": null,
    "drop-no": null,
    "drop-default": null,
  });

  const hasContent = mailContent.trim().length > 0;
  const aiActive = aiState.step !== "idle";
  const quickReplyActive = quickReplyLoading || quickReplyResult !== null;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const greeting = useMemo(() => getGreeting(), []);

  const triggerSparkle = useCallback(() => {
    setShowSparkle(true);
    setTimeout(() => setShowSparkle(false), 600);
  }, []);

  const loadContent = useCallback((text: string, src: string) => {
    setMailContent(text);
    setSource(src);
    onMailLoaded(text, src);
    onMailContentChange(text);
    triggerSparkle();
  }, [onMailLoaded, onMailContentChange, triggerSparkle]);

  const handleFile = useCallback(async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext === "eml" || ext === "txt") {
      try {
        const text = await readFileAsText(file);
        setContentOrigin("paste");
        loadContent(text, file.name);
      } catch {
        alert("ファイルの読み込みに失敗しました。");
      }
    } else if (ext === "pdf") {
      alert("PDF対応はPhase 2で実装予定です。");
    } else {
      alert(`未対応のファイル形式です: .${ext}`);
    }
  }, [loadContent]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (files) => { if (files.length > 0) handleFile(files[0]); },
    noClick: true,
    noKeyboard: true,
    multiple: false,
    accept: { "message/rfc822": [".eml"], "text/plain": [".txt"] },
  });

  // Quick reply API call
  const callQuickReplyApi = useCallback(async (dropZone: DropZoneId, emailContext: AiEmailContext) => {
    setQuickReplyLoading(true);
    setQuickReplyResult(null);
    setQuickReplyEmailCtx(emailContext);
    try {
      const res = await fetch("/api/ai/quick-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dropZone, emailContext }),
      });
      const data: QuickReplyResponse = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || `API error: ${res.status}`);
      }
      setQuickReplyResult(data);
      setQuickReplyDraftIndex(0);
      setQuickReplyEditedDraft(data.draftReplies[0] || "");
      setQuickReplyEditedSubject(data.replySubject || "");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`クイック返信の生成に失敗しました: ${msg}`);
      setQuickReplyResult(null);
      setQuickReplyEmailCtx(null);
    } finally {
      setQuickReplyLoading(false);
    }
  }, []);

  // Determine which drop zone the mouse is over during drag
  const getDropZoneFromPoint = useCallback((x: number, y: number): DropZoneId | null => {
    for (const id of ["drop-yes", "drop-default", "drop-no"] as DropZoneId[]) {
      const el = dropZoneRefs.current[id];
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        return id;
      }
    }
    return null;
  }, []);

  // Track mouse position during drag for zone detection
  useEffect(() => {
    if (!externalDragOver) {
      setHoveredZone(null);
      return;
    }

    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
      const zone = getDropZoneFromPoint(e.clientX, e.clientY);
      setHoveredZone(zone);
    };

    document.addEventListener("dragover", onDragOver, true);
    return () => document.removeEventListener("dragover", onDragOver, true);
  }, [externalDragOver, getDropZoneFromPoint]);

  useEffect(() => {
    const dragCounter = { current: 0 };

    const onDragEnter = (e: DragEvent) => {
      e.preventDefault();
      dragCounter.current++;
      if (dragCounter.current === 1) {
        // メールドラッグかどうかをタイプリストで判定
        const types = e.dataTransfer?.types ?? [];
        const emailDrag = Array.from(types).includes("application/x-dragop-email");
        setIsEmailDrag(emailDrag);
        setExternalDragOver(true);
      }
    };

    const onDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounter.current--;
      if (dragCounter.current <= 0) { dragCounter.current = 0; setIsEmailDrag(false); setExternalDragOver(false); }
    };

    const onCustomDrop = async (e: Event) => {
      const currentHoveredZone = hoveredZoneRef.current;
      dragCounter.current = 0;
      setExternalDragOver(false);
      setIsEmailDrag(false);
      setHoveredZone(null);
      const detail = (e as CustomEvent<DropDetail>).detail;
      if (detail.files.length > 0) return;

      const emailJson = detail.data["application/x-dragop-email"];
      if (emailJson) {
        try {
          const email = JSON.parse(emailJson) as { id?: string; sender: string; senderEmail: string; subject: string; body: string; threadId?: string; conversationId?: string };

          const emailCtx: AiEmailContext = {
            sender: email.sender,
            senderEmail: email.senderEmail,
            subject: email.subject,
            body: email.body,
            emailId: email.id,
            threadId: email.threadId,
            conversationId: email.conversationId,
          };

          // Check if dropped on Yes or No zone → quick reply
          if (currentHoveredZone === "drop-yes" || currentHoveredZone === "drop-no") {
            lastEmailRef.current = emailCtx;
            const formatted = `件名: ${email.subject}\n差出人: ${email.sender} <${email.senderEmail}>\n\n${email.body}`;
            setContentOrigin("sidebar");
            loadContent(formatted, email.subject);
            callQuickReplyApi(currentHoveredZone, emailCtx);
            return;
          }

          // Default zone or no zone → existing analysis flow
          if (onLoadThread && (email.threadId || email.conversationId)) {
            try {
              const threadText = await onLoadThread(email.threadId, email.conversationId);
              if (threadText) {
                setContentOrigin("sidebar");
                loadContent(threadText, email.subject);
                lastEmailRef.current = emailCtx;
                onAiAnalyze(emailCtx);
                return;
              }
            } catch { /* fall back to single email */ }
          }
          const formatted = `件名: ${email.subject}\n差出人: ${email.sender} <${email.senderEmail}>\n\n${email.body}`;
          setContentOrigin("sidebar");
          loadContent(formatted, email.subject);
          lastEmailRef.current = emailCtx;
          onAiAnalyze(emailCtx);
          return;
        } catch { /* fall through */ }
      }

      if (detail.data["text/html"]) {
        const doc = new DOMParser().parseFromString(detail.data["text/html"], "text/html");
        const plain = doc.body.textContent || "";
        if (plain.trim()) { setContentOrigin("paste"); loadContent(plain.trim(), "メールからドラッグ (HTML)"); return; }
      }

      const hasUri = !!detail.data["text/uri-list"]?.startsWith("message:");
      const plainText = detail.data["text/plain"]?.trim() || "";

      if (hasUri && plainText) { onAppleMailDrop(plainText); return; }
      if (plainText) { setContentOrigin("paste"); loadContent(plainText, "メールからドラッグ"); return; }
      if (detail.data["text/uri-list"]) { setContentOrigin("paste"); loadContent(`[メールリンク] ${detail.data["text/uri-list"]}`, "メールからドラッグ (URI)"); }
    };

    document.addEventListener("dragenter", onDragEnter, true);
    document.addEventListener("dragleave", onDragLeave, true);
    window.addEventListener("dragop-drop", onCustomDrop);
    return () => {
      document.removeEventListener("dragenter", onDragEnter, true);
      document.removeEventListener("dragleave", onDragLeave, true);
      window.removeEventListener("dragop-drop", onCustomDrop);
    };
  }, [loadContent, onAppleMailDrop, onAiAnalyze, onLoadThread, callQuickReplyApi]);

  // Keep hoveredZone accessible in the drop handler via ref
  const hoveredZoneRef = useRef<DropZoneId | null>(null);
  useEffect(() => { hoveredZoneRef.current = hoveredZone; }, [hoveredZone]);

  const handleAnalyzeClick = useCallback(() => {
    const lines = mailContent.split("\n");
    let sender = "";
    let senderEmail = "";
    let subject = "";
    let bodyStart = 0;

    for (let i = 0; i < Math.min(lines.length, 10); i++) {
      const line = lines[i];
      const subjectMatch = line.match(/^(?:件名|Subject)\s*[:：]\s*(.+)/i);
      if (subjectMatch) { subject = subjectMatch[1].trim(); bodyStart = Math.max(bodyStart, i + 1); continue; }
      const fromMatch = line.match(/^(?:差出人|From)\s*[:：]\s*(.+)/i);
      if (fromMatch) {
        const fromStr = fromMatch[1].trim();
        const emailMatch = fromStr.match(/<([^>]+)>/);
        if (emailMatch) {
          senderEmail = emailMatch[1];
          sender = fromStr.replace(/<[^>]+>/, "").trim();
        } else {
          senderEmail = fromStr;
          sender = fromStr;
        }
        bodyStart = Math.max(bodyStart, i + 1);
        continue;
      }
      if (line.trim() === "" && bodyStart > 0) { bodyStart = Math.max(bodyStart, i + 1); break; }
    }

    const body = lines.slice(bodyStart).join("\n").trim() || mailContent;

    onAiAnalyze({
      sender: sender || "不明",
      senderEmail: senderEmail || "",
      subject: subject || source || "（件名なし）",
      body,
    });
  }, [mailContent, source, onAiAnalyze]);

  const handleAiReset = useCallback(() => {
    setMailContent("");
    setSource("");
    setContentOrigin(null);
    lastEmailRef.current = null;
    onMailContentChange("");
    onAiReset();
    // Also reset quick reply
    setQuickReplyResult(null);
    setQuickReplyEmailCtx(null);
    setQuickReplyLoading(false);
  }, [onAiReset, onMailContentChange]);

  const handleQuickReplySend = useCallback(async () => {
    if (!onQuickReplySend || !quickReplyEmailCtx) return;
    setQuickReplySending(true);
    try {
      await onQuickReplySend(
        quickReplyEmailCtx.senderEmail,
        quickReplyEditedSubject,
        quickReplyEditedDraft,
        quickReplyEmailCtx.emailId,
      );
      handleAiReset();
      alert("メールを送信しました。");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`メールの送信に失敗しました。\n\n${msg}`);
    } finally {
      setQuickReplySending(false);
    }
  }, [onQuickReplySend, quickReplyEmailCtx, quickReplyEditedSubject, quickReplyEditedDraft, handleAiReset]);

  const handleQuickReplySaveDraft = useCallback(async () => {
    if (!onQuickReplySaveDraft || !quickReplyEmailCtx) return;
    setQuickReplySending(true);
    try {
      await onQuickReplySaveDraft(
        quickReplyEmailCtx.senderEmail,
        quickReplyEditedSubject,
        quickReplyEditedDraft,
        quickReplyEmailCtx.emailId,
      );
      handleAiReset();
      alert("下書きとして保存しました。");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`下書きの保存に失敗しました。\n\n${msg}`);
    } finally {
      setQuickReplySending(false);
    }
  }, [onQuickReplySaveDraft, quickReplyEmailCtx, quickReplyEditedSubject, quickReplyEditedDraft, handleAiReset]);

  // Select a different draft (for default zone with multiple)
  const selectDraft = useCallback((index: number) => {
    if (!quickReplyResult) return;
    setQuickReplyDraftIndex(index);
    setQuickReplyEditedDraft(quickReplyResult.draftReplies[index] || "");
  }, [quickReplyResult]);

  const isOver = isDragActive || externalDragOver;
  const rootProps = getRootProps();

  const breathingClass =
    aiState.step === "step1-loading" ? "ai-breathing ai-breathing-step1"
    : aiState.step === "step2-loading" ? "ai-breathing ai-breathing-step2"
    : "";
  const isAiLoading = !!breathingClass;

  const stepIndex = (() => {
    if (aiState.step === "idle") return 0;
    if (aiState.step === "step1-loading" || aiState.step === "step1") return 1;
    if (aiState.step === "step2-loading" || aiState.step === "step2") return 2;
    if (aiState.step === "step3-loading" || aiState.step === "step3") return 3;
    return 0;
  })();

  // Show 3-column drop zones when no content/AI/quickReply active (常時表示)
  const showDropZones = !hasContent && !aiActive && !quickReplyActive;

  return (
    <div className="flex h-full flex-col">
      {/* Greeting */}
      <div className="mb-4 text-center">
        <h2 className="text-lg font-semibold text-text-primary">
          {greeting}
        </h2>
      </div>

      {/* 3-column drop zones OR main editor card */}
      <AnimatePresence mode="wait">
        {showDropZones ? (
          <motion.div
            key="drop-zones"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.2 }}
            className="flex flex-1 gap-3"
          >
            {/* Left: Yes (20%) */}
            <motion.div
              ref={(el) => { dropZoneRefs.current["drop-yes"] = el; }}
              id="drop-yes"
              data-drop-zone="drop-yes"
              animate={{
                scale: hoveredZone === "drop-yes" ? 1.03 : 1,
                y: hoveredZone === "drop-yes" ? -4 : 0,
              }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className={`
                flex w-[20%] flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-colors duration-200
                ${hoveredZone === "drop-yes"
                  ? "border-emerald-500 bg-emerald-500/10 shadow-lg shadow-emerald-500/10"
                  : "border-emerald-500/40 bg-emerald-500/5"
                }
              `}
            >
              <motion.div
                animate={{
                  scale: hoveredZone === "drop-yes" ? 1.2 : 1,
                }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className={`
                  mb-3 flex h-12 w-12 items-center justify-center rounded-xl transition-colors duration-200
                  ${hoveredZone === "drop-yes" ? "bg-emerald-500/25" : "bg-emerald-500/15"}
                `}
              >
                <Check className={`h-6 w-6 transition-colors ${hoveredZone === "drop-yes" ? "text-emerald-500" : "text-emerald-500/70"}`} />
              </motion.div>
              <p className={`text-sm font-bold transition-colors ${hoveredZone === "drop-yes" ? "text-emerald-600 dark:text-emerald-400" : "text-emerald-600/70 dark:text-emerald-400/70"}`}>
                Yes（承諾）
              </p>
              <p className="mt-1 text-[10px] text-text-muted">快諾して進める</p>
            </motion.div>

            {/* Center: Default (60%) */}
            <motion.div
              ref={(el) => { dropZoneRefs.current["drop-default"] = el; }}
              id="drop-default"
              data-drop-zone="drop-default"
              data-dragop-zone
              animate={{
                scale: hoveredZone === "drop-default" ? 1.02 : 1,
                y: hoveredZone === "drop-default" ? -4 : 0,
              }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className={`
                flex w-[60%] flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-colors duration-200
                ${hoveredZone === "drop-default"
                  ? "border-brand-blue bg-brand-blue/10 shadow-lg shadow-brand-blue/10"
                  : "border-brand-blue/40 bg-brand-blue/5"
                }
              `}
            >
              <motion.div
                animate={{
                  scale: hoveredZone === "drop-default" ? 1.15 : 1,
                }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className={`
                  mb-3 flex h-14 w-14 items-center justify-center rounded-xl transition-colors duration-200
                  ${hoveredZone === "drop-default" ? "bg-brand-blue/20" : "bg-brand-blue/10"}
                `}
              >
                {isOver && isEmailDrag ? (
                  <Upload className="h-6 w-6 text-brand-blue" />
                ) : (
                  <Mail className="h-6 w-6 text-brand-blue/70" />
                )}
              </motion.div>
              <p className={`text-base font-bold transition-colors ${hoveredZone === "drop-default" ? "text-brand-blue" : "text-brand-blue/70"}`}>
                🔍 要約・おまかせ
              </p>
              <p className="mt-1 text-xs text-text-muted">
                {isOver && isEmailDrag ? "ここにドロップ" : "メールをドラッグ＆ドロップ"}
              </p>
              {/* テキスト貼り付けエリア（ドラッグ中は非表示） */}
              {!isOver && (
                <div className="mt-4 w-full max-w-xs" onClick={(e) => e.stopPropagation()}>
                  <textarea
                    ref={textareaRef}
                    placeholder="またはメールを貼り付ける"
                    value={mailContent}
                    onChange={(e) => {
                      setMailContent(e.target.value);
                      setContentOrigin("paste");
                      onMailContentChange(e.target.value);
                    }}
                    className="w-full resize-none rounded-xl border border-border-default
                               bg-surface/80 dark:bg-surface-raised/80 px-4 py-3 text-sm text-text-primary text-center
                               placeholder:text-text-muted focus:border-brand-blue focus:outline-none
                               focus:ring-1 focus:ring-brand-blue/30 transition-colors"
                    rows={3}
                  />
                  {mailContent.trim() && contentOrigin === "paste" && (
                    <div className="mt-2 flex justify-center">
                      <button
                        onClick={handleAnalyzeClick}
                        className="flex items-center gap-1.5 rounded-lg bg-brand-blue/10 px-3 py-1.5 text-xs font-medium text-brand-blue hover:bg-brand-blue/20 transition-colors"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        解析
                      </button>
                    </div>
                  )}
                </div>
              )}
            </motion.div>

            {/* Right: No (20%) */}
            <motion.div
              ref={(el) => { dropZoneRefs.current["drop-no"] = el; }}
              id="drop-no"
              data-drop-zone="drop-no"
              animate={{
                scale: hoveredZone === "drop-no" ? 1.03 : 1,
                y: hoveredZone === "drop-no" ? -4 : 0,
              }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className={`
                flex w-[20%] flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-colors duration-200
                ${hoveredZone === "drop-no"
                  ? "border-rose-500 bg-rose-500/10 shadow-lg shadow-rose-500/10"
                  : "border-rose-500/40 bg-rose-500/5"
                }
              `}
            >
              <motion.div
                animate={{
                  scale: hoveredZone === "drop-no" ? 1.2 : 1,
                }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className={`
                  mb-3 flex h-12 w-12 items-center justify-center rounded-xl transition-colors duration-200
                  ${hoveredZone === "drop-no" ? "bg-rose-500/25" : "bg-rose-500/15"}
                `}
              >
                <X className={`h-6 w-6 transition-colors ${hoveredZone === "drop-no" ? "text-rose-500" : "text-rose-500/70"}`} />
              </motion.div>
              <p className={`text-sm font-bold transition-colors ${hoveredZone === "drop-no" ? "text-rose-600 dark:text-rose-400" : "text-rose-600/70 dark:text-rose-400/70"}`}>
                No（お断り）
              </p>
              <p className="mt-1 text-[10px] text-text-muted">丁寧にお断り</p>
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            key="editor-card"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-1 flex-col"
          >
            {/* Editor card */}
            <div
              {...rootProps}
              data-dragop-zone
              className={`
                relative flex flex-1 flex-col rounded-2xl border transition-all duration-300
                ${showSparkle ? "animate-sparkle" : ""}
                ${breathingClass}
                ${quickReplyLoading ? "ai-breathing ai-breathing-step1" : ""}
                ${isAiLoading || quickReplyLoading
                  ? "border-transparent"
                  : isOver
                    ? "border-brand-blue shadow-lg shadow-brand-blue/20 dark:shadow-brand-blue/10"
                    : "border-border-default"
                }
                bg-surface-raised/80 dark:bg-surface-raised
              `}
            >
              <input {...getInputProps()} />

              <AnimatePresence mode="wait">
                {/* Quick reply loading */}
                {quickReplyLoading ? (
                  <motion.div
                    key="quick-reply-loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-1 flex-col items-center justify-center gap-4 p-8"
                  >
                    <div className="relative">
                      <Loader2 className="h-8 w-8 animate-spin text-brand-blue" />
                      <Sparkles className="absolute -right-1 -top-1 h-4 w-4 text-brand-blue/60" />
                    </div>
                    <p className="text-sm text-text-secondary text-center">
                      AI が返信案を作成しています...
                    </p>
                  </motion.div>
                ) : quickReplyResult ? (
                  /* Quick reply result — compose view */
                  <motion.div
                    key="quick-reply-result"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-1 flex-col"
                  >
                    {/* Summary card */}
                    <div className="border-b border-border-default px-4 py-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="h-4 w-4 text-brand-blue" />
                        <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                          {quickReplyResult.tone}
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed text-text-secondary whitespace-pre-line">
                        {quickReplyResult.summary}
                      </p>
                    </div>

                    {/* Draft selection (for default zone with multiple drafts) */}
                    {quickReplyResult.draftReplies.length > 1 && (
                      <div className="flex gap-1.5 border-b border-border-default px-4 py-2">
                        {quickReplyResult.draftReplies.map((_, i) => (
                          <button
                            key={i}
                            onClick={() => selectDraft(i)}
                            className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                              i === quickReplyDraftIndex
                                ? "bg-brand-blue/15 text-brand-blue"
                                : "text-text-muted hover:bg-border-default hover:text-text-primary"
                            }`}
                          >
                            {i === 0 ? "前向き" : i === 1 ? "確認・検討" : "お断り"}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Compose header */}
                    {quickReplyEmailCtx && (
                      <div className="space-y-0 border-b border-border-default">
                        <div className="flex items-center gap-2 border-b border-border-default/50 px-4 py-2">
                          <span className="text-xs text-text-muted shrink-0">宛先</span>
                          <span className="text-xs text-brand-blue">
                            {quickReplyEmailCtx.sender} &lt;{quickReplyEmailCtx.senderEmail}&gt;
                          </span>
                        </div>
                        <div className="flex items-center gap-2 px-4 py-2">
                          <span className="text-xs text-text-muted shrink-0">件名</span>
                          <input
                            type="text"
                            value={quickReplyEditedSubject}
                            onChange={(e) => setQuickReplyEditedSubject(e.target.value)}
                            className="flex-1 bg-transparent text-sm text-text-primary focus:outline-none"
                          />
                        </div>
                      </div>
                    )}

                    {/* Body editor */}
                    <div className="flex-1 overflow-y-auto p-4">
                      <textarea
                        value={quickReplyEditedDraft}
                        onChange={(e) => setQuickReplyEditedDraft(e.target.value)}
                        className="h-full w-full resize-none bg-transparent text-sm leading-relaxed text-text-primary
                                   placeholder:text-text-muted focus:outline-none"
                        placeholder="返信本文を編集..."
                      />
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between border-t border-border-default px-4 py-2.5">
                      <button
                        onClick={handleAiReset}
                        className="flex items-center gap-1 text-xs text-text-muted hover:text-text-primary transition-colors"
                      >
                        <ArrowLeft className="h-3.5 w-3.5" />
                        戻る
                      </button>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleQuickReplySaveDraft}
                          disabled={quickReplySending}
                          className="flex items-center gap-1.5 rounded-lg border border-border-default px-3 py-2 text-xs font-medium text-text-secondary
                                     hover:bg-border-default transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {quickReplySending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                          下書き保存
                        </button>
                        <button
                          onClick={handleQuickReplySend}
                          disabled={quickReplySending}
                          className="flex items-center gap-1.5 rounded-lg bg-teal px-4 py-2 text-sm font-medium text-white
                                     hover:bg-teal/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {quickReplySending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                          送信
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ) : aiActive ? (
                  <motion.div
                    key="ai-panel"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-1 flex-col"
                  >
                    <AiPanel
                      aiState={aiState}
                      onSelectAction={onAiSelectAction}
                      onConfirm={onAiConfirm}
                      onEditDraft={onAiEditDraft}
                      onEditSubject={onAiEditSubject}
                      onAddTodo={onAiAddTodo}
                      onAddEvent={onAiAddEvent}
                      onSend={onAiSend}
                      onSaveDraft={onAiSaveDraft}
                      isSendingMail={isSendingMail}
                      onReset={handleAiReset}
                      onBack={onAiBack}
                    />
                  </motion.div>
                ) : !hasContent ? (
                  <motion.div
                    key="drop-guide"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="flex flex-1 flex-col items-center justify-center p-8"
                  >
                    <motion.div
                      animate={{ scale: isOver ? 1.15 : 1 }}
                      transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    >
                      <div className={`
                        mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl transition-colors duration-300
                        ${isOver ? "bg-brand-blue/20" : "bg-brand-blue/10 dark:bg-brand-blue/15"}
                      `}>
                        {isOver ? (
                          <Upload className="h-6 w-6 text-brand-blue" />
                        ) : (
                          <Mail className="h-6 w-6 text-brand-blue" />
                        )}
                      </div>
                    </motion.div>

                    <p className="text-sm font-medium text-text-secondary">
                      {isOver ? "ドロップしてください" : "解析するメールをドラッグ＆ドロップ"}
                    </p>

                    <textarea
                      ref={textareaRef}
                      placeholder="またはメールを貼り付ける"
                      value={mailContent}
                      onChange={(e) => {
                        setMailContent(e.target.value);
                        setContentOrigin("paste");
                        onMailContentChange(e.target.value);
                      }}
                      className="mt-4 w-full max-w-md resize-none rounded-xl border border-border-default
                                 bg-transparent px-4 py-3 text-sm text-text-primary text-center placeholder:text-text-muted
                                 focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue/30
                                 transition-colors"
                      rows={3}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="content-view"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-1 flex-col"
                  >
                    <div className="flex-1 overflow-y-auto p-5">
                      <textarea
                        value={mailContent}
                        onChange={(e) => {
                          setMailContent(e.target.value);
                          onMailContentChange(e.target.value);
                        }}
                        className="h-full w-full resize-none bg-transparent text-sm leading-relaxed text-text-primary
                                   placeholder:text-text-muted focus:outline-none"
                        placeholder="またはメールを貼り付ける"
                      />
                    </div>

                    <div className="absolute right-3 top-3">
                      <button className="rounded-full p-1.5 text-text-muted hover:bg-border-default hover:text-text-primary transition-colors">
                        <HelpCircle className="h-4 w-4" />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Bottom toolbar */}
              <AnimatePresence>
                {hasContent && !aiActive && !quickReplyActive && contentOrigin === "paste" && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="flex items-center justify-end border-t border-border-default px-4 py-3">
                      <button
                        onClick={handleAnalyzeClick}
                        className="flex items-center gap-1.5 rounded-lg bg-brand-blue/10 px-3 py-1.5 text-xs font-medium text-brand-blue hover:bg-brand-blue/20 transition-colors dark:bg-brand-blue/15"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        解析
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Progress dots */}
              {(hasContent || aiActive) && !quickReplyActive && (
                <div className="flex justify-center gap-1.5 pb-3">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        i === stepIndex
                          ? "w-4 bg-brand-blue"
                          : i < stepIndex
                          ? "w-1.5 bg-brand-blue/60"
                          : "w-1.5 bg-brand-blue/20"
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
