"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Upload, HelpCircle, Sparkles, ArrowLeft } from "lucide-react";

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
}

export function MainEditor({ onMailLoaded, onAppleMailDrop }: MainEditorProps) {
  const [mailContent, setMailContent] = useState("");
  const [source, setSource] = useState("");
  const [showSparkle, setShowSparkle] = useState(false);
  const [externalDragOver, setExternalDragOver] = useState(false);
  // Track content origin: "paste" for typed/pasted/text-drop, "sidebar" for sidebar email D&D
  const [contentOrigin, setContentOrigin] = useState<"paste" | "sidebar" | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const hasContent = mailContent.trim().length > 0;

  const triggerSparkle = useCallback(() => {
    setShowSparkle(true);
    setTimeout(() => setShowSparkle(false), 600);
  }, []);

  const loadContent = useCallback((text: string, src: string) => {
    setMailContent(text);
    setSource(src);
    onMailLoaded(text, src);
    triggerSparkle();
  }, [onMailLoaded, triggerSparkle]);

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

  // Custom event for external drags
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

      // Internal sidebar drag with structured email data
      const emailJson = detail.data["application/x-dragop-email"];
      if (emailJson) {
        try {
          const email = JSON.parse(emailJson) as { sender: string; senderEmail: string; subject: string; body: string };
          const formatted = `件名: ${email.subject}\n差出人: ${email.sender} <${email.senderEmail}>\n\n${email.body}`;
          setContentOrigin("sidebar");
          loadContent(formatted, email.subject);
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
  }, [loadContent, onAppleMailDrop]);

  const isOver = isDragActive || externalDragOver;
  const rootProps = getRootProps();

  return (
    <div className="flex h-full flex-col">
      {/* Greeting */}
      <div className="mb-4 text-center">
        <h2 className="text-lg font-semibold text-text-primary">
          おかえりなさい！今日もお疲れ様でした。
        </h2>
      </div>

      {/* Editor card */}
      <div
        {...rootProps}
        data-dragop-zone
        className={`
          relative flex flex-1 flex-col rounded-2xl border transition-all duration-300
          ${showSparkle ? "animate-sparkle" : ""}
          ${isOver
            ? "border-brand-blue shadow-lg shadow-brand-blue/20 dark:shadow-brand-blue/10"
            : "border-border-default"
          }
          bg-surface-raised/80 dark:bg-surface-raised
        `}
      >
        <input {...getInputProps()} />

        <AnimatePresence mode="wait">
          {!hasContent ? (
            /* Drop zone guide */
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

              {/* Inline input hint */}
              <textarea
                ref={textareaRef}
                placeholder="またはメールを貼り付ける"
                value={mailContent}
                onChange={(e) => { setMailContent(e.target.value); setContentOrigin("paste"); }}
                className="mt-4 w-full max-w-md resize-none rounded-xl border border-border-default
                           bg-transparent px-4 py-3 text-sm text-text-primary text-center placeholder:text-text-muted
                           focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue/30
                           transition-colors"
                rows={3}
              />
            </motion.div>
          ) : (
            /* Content view */
            <motion.div
              key="content-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-1 flex-col"
            >
              {/* Content area */}
              <div className="flex-1 overflow-y-auto p-5">
                <textarea
                  value={mailContent}
                  onChange={(e) => setMailContent(e.target.value)}
                  className="h-full w-full resize-none bg-transparent text-sm leading-relaxed text-text-primary
                             placeholder:text-text-muted focus:outline-none"
                  placeholder="またはメールを貼り付ける"
                />
              </div>

              {/* Help icon */}
              <div className="absolute right-3 top-3">
                <button className="rounded-full p-1.5 text-text-muted hover:bg-border-default hover:text-text-primary transition-colors">
                  <HelpCircle className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom toolbar — show 解析 button only for pasted/typed content */}
        <AnimatePresence>
          {hasContent && contentOrigin === "paste" && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="flex items-center justify-end border-t border-border-default px-4 py-3">
                <button className="flex items-center gap-1.5 rounded-lg bg-brand-blue/10 px-3 py-1.5 text-xs font-medium text-brand-blue hover:bg-brand-blue/20 transition-colors dark:bg-brand-blue/15">
                  <Sparkles className="h-3.5 w-3.5" />
                  解析
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Progress dots */}
        {hasContent && (
          <div className="flex justify-center gap-1.5 pb-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-1.5 w-1.5 rounded-full bg-brand-blue" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
