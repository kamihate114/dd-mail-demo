"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Upload, HelpCircle, Sparkles } from "lucide-react";
import { AiWorkflowState, AiEmailContext } from "@/lib/ai-types";
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
}

export function MainEditor({
  onMailLoaded,
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
}: MainEditorProps) {
  const [mailContent, setMailContent] = useState("");
  const [source, setSource] = useState("");
  const [showSparkle, setShowSparkle] = useState(false);
  const [externalDragOver, setExternalDragOver] = useState(false);
  const [contentOrigin, setContentOrigin] = useState<"paste" | "sidebar" | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastEmailRef = useRef<AiEmailContext | null>(null);

  const hasContent = mailContent.trim().length > 0;
  const aiActive = aiState.step !== "idle";

  // 挨拶メッセージ：マウント時に1回だけランダム選択（リロードで変わる）
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

  useEffect(() => {
    const dragCounter = { current: 0 };

    const onDragEnter = (e: DragEvent) => {
      e.preventDefault();
      dragCounter.current++;
      if (dragCounter.current === 1) setExternalDragOver(true);
    };

    const onDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounter.current--;
      if (dragCounter.current <= 0) { dragCounter.current = 0; setExternalDragOver(false); }
    };

    const onCustomDrop = async (e: Event) => {
      dragCounter.current = 0;
      setExternalDragOver(false);
      const detail = (e as CustomEvent<DropDetail>).detail;
      if (detail.files.length > 0) return;

      const emailJson = detail.data["application/x-dragop-email"];
      if (emailJson) {
        try {
          const email = JSON.parse(emailJson) as { id?: string; sender: string; senderEmail: string; subject: string; body: string; threadId?: string; conversationId?: string };
          const formatted = `件名: ${email.subject}\n差出人: ${email.sender} <${email.senderEmail}>\n\n${email.body}`;
          setContentOrigin("sidebar");
          loadContent(formatted, email.subject);
          lastEmailRef.current = {
            sender: email.sender,
            senderEmail: email.senderEmail,
            subject: email.subject,
            body: email.body,
            emailId: email.id,
            threadId: email.threadId,
            conversationId: email.conversationId,
          };
          onAiAnalyze({
            sender: email.sender,
            senderEmail: email.senderEmail,
            subject: email.subject,
            body: email.body,
            emailId: email.id,
            threadId: email.threadId,
            conversationId: email.conversationId,
          });
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
  }, [loadContent, onAppleMailDrop, onAiAnalyze]);

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
  }, [onAiReset, onMailContentChange]);

  const isOver = isDragActive || externalDragOver;
  const rootProps = getRootProps();

  // Breathing border class for AI loading states
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

  return (
    <div className="flex h-full flex-col">
      {/* Greeting */}
      <div className="mb-4 text-center">
        <h2 className="text-lg font-semibold text-text-primary">
          {greeting}
        </h2>
      </div>

      {/* Editor card */}
      <div
        {...rootProps}
        data-dragop-zone
        className={`
          relative flex flex-1 flex-col rounded-2xl border transition-all duration-300
          ${showSparkle ? "animate-sparkle" : ""}
          ${breathingClass}
          ${isAiLoading
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
          {aiActive ? (
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
          {hasContent && !aiActive && contentOrigin === "paste" && (
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
        {(hasContent || aiActive) && (
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
    </div>
  );
}
