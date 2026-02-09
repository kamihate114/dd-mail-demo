"use client";

import { useTheme } from "./ThemeProvider";
import { Sun, Moon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function ThemeToggle() {
  const { resolved, setTheme } = useTheme();

  const toggle = () => {
    setTheme(resolved === "dark" ? "light" : "dark");
  };

  return (
    <button
      onClick={toggle}
      className="relative flex h-8 w-8 items-center justify-center rounded-lg
                 text-text-secondary transition-colors hover:bg-border-default hover:text-text-primary"
      aria-label={resolved === "dark" ? "ライトモードに切り替え" : "ダークモードに切り替え"}
    >
      <AnimatePresence mode="wait" initial={false}>
        {resolved === "dark" ? (
          <motion.div
            key="moon"
            initial={{ rotate: -90, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            exit={{ rotate: 90, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Moon className="h-4 w-4" />
          </motion.div>
        ) : (
          <motion.div
            key="sun"
            initial={{ rotate: 90, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            exit={{ rotate: -90, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Sun className="h-4 w-4" />
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  );
}
