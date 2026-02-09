"use client";

import { ChangeEvent, forwardRef } from "react";

interface PasteAreaProps {
  value: string;
  onChange: (text: string) => void;
  highlighted?: boolean;
}

export const PasteArea = forwardRef<HTMLTextAreaElement, PasteAreaProps>(
  function PasteArea({ value, onChange, highlighted }, ref) {
    const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value);
    };

    return (
      <div className="mt-6">
        <label
          htmlFor="paste-area"
          className={`mb-2 block text-sm font-medium ${
            highlighted ? "text-teal" : "text-text-muted"
          }`}
        >
          {highlighted ? "メール本文を貼り付けてください" : "またはメール本文を貼り付け"}
        </label>
        <textarea
          ref={ref}
          id="paste-area"
          value={value}
          onChange={handleChange}
          placeholder="メールの本文をここに貼り付けてください..."
          rows={5}
          className={`w-full resize-none rounded-xl border px-4 py-3 text-sm
            text-text-primary placeholder:text-text-muted
            transition-colors duration-200
            focus:border-brand-blue focus:bg-surface-raised focus:outline-none focus:ring-1 focus:ring-brand-blue/30
            ${
              highlighted
                ? "border-brand-blue/30 bg-surface-raised ring-1 ring-brand-blue/20"
                : "border-border-default bg-surface-raised/70 dark:bg-surface-raised"
            }
          `}
        />
      </div>
    );
  }
);
