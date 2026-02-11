"use client";

import { useState, useCallback, useRef, useEffect, Fragment } from "react";
import { Plus, Check, Circle, Loader2, ChevronDown, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar } from "./Calendar";
import { DaySchedule, ScheduleItem } from "./DaySchedule";

export interface TodoItem {
  id: string;
  text: string;
  notes?: string;
  done: boolean;
}

export interface TaskList {
  id: string;
  title: string;
}

interface RightSidebarProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  events: ScheduleItem[];
  isLoadingEvents?: boolean;
  onUpdateEvent?: (eventId: string, updates: Partial<Pick<ScheduleItem, "title" | "startTime" | "endTime">>) => void;
  onDeleteEvent?: (eventId: string) => void;
  onAddEvent?: (date: Date, event: { title: string; startTime: string; endTime?: string }) => void;
  todos: TodoItem[];
  isLoadingTodos?: boolean;
  onAddTodo: (text: string) => void;
  onToggleTodo: (id: string) => void;
  onUpdateTodo?: (id: string, updates: { title?: string; notes?: string }) => void;
  taskLists?: TaskList[];
  activeTaskListId?: string;
  onSelectTaskList?: (listId: string) => void;
  hideCalendar?: boolean;
}

export function RightSidebar({
  selectedDate, onSelectDate, events, isLoadingEvents, onUpdateEvent, onDeleteEvent, onAddEvent,
  todos, isLoadingTodos, onAddTodo, onToggleTodo, onUpdateTodo,
  taskLists, activeTaskListId, onSelectTaskList,
  hideCalendar = false,
}: RightSidebarProps) {
  const [newTodo, setNewTodo] = useState("");
  const [showListPicker, setShowListPicker] = useState(false);
  const [selectedTodoId, setSelectedTodoId] = useState<string | null>(null);
  // Track items completing (for animation before hide)
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set());
  // Track editing title for selected todo
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  const selectedTodo = todos.find((t) => t.id === selectedTodoId) || null;
  const activeListName = taskLists?.find((l) => l.id === activeTaskListId)?.title ?? "ToDo";
  const listPickerRef = useRef<HTMLDivElement>(null);

  // Close list picker on outside click
  useEffect(() => {
    if (!showListPicker) return;
    const handler = (e: MouseEvent) => {
      if (listPickerRef.current && !listPickerRef.current.contains(e.target as Node)) {
        setShowListPicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showListPicker]);

  const handleAdd = () => {
    const text = newTodo.trim();
    if (text) {
      setNewTodo("");
      onAddTodo(text);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter" || e.shiftKey) return;
    if (e.nativeEvent.isComposing) {
      e.preventDefault();
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    const text = (e.currentTarget.value || "").trim();
    if (text) {
      setNewTodo("");
      onAddTodo(text);
    }
  };

  const handleToggleWithAnimation = useCallback((id: string) => {
    const todo = todos.find((t) => t.id === id);
    if (!todo) return;

    if (!todo.done) {
      // Completing → animate then hide
      setCompletingIds((prev) => new Set(prev).add(id));
      // Close detail if this task is selected
      if (selectedTodoId === id) setSelectedTodoId(null);
      setTimeout(() => {
        onToggleTodo(id);
        setCompletingIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
      }, 600);
    } else {
      // Un-completing
      onToggleTodo(id);
    }
  }, [todos, onToggleTodo, selectedTodoId]);

  // Filter: hide completed tasks (they get animated out via completingIds)
  const visibleTodos = todos.filter((t) => !t.done);

  return (
    <aside className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      {/* Calendar */}
      {!hideCalendar && (
        <>
          <Calendar selectedDate={selectedDate} onSelectDate={onSelectDate} />
          <div className="h-px bg-border-default" />
        </>
      )}

      {/* Day schedule */}
      <DaySchedule selectedDate={selectedDate} events={events} isLoading={isLoadingEvents} onUpdateEvent={onUpdateEvent} onDeleteEvent={onDeleteEvent} onAddEvent={onAddEvent} />

      <div className="h-px bg-border-default" />

      {/* Todo list — synced with Google Tasks / Microsoft To Do API */}
      <div className="rounded-xl border border-border-default bg-surface-raised/50 dark:bg-surface-raised p-4">
          {/* Header with list selector */}
          <div className="mb-3 flex items-center justify-between">
            <div className="relative" ref={listPickerRef}>
              <button
                onClick={() => { if (taskLists && taskLists.length > 1) setShowListPicker(!showListPicker); }}
                className="flex items-center gap-1 text-xs font-semibold text-text-primary hover:text-brand-blue transition-colors"
              >
                <span>{activeListName}</span>
                {taskLists && taskLists.length > 1 && (
                  <ChevronDown className={`h-3 w-3 text-text-muted transition-transform ${showListPicker ? "rotate-180" : ""}`} />
                )}
              </button>

              {/* List picker dropdown */}
              <AnimatePresence>
                {showListPicker && taskLists && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className="absolute left-0 top-full z-20 mt-1.5 min-w-[140px] rounded-lg border border-border-default
                               bg-surface-raised shadow-lg dark:bg-surface-raised py-1"
                  >
                    {taskLists.map((list) => (
                      <button
                        key={list.id}
                        onClick={() => { onSelectTaskList?.(list.id); setShowListPicker(false); }}
                        className={`w-full px-2.5 py-1.5 text-left text-[11px] transition-colors
                          ${list.id === activeTaskListId
                            ? "bg-brand-blue/20 dark:bg-brand-blue/30 text-brand-blue font-medium"
                            : "text-text-secondary hover:bg-border-default"
                          }`}
                      >
                        {list.title}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <span className="text-[10px] text-text-muted">
              {visibleTodos.length}件
            </span>
          </div>

          {/* Add input */}
          <div className="mb-3 flex items-center gap-2">
            <input
              type="text"
              placeholder="新しいタスク..."
              value={newTodo}
              onChange={(e) => setNewTodo(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 rounded-md border border-border-default bg-transparent px-2 py-1.5
                         text-xs text-text-primary placeholder:text-text-muted
                         focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue/30
                         transition-colors"
            />
            <button
              onClick={handleAdd}
              disabled={!newTodo.trim()}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md
                         bg-brand-blue text-white transition-opacity
                         disabled:opacity-30 hover:bg-brand-blue-light"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>

          {/* Items */}
          <div className="flex flex-col gap-1">
            {isLoadingTodos ? (
              <div className="flex items-center justify-center gap-2 py-6">
                <Loader2 className="h-3 w-3 text-brand-blue animate-spin" />
                <span className="text-[10px] text-text-muted">読み込み中...</span>
              </div>
            ) : (
              <>
                <AnimatePresence>
                  {visibleTodos.map((todo) => {
                    const isCompleting = completingIds.has(todo.id);
                    const isSelected = selectedTodoId === todo.id;
                    return (
                      <Fragment key={todo.id}>
                        <motion.div
                          layout
                          initial={{ opacity: 0, y: 8 }}
                          animate={{
                            opacity: isCompleting ? 0 : 1,
                            y: 0,
                            scale: isCompleting ? 0.95 : 1,
                            x: isCompleting ? 20 : 0,
                          }}
                          exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                          transition={{ duration: isCompleting ? 0.5 : 0.2 }}
                          className={`group flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors
                            ${isSelected ? "rounded-b-none bg-brand-blue/30 dark:bg-brand-blue/40" : "hover:bg-border-default"}
                          `}
                        >
                          {/* Checkbox */}
                          <button
                            onClick={(e) => { e.stopPropagation(); handleToggleWithAnimation(todo.id); }}
                            className="shrink-0 cursor-pointer"
                          >
                            {isCompleting ? (
                              <motion.div
                                initial={{ scale: 0.5 }}
                                animate={{ scale: 1.2 }}
                                transition={{ duration: 0.3 }}
                              >
                                <Check className="h-3 w-3 text-teal" />
                              </motion.div>
                            ) : (
                              <Circle className={`h-3 w-3 transition-colors ${isSelected ? "text-brand-blue" : "text-text-muted hover:text-brand-blue"}`} />
                            )}
                          </button>
                          {/* 見出し（○の右）— クリックで詳細パネルを開く、詳細パネル開いている時はクリックで編集 */}
                          <div 
                            className="flex-1 min-w-0 flex flex-col cursor-pointer"
                            onClick={(e) => {
                              // チェックボックスのクリックは除外
                              const target = e.target as HTMLElement;
                              if (target.closest('button') || target.closest('input')) {
                                return;
                              }
                              // 詳細パネルが開いている時はタイトル編集モードに入る
                              if (isSelected && editingTitleId !== todo.id) {
                                e.stopPropagation();
                                setEditingTitleId(todo.id);
                                setEditingTitle(todo.text);
                                return;
                              }
                              // タイトル部分全体をクリックしたら詳細パネルを開く
                              e.stopPropagation();
                              setSelectedTodoId(isSelected ? null : todo.id);
                            }}
                          >
                            {isSelected && editingTitleId === todo.id ? (
                              <input
                                autoFocus
                                value={editingTitle}
                                onChange={(e) => setEditingTitle(e.target.value)}
                                onBlur={() => {
                                  const t = editingTitle.trim();
                                  if (t && t !== todo.text) {
                                    onUpdateTodo?.(todo.id, { title: t });
                                  }
                                  setEditingTitleId(null);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    const t = editingTitle.trim();
                                    if (t && t !== todo.text) {
                                      onUpdateTodo?.(todo.id, { title: t });
                                    }
                                    setEditingTitleId(null);
                                    (e.target as HTMLInputElement).blur();
                                  }
                                  if (e.key === "Escape") {
                                    setEditingTitle(todo.text);
                                    setEditingTitleId(null);
                                  }
                                  e.stopPropagation();
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className={`min-w-0 w-full bg-transparent text-xs border-none focus:outline-none focus:ring-0 px-0 py-0
                                  ${isCompleting ? "text-teal line-through" : "text-brand-blue dark:text-white font-medium"}`}
                              />
                            ) : (
                              <span
                                className={`text-xs block ${isCompleting ? "text-teal line-through" : isSelected ? "text-brand-blue dark:text-white font-medium" : "text-text-primary"}`}
                                title={isSelected ? "クリックでタイトルを編集" : "クリックで詳細を開く"}
                              >
                                {todo.text || "タイトルなし"}
                              </span>
                            )}
                            {todo.notes && (
                              <p 
                                className={`mt-0.5 text-[10px] truncate ${isSelected ? "text-brand-blue/80 dark:text-text-secondary" : "text-text-muted"}`} 
                                title="クリックで詳細を開く"
                              >
                                {todo.notes}
                              </p>
                            )}
                          </div>
                        </motion.div>
                        <AnimatePresence>
                          {isSelected && (
                            <motion.div
                              key="detail"
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden -mt-0.5 w-full"
                            >
                              <TaskDetailPanel
                                todo={todo}
                                onClose={() => {
                                  setSelectedTodoId(null);
                                  setEditingTitleId(null);
                                }}
                                onUpdate={onUpdateTodo}
                                onToggle={() => handleToggleWithAnimation(todo.id)}
                              />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </Fragment>
                    );
                  })}
                </AnimatePresence>

                {visibleTodos.length === 0 && !isLoadingTodos && (
                  <p className="py-4 text-center text-[10px] text-text-muted">
                    タスクを追加してください
                  </p>
                )}
              </>
            )}
          </div>
      </div>
    </aside>
  );
}

/* ---------- Task Detail Panel ---------- */
function TaskDetailPanel({
  todo, onClose, onUpdate,
}: {
  todo: TodoItem;
  onClose: () => void;
  onUpdate?: (id: string, updates: { title?: string; notes?: string }) => void;
  onToggle: () => void;
}) {
  const [notes, setNotes] = useState(todo.notes ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setNotes(todo.notes ?? "");
  }, [todo.id, todo.notes]);

  const saveNotes = useCallback((newNotes: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (newNotes !== (todo.notes ?? "")) {
        onUpdate?.(todo.id, { notes: newNotes });
      }
    }, 800);
  }, [todo.id, todo.notes, onUpdate]);

  return (
    <div className="rounded-b-xl border-x border-b border-brand-blue/30 bg-brand-blue/30 dark:bg-brand-blue/40 px-2 pt-1.5 pb-3">
      <div className="flex justify-end mb-1.5">
        <button
          onClick={onClose}
          className="rounded p-0.5 text-text-muted hover:text-text-primary transition-colors"
          aria-label="閉じる"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      <textarea
        ref={textareaRef}
        data-todo-id={todo.id}
        value={notes}
        onChange={(e) => { setNotes(e.target.value); saveNotes(e.target.value); }}
        placeholder="メモを追加..."
        className="w-full resize-none rounded-lg bg-black/10 dark:bg-black/20 px-2 py-1.5 text-xs
                   text-text-secondary placeholder:text-text-muted
                   focus:outline-none min-h-[60px] border-0"
        rows={3}
        onKeyDown={(e) => {
          // Escapeキーでパネルを閉じる
          if (e.key === "Escape") {
            onClose();
          }
        }}
      />
    </div>
  );
}
