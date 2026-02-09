"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { motion } from "framer-motion";
import { Mail, Upload } from "lucide-react";

interface DropDetail {
  types: string[];
  files: File[];
  data: Record<string, string>;
}

interface DropZoneProps {
  onFileDrop: (file: File) => void;
  onTextDrop: (text: string, source: string) => void;
  onAppleMailDrop: (subject: string) => void;
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export function DropZone({ onFileDrop, onTextDrop, onAppleMailDrop }: DropZoneProps) {
  const [showSparkle, setShowSparkle] = useState(false);
  const [externalDragOver, setExternalDragOver] = useState(false);
  const dragCounterRef = useRef(0);

  const triggerSparkle = useCallback(() => {
    setShowSparkle(true);
    setTimeout(() => setShowSparkle(false), 600);
  }, []);

  const handleFile = useCallback(async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();

    if (ext === "pdf") {
      alert("PDF対応はPhase 2で実装予定です。.eml または .txt ファイルをご利用ください。");
      return;
    }

    if (ext === "eml" || ext === "txt") {
      try {
        const text = await readFileAsText(file);
        onFileDrop(file);
        onTextDrop(text, file.name);
        triggerSparkle();
      } catch {
        alert("ファイルの読み込みに失敗しました。");
      }
      return;
    }

    alert(`未対応のファイル形式です: .${ext}`);
  }, [onFileDrop, onTextDrop, triggerSparkle]);

  // react-dropzone for file-based drops
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (files) => {
      if (files.length > 0) handleFile(files[0]);
    },
    noClick: false,
    noKeyboard: false,
    multiple: false,
    accept: {
      "message/rfc822": [".eml"],
      "text/plain": [".txt"],
    },
  });

  // Listen for custom event from layout.tsx inline script (Apple Mail, text drops)
  useEffect(() => {
    const dragCounter = { current: 0 };

    const onDragEnter = (e: DragEvent) => {
      e.preventDefault();
      dragCounter.current++;
      if (dragCounter.current === 1) {
        setExternalDragOver(true);
      }
    };

    const onDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounter.current--;
      if (dragCounter.current <= 0) {
        dragCounter.current = 0;
        setExternalDragOver(false);
      }
    };

    const onCustomDrop = async (e: Event) => {
      dragCounter.current = 0;
      setExternalDragOver(false);

      const detail = (e as CustomEvent<DropDetail>).detail;

      // Skip if files (handled by react-dropzone)
      if (detail.files.length > 0) return;

      // text/html
      if (detail.data["text/html"]) {
        const doc = new DOMParser().parseFromString(detail.data["text/html"], "text/html");
        const plain = doc.body.textContent || "";
        if (plain.trim()) {
          onTextDrop(plain.trim(), "メールからドラッグ (HTML)");
          triggerSparkle();
          return;
        }
      }

      // Apple Mail: text/plain (subject) + message: URI
      const hasUri = !!detail.data["text/uri-list"]?.startsWith("message:");
      const plainText = detail.data["text/plain"]?.trim() || "";

      if (hasUri && plainText) {
        onAppleMailDrop(plainText);
        return;
      }

      // Plain text
      if (plainText) {
        onTextDrop(plainText, "メールからドラッグ");
        triggerSparkle();
        return;
      }

      // URI only
      if (detail.data["text/uri-list"]) {
        onTextDrop(`[メールリンク] ${detail.data["text/uri-list"]}`, "メールからドラッグ (URI)");
        triggerSparkle();
        return;
      }
    };

    document.addEventListener("dragenter", onDragEnter, true);
    document.addEventListener("dragleave", onDragLeave, true);
    window.addEventListener("dragop-drop", onCustomDrop);

    return () => {
      document.removeEventListener("dragenter", onDragEnter, true);
      document.removeEventListener("dragleave", onDragLeave, true);
      window.removeEventListener("dragop-drop", onCustomDrop);
    };
  }, [onTextDrop, onAppleMailDrop, triggerSparkle]);

  const isOver = isDragActive || externalDragOver;

  // Separate dropzone props from motion to avoid type conflicts
  const rootProps = getRootProps();

  return (
    <div {...rootProps} className="relative">
      <input {...getInputProps()} />
      <motion.div
        animate={{ scale: isOver ? 1.02 : 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className={`
          cursor-pointer rounded-2xl border-2 border-dashed
          px-8 py-20 text-center transition-colors duration-300
          ${showSparkle ? "animate-sparkle" : ""}
          ${
            isOver
              ? "border-brand-blue bg-[var(--drop-overlay)]"
              : "border-border-strong bg-surface-raised/50 dark:bg-surface-raised hover:border-text-muted hover:bg-surface-raised/70"
          }
        `}
      >
        <motion.div
          animate={{ scale: isOver ? 1.1 : 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
        >
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-xl bg-brand-blue/10 dark:bg-brand-blue/15">
            {isOver ? (
              <Upload className="h-7 w-7 text-brand-blue" />
            ) : (
              <Mail className="h-7 w-7 text-brand-blue" />
            )}
          </div>

          <p className="text-xl font-semibold tracking-tight text-text-primary">
            {isOver ? "ドロップしてください" : "メールをここにドロップ"}
          </p>
          <p className="mt-2 text-sm text-text-muted">
            .eml / .txt / Apple Mail / コピペもOK
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}
