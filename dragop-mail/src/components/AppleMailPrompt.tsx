"use client";

import { motion } from "framer-motion";
import { Info } from "lucide-react";

interface AppleMailPromptProps {
  subject: string;
  onClose: () => void;
}

export function AppleMailPrompt({ subject, onClose }: AppleMailPromptProps) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.3 }}
      className="mt-6 overflow-hidden"
    >
      <div className="rounded-xl border border-amber-400/30 bg-amber-50/60 px-5 py-4 dark:border-amber-500/20 dark:bg-amber-900/10">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-800/30">
            <Info className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-text-primary">
              件名「{subject}」を検出しました
            </p>
            <p className="mt-1 text-xs text-text-secondary">
              Apple Mail からのドラッグでは本文を取得できません。下のテキストエリアにメール本文を貼り付けてください。
            </p>
            <p className="mt-1 text-xs text-text-muted">
              または Apple Mail でメールを選択 → ファイル → メッセージを書き出す で .eml ファイルを保存してからドロップしてください。
            </p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-lg px-2 py-1 text-xs text-text-muted hover:bg-border-default hover:text-text-primary"
          >
            閉じる
          </button>
        </div>
      </div>
    </motion.div>
  );
}
