"use client";

import { useState, useCallback } from "react";
import { Clock, MapPin, CalendarDays, Loader2, X, Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export interface ScheduleItem {
  id: string;
  title: string;
  startTime: string; // "09:00"
  endTime?: string;  // "10:00"
  location?: string;
  color: "blue" | "teal" | "orange" | "purple" | "red";
}

interface DayScheduleProps {
  selectedDate: Date;
  events: ScheduleItem[];
  isLoading?: boolean;
  onUpdateEvent?: (eventId: string, updates: Partial<Pick<ScheduleItem, "title" | "startTime" | "endTime">>) => void;
  onDeleteEvent?: (eventId: string) => void;
  onAddEvent?: (date: Date, event: { title: string; startTime: string; endTime?: string }) => void;
}

const colorMap: Record<ScheduleItem["color"], { bg: string; border: string; dot: string; selected: string; nowBorder: string }> = {
  blue:   { bg: "bg-brand-blue/10 dark:bg-brand-blue/15", border: "border-l-brand-blue", dot: "bg-brand-blue", selected: "bg-brand-blue/20 dark:bg-brand-blue/25", nowBorder: "border-l-4 border-l-brand-blue" },
  teal:   { bg: "bg-teal/10 dark:bg-teal/15", border: "border-l-teal", dot: "bg-teal", selected: "bg-teal/20 dark:bg-teal/25", nowBorder: "border-l-4 border-l-teal" },
  orange: { bg: "bg-orange-400/10 dark:bg-orange-400/15", border: "border-l-orange-400", dot: "bg-orange-400", selected: "bg-orange-400/20 dark:bg-orange-400/25", nowBorder: "border-l-4 border-l-orange-400" },
  purple: { bg: "bg-purple-400/10 dark:bg-purple-400/15", border: "border-l-purple-400", dot: "bg-purple-400", selected: "bg-purple-400/20 dark:bg-purple-400/25", nowBorder: "border-l-4 border-l-purple-400" },
  red:    { bg: "bg-red-400/10 dark:bg-red-400/15", border: "border-l-red-400", dot: "bg-red-400", selected: "bg-red-400/20 dark:bg-red-400/25", nowBorder: "border-l-4 border-l-red-400" },
};

/** 「今」のグラデーション用 rgba（対応する色） */
const nowGlowColor: Record<ScheduleItem["color"], string> = {
  blue:   "rgba(59, 130, 246, 0.4)",
  teal:   "rgba(13, 148, 136, 0.4)",
  orange: "rgba(251, 146, 60, 0.4)",
  purple: "rgba(192, 132, 252, 0.4)",
  red:    "rgba(248, 113, 113, 0.4)",
};

function formatDate(date: Date): string {
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  return `${date.getMonth() + 1}月${date.getDate()}日（${days[date.getDay()]}）`;
}

function isToday(date: Date): boolean {
  const now = new Date();
  return date.getFullYear() === now.getFullYear() &&
         date.getMonth() === now.getMonth() &&
         date.getDate() === now.getDate();
}

const MAX_VISIBLE_ITEMS = 4;
const ITEM_HEIGHT_PX = 52;

/** 選択日が今日で、現在時刻が予定の開始〜終了内なら true */
function isEventNow(selectedDate: Date, event: ScheduleItem): boolean {
  if (!isToday(selectedDate)) return false;
  if (event.startTime === "終日") return true;
  const now = new Date();
  const current =
    now.getHours().toString().padStart(2, "0") + ":" + now.getMinutes().toString().padStart(2, "0");
  const start = event.startTime;
  const end = event.endTime && /^\d{1,2}:\d{2}$/.test(event.endTime) ? event.endTime : "23:59";
  return start <= current && current <= end;
}

export function DaySchedule({ selectedDate, events, isLoading, onUpdateEvent, onDeleteEvent, onAddEvent }: DayScheduleProps) {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const sorted = [...events].sort((a, b) => a.startTime.localeCompare(b.startTime));

  return (
    <div className="flex flex-col gap-3">
      {/* Date header + 追加ボタン */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-3.5 w-3.5 text-brand-blue" />
          <span className="text-xs font-semibold text-text-primary">
            {formatDate(selectedDate)}
          </span>
          {isToday(selectedDate) && (
            <span className="rounded-full bg-brand-blue/15 px-1.5 py-0.5 text-[10px] font-medium text-brand-blue">
              TODAY
            </span>
          )}
        </div>
        {onAddEvent && (
          <button
            type="button"
            onClick={() => setShowAddForm((v) => !v)}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-brand-blue text-white hover:opacity-90 transition-opacity"
            aria-label="予定を追加"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* 新規予定フォーム */}
      <AnimatePresence>
        {showAddForm && onAddEvent && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <AddEventForm
              selectedDate={selectedDate}
              onAdd={(event) => {
                onAddEvent(selectedDate, event);
                setShowAddForm(false);
              }}
              onCancel={() => setShowAddForm(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Events list — max 4 visible, then scroll */}
      <div
        className="flex flex-col gap-1.5 overflow-y-auto"
        style={{ maxHeight: MAX_VISIBLE_ITEMS * ITEM_HEIGHT_PX }}
      >
        <AnimatePresence mode="popLayout">
          {isLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center justify-center gap-2 py-4"
            >
              <Loader2 className="h-3 w-3 text-brand-blue animate-spin" />
              <span className="text-[10px] text-text-muted">読み込み中...</span>
            </motion.div>
          ) : sorted.length === 0 ? (
            <motion.p
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-4 text-center text-xs text-text-muted"
            >
              予定はありません
            </motion.p>
          ) : (
            sorted.map((event, i) => {
              const c = colorMap[event.color];
              const isSelected = selectedEventId === event.id;
              const isNow = isEventNow(selectedDate, event);
              return (
                <motion.div
                  key={event.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ delay: Math.min(i * 0.04, 0.12) }}
                  className={`relative overflow-hidden rounded-lg border-l-2 px-2.5 py-2 transition-colors cursor-pointer ${isNow ? `${c.bg} ${c.nowBorder}` : isSelected ? `${c.selected} ${c.border}` : `${c.bg} ${c.border}`}`}
                  onClick={() => setSelectedEventId(isSelected ? null : event.id)}
                >
                  {isNow && (
                    <div
                      className="event-now-glow absolute inset-0 z-0 rounded-lg"
                      style={{ ["--now-color" as string]: nowGlowColor[event.color] }}
                    />
                  )}
                  <div className="relative z-10">
                  {isSelected && onUpdateEvent ? (
                    <ScheduleEventEdit
                      event={event}
                      onClose={() => setSelectedEventId(null)}
                      onSave={(updates) => {
                        onUpdateEvent(event.id, updates);
                        setSelectedEventId(null);
                      }}
                      onDelete={onDeleteEvent ? () => onDeleteEvent(event.id) : undefined}
                    />
                  ) : (
                    <>
                      <div className="flex items-center gap-1.5">
                        <div className={`h-1.5 w-1.5 shrink-0 rounded-full ${c.dot}`} />
                        <span className="text-[11px] font-medium text-text-primary truncate">
                          {event.title}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2 pl-3">
                        <Clock className="h-2.5 w-2.5 text-text-muted" />
                        <span className="text-[10px] text-text-muted">
                          {event.startTime}
                          {event.endTime && ` - ${event.endTime}`}
                        </span>
                        {event.location && (
                          <>
                            <MapPin className="h-2.5 w-2.5 text-text-muted" />
                            <span className="text-[10px] text-text-muted truncate">{event.location}</span>
                          </>
                        )}
                      </div>
                    </>
                  )}
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function toTimeValue(s: string): string {
  return /^\d{1,2}:\d{2}$/.test(s) ? s : "09:00";
}

function ScheduleEventEdit({
  event,
  onClose,
  onSave,
  onDelete,
}: {
  event: ScheduleItem;
  onClose: () => void;
  onSave: (updates: Partial<Pick<ScheduleItem, "title" | "startTime" | "endTime">>) => void;
  onDelete?: () => void;
}) {
  const [title, setTitle] = useState(event.title);
  const [startTime, setStartTime] = useState(toTimeValue(event.startTime));
  const [endTime, setEndTime] = useState(toTimeValue(event.endTime ?? "10:00"));
  const isAllDay = event.startTime === "終日";

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onSave({
        title: title.trim() || event.title,
        startTime,
        endTime: endTime || undefined,
      });
    },
    [title, startTime, endTime, event, onSave],
  );

  const handleDelete = useCallback(() => {
    if (onDelete && confirm("この予定を削除しますか？")) {
      onDelete();
      onClose();
    }
  }, [onDelete, onClose]);

  return (
    <form onSubmit={handleSubmit} className="space-y-2" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between gap-1">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="flex-1 min-w-0 rounded bg-transparent px-1 py-0.5 text-[11px] font-medium text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-blue/50"
          placeholder="タイトル"
        />
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded p-0.5 text-text-muted hover:text-text-primary"
          aria-label="閉じる"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      {!isAllDay && (
        <div className="flex items-center gap-2 pl-0.5">
          <Clock className="h-2.5 w-2.5 text-text-muted shrink-0" />
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="rounded bg-transparent px-1 py-0.5 text-[10px] text-text-muted focus:outline-none focus:ring-1 focus:ring-brand-blue/50 [color-scheme:dark]"
          />
          <span className="text-[10px] text-text-muted">-</span>
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="rounded bg-transparent px-1 py-0.5 text-[10px] text-text-muted focus:outline-none focus:ring-1 focus:ring-brand-blue/50 [color-scheme:dark]"
          />
        </div>
      )}
      <div className="flex justify-end gap-1 pt-0.5 flex-wrap">
        {onDelete && (
          <button
            type="button"
            onClick={handleDelete}
            className="rounded px-2 py-1 text-[10px] text-red-500 hover:text-red-400 hover:bg-red-500/10"
          >
            削除
          </button>
        )}
        <div className="flex gap-1 ml-auto">
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-1 text-[10px] text-text-muted hover:text-text-primary"
          >
            キャンセル
          </button>
          <button
            type="submit"
            className="rounded bg-brand-blue px-2 py-1 text-[10px] text-white hover:opacity-90"
          >
            保存
          </button>
        </div>
      </div>
    </form>
  );
}

function AddEventForm({
  selectedDate,
  onAdd,
  onCancel,
}: {
  selectedDate: Date;
  onAdd: (event: { title: string; startTime: string; endTime?: string }) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      onAdd({ title: title.trim() || "（無題）", startTime, endTime });
    },
    [title, startTime, endTime, onAdd],
  );

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-border-default bg-surface-raised/50 dark:bg-surface-raised p-2.5 space-y-2">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="予定のタイトル"
        className="w-full rounded bg-transparent px-2 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-brand-blue/50"
      />
      <div className="flex items-center gap-2">
        <Clock className="h-2.5 w-2.5 text-text-muted shrink-0" />
        <input
          type="time"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          className="rounded bg-transparent px-1 py-0.5 text-[10px] text-text-muted focus:outline-none focus:ring-1 focus:ring-brand-blue/50 [color-scheme:dark]"
        />
        <span className="text-[10px] text-text-muted">-</span>
        <input
          type="time"
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
          className="rounded bg-transparent px-1 py-0.5 text-[10px] text-text-muted focus:outline-none focus:ring-1 focus:ring-brand-blue/50 [color-scheme:dark]"
        />
      </div>
      <div className="flex justify-end gap-1 pt-0.5">
        <button type="button" onClick={onCancel} className="rounded px-2 py-1 text-[10px] text-text-muted hover:text-text-primary">
          キャンセル
        </button>
        <button type="submit" className="rounded bg-brand-blue px-2 py-1 text-[10px] text-white hover:opacity-90">
          追加
        </button>
      </div>
    </form>
  );
}
