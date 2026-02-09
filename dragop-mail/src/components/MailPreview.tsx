"use client";

import { useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { X, GripVertical, Clock, User } from "lucide-react";
import { EmailItem } from "@/lib/mockEmails";

interface MailPreviewProps {
  email: EmailItem;
  onClose: () => void;
}

export function MailPreview({ email, onClose }: MailPreviewProps) {
  const [width, setWidth] = useState(320);
  const isResizing = useRef(false);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isResizing.current = true;
    const startX = e.clientX;
    const startWidth = width;

    const onMove = (ev: MouseEvent) => {
      if (!isResizing.current) return;
      const newWidth = Math.max(240, Math.min(600, startWidth + (ev.clientX - startX)));
      setWidth(newWidth);
    };
    const onUp = () => {
      isResizing.current = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [width]);

  return (
    <motion.div
      initial={{ opacity: 0, x: -12, scale: 0.97 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: -12, scale: 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className="absolute left-full top-0 z-50 ml-2 flex h-[calc(100vh-3.5rem)] flex-col
                 rounded-2xl border border-border-default bg-surface shadow-xl shadow-black/10 dark:shadow-black/30"
      style={{ width }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-default px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <GripVertical className="h-3.5 w-3.5 shrink-0 text-text-muted" />
          <span className="truncate text-xs font-semibold text-text-primary">プレビュー</span>
        </div>
        <button
          onClick={onClose}
          className="rounded-full p-1 text-text-muted hover:bg-border-default hover:text-text-primary transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Email meta */}
      <div className="border-b border-border-default px-4 py-3">
        <h3 className="text-sm font-semibold text-text-primary leading-snug">
          {email.subject}
        </h3>
        <div className="mt-2 flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <User className="h-3 w-3 shrink-0 text-text-muted" />
            <span className="text-[11px] text-text-secondary">
              {email.sender}
              <span className="ml-1 text-text-muted">&lt;{email.senderEmail}&gt;</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-3 w-3 shrink-0 text-text-muted" />
            <span className="text-[11px] text-text-muted">{email.receivedAt}</span>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div className="whitespace-pre-wrap text-xs leading-relaxed text-text-primary">
          {email.body}
        </div>
      </div>

      {/* Resize handle — right edge */}
      <div
        onMouseDown={handleResizeStart}
        className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-brand-blue/30 active:bg-brand-blue/50 transition-colors rounded-r-2xl"
      />
    </motion.div>
  );
}
