"use client";

import { motion } from "framer-motion";
import { Mail, Loader2 } from "lucide-react";

interface MailLoginScreenProps {
  onLoadMail: () => void;
  loading?: boolean;
}

/**
 * Microsoft でアプリにログイン済みのとき、同じアカウントのメールを読み込むための画面。
 * 「Outlookでログイン」などの二重ログインは廃止し、1ボタンでメール取得のみ。
 */
export function MailLoginScreen({ onLoadMail, loading }: MailLoginScreenProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.25 }}
      className="flex h-full w-full min-w-0 flex-col items-center justify-center gap-6 px-2"
    >
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-blue/10 dark:bg-brand-blue/15">
          <Mail className="h-5 w-5 text-brand-blue" />
        </div>
        <h3 className="text-sm font-semibold text-text-primary">メール</h3>
        <p className="mt-1 text-[11px] text-text-muted">
          Microsoftアカウントのメールを表示します
        </p>
      </div>

      <button
        type="button"
        onClick={onLoadMail}
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-brand-blue/40 bg-brand-blue/10 px-4 py-3 text-sm font-medium text-brand-blue hover:bg-brand-blue/20 disabled:opacity-60 disabled:cursor-wait transition-colors"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            読み込み中...
          </>
        ) : (
          "メールを読み込む"
        )}
      </button>
    </motion.div>
  );
}
