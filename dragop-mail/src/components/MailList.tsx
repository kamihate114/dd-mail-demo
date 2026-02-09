"use client";

import { motion, AnimatePresence } from "framer-motion";
import { FileText, Trash2, Clock } from "lucide-react";

export interface MailItem {
  id: string;
  fileName: string;
  preview: string;
  charCount: number;
  timestamp: Date;
}

interface MailListProps {
  mails: MailItem[];
  onRemove: (id: string) => void;
  onClearAll: () => void;
}

function timeAgo(date: Date): string {
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return "たった今";
  if (diff < 3600) return `${Math.floor(diff / 60)}分前`;
  return date.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
}

export function MailList({ mails, onRemove, onClearAll }: MailListProps) {
  if (mails.length === 0) return null;

  return (
    <div className="mt-6">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium text-text-secondary">
          読み込み済み ({mails.length})
        </p>
        {mails.length > 1 && (
          <button
            onClick={onClearAll}
            className="rounded-lg px-2 py-1 text-xs text-text-muted transition-colors hover:bg-border-default hover:text-text-primary"
          >
            すべてクリア
          </button>
        )}
      </div>

      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {mails.map((mail, index) => (
            <motion.div
              key={mail.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25, delay: index * 0.05 }}
              className="group flex items-center gap-3 rounded-xl border border-border-default
                         bg-surface-raised/80 px-4 py-3 transition-colors
                         dark:bg-surface-raised hover:bg-surface-raised"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-blue/10 dark:bg-brand-blue/15">
                <FileText className="h-4 w-4 text-brand-blue" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-text-primary">
                  {mail.fileName}
                </p>
                <div className="mt-0.5 flex items-center gap-2">
                  <span className="text-xs text-text-muted">
                    {mail.charCount.toLocaleString()} 文字
                  </span>
                  <span className="text-text-muted">·</span>
                  <span className="flex items-center gap-1 text-xs text-text-muted">
                    <Clock className="h-3 w-3" />
                    {timeAgo(mail.timestamp)}
                  </span>
                </div>
              </div>

              <button
                onClick={() => onRemove(mail.id)}
                className="shrink-0 rounded-lg p-1.5 text-text-muted opacity-0 transition-all
                           hover:bg-red-500/10 hover:text-red-500 group-hover:opacity-100
                           dark:hover:bg-red-500/15"
                aria-label="削除"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
