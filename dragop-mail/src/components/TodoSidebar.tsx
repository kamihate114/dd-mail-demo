"use client";

import { useState } from "react";
import { Plus, Check, Circle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export interface TodoItem {
  id: string;
  text: string;
  done: boolean;
}

interface TodoSidebarProps {
  suggestions: string[];
  todos: TodoItem[];
  onAddTodo: (text: string) => void;
  onToggleTodo: (id: string) => void;
}

export function TodoSidebar({ suggestions, todos, onAddTodo, onToggleTodo }: TodoSidebarProps) {
  const [newTodo, setNewTodo] = useState("");

  const handleAdd = () => {
    if (newTodo.trim()) {
      onAddTodo(newTodo.trim());
      setNewTodo("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <aside className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      {/* Todo suggestions */}
      <div className="rounded-xl border border-border-default bg-surface-raised/50 dark:bg-surface-raised p-4">
        <h3 className="mb-1 text-sm font-semibold text-text-primary">今後のToDo候補</h3>
        <p className="text-[10px] text-text-muted">
          {suggestions.length > 0
            ? "メールから抽出されたタスク候補"
            : "日報を完成させると候補が表示されます"}
        </p>

        {suggestions.length > 0 && (
          <div className="mt-3 flex flex-col gap-1.5">
            <AnimatePresence>
              {suggestions.map((s, i) => (
                <motion.button
                  key={`sug-${i}`}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => onAddTodo(s)}
                  className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-text-secondary
                             hover:bg-brand-blue/10 hover:text-brand-blue transition-colors"
                >
                  <Plus className="mt-0.5 h-3 w-3 shrink-0" />
                  <span>{s}</span>
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Todo list */}
      <div className="rounded-xl border border-border-default bg-surface-raised/50 dark:bg-surface-raised p-4">
        <h3 className="mb-3 text-sm font-semibold text-text-primary">ToDo</h3>

        {/* Add input */}
        <div className="mb-3 flex items-center gap-1.5">
          <input
            type="text"
            placeholder="新しいタスク..."
            value={newTodo}
            onChange={(e) => setNewTodo(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 rounded-lg border border-border-default bg-transparent px-2.5 py-1.5
                       text-xs text-text-primary placeholder:text-text-muted
                       focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue/30
                       transition-colors"
          />
          <button
            onClick={handleAdd}
            disabled={!newTodo.trim()}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg
                       bg-brand-blue text-white transition-opacity
                       disabled:opacity-30 hover:bg-brand-blue-light"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Items */}
        <div className="flex flex-col gap-1">
          <AnimatePresence>
            {todos.map((todo) => (
              <motion.button
                key={todo.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -10 }}
                onClick={() => onToggleTodo(todo.id)}
                className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-left transition-colors
                           hover:bg-border-default"
              >
                {todo.done ? (
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal" />
                ) : (
                  <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-muted" />
                )}
                <span className={`text-xs ${todo.done ? "text-text-muted line-through" : "text-text-primary"}`}>
                  {todo.text}
                </span>
              </motion.button>
            ))}
          </AnimatePresence>

          {todos.length === 0 && (
            <p className="py-2 text-center text-[10px] text-text-muted">
              タスクを追加してください
            </p>
          )}
        </div>
      </div>
    </aside>
  );
}
