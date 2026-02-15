"use client";

import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Sun, Moon, Monitor, Check } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { updateDisplayName } from "@/app/actions/profile";

type ThemeOption = "light" | "dark" | "system";

export function SettingsPanel({ onBack }: { onBack: () => void }) {
  const { theme, setTheme } = useTheme();
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const loadMe = useCallback(async () => {
    try {
      const res = await fetch("/api/me/role", { cache: "no-store" });
      const data = await res.json();
      const name = data?.display_name ?? (data?.email ? data.email.split("@")[0] : "") ?? "";
      setDisplayName(name);
    } catch {
      setDisplayName("");
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  const handleSaveDisplayName = async () => {
    setMessage(null);
    setLoading(true);
    try {
      const result = await updateDisplayName(displayName);
      if (result.error) {
        setMessage({ type: "error", text: result.error });
      } else {
        setMessage({ type: "ok", text: "変更しました" });
        setTimeout(() => setMessage(null), 2000);
        window.dispatchEvent(new CustomEvent("account-updated"));
      }
    } finally {
      setLoading(false);
    }
  };

  const themeOptions: { value: ThemeOption; label: string; icon: typeof Sun }[] = [
    { value: "light", label: "ライト", icon: Sun },
    { value: "dark", label: "ダーク", icon: Moon },
    { value: "system", label: "システム", icon: Monitor },
  ];

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold text-text-primary">設定</h1>
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-lg border border-border-default px-3 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          戻る
        </button>
      </div>

      {/* テーマ（カード） */}
      <section className="mb-6 rounded-xl border border-border-default bg-surface-raised p-4">
        <h2 className="text-sm font-semibold text-text-primary">テーマ</h2>
        <p className="mt-1 text-xs text-text-muted">
          アプリの表示テーマを選択できます。
        </p>
        <div className="mt-4 flex gap-2">
          {themeOptions.map((opt) => {
            const isSelected = theme === opt.value;
            const Icon = opt.icon;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setTheme(opt.value)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-medium transition-colors ${
                  isSelected
                    ? "border-teal bg-teal/10 text-teal dark:bg-teal/20 dark:text-teal"
                    : "border-border-default bg-surface-raised text-text-secondary hover:border-border-strong hover:text-text-primary"
                }`}
              >
                <Icon className="h-4 w-4" />
                {opt.label}
                {isSelected && <Check className="h-4 w-4" />}
              </button>
            );
          })}
        </div>
      </section>

      {/* ユーザーネーム（カード） */}
      <section className="mb-6 rounded-xl border border-border-default bg-surface-raised p-4">
        <h2 className="text-sm font-semibold text-text-primary">ユーザーネームを変更する</h2>
        <label className="mt-3 block text-xs font-medium text-text-primary">ユーザーネーム</label>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="表示名を入力"
          className="mt-1 w-full rounded-lg border border-border-default bg-surface px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
        />
        {message && (
          <p
            className={`mt-2 text-xs ${message.type === "ok" ? "text-teal" : "text-red-500"}`}
          >
            {message.text}
          </p>
        )}
        <button
          type="button"
          onClick={handleSaveDisplayName}
          disabled={loading}
          className="mt-3 rounded-lg bg-teal px-4 py-2 text-sm font-medium text-white hover:bg-teal/90 disabled:opacity-50"
        >
          {loading ? "保存中..." : "変更"}
        </button>
      </section>

      {/* サブスクリプションと支払い（遷移先は今後 Stripe ポータルを予定） */}
      <section className="rounded-xl border border-border-default bg-surface-raised p-4">
        <h2 className="text-sm font-semibold text-text-primary">サブスクリプションと支払い</h2>
        <p className="mt-1 text-xs text-text-muted">
          現在のご利用プランとお支払い情報を確認できます。
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs text-text-muted">現在のプラン</p>
            <p className="text-base font-medium text-text-primary">無料お試し中</p>
          </div>
          <a
            href={process.env.NEXT_PUBLIC_STRIPE_CUSTOMER_PORTAL_URL ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              if (!process.env.NEXT_PUBLIC_STRIPE_CUSTOMER_PORTAL_URL) {
                e.preventDefault();
              }
            }}
            className="shrink-0 rounded-lg border border-border-default bg-surface px-4 py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-white/[0.06] hover:border-border-strong dark:hover:bg-white/[0.04]"
          >
            支払い情報の管理・退会手続きへ
          </a>
        </div>
        {!process.env.NEXT_PUBLIC_STRIPE_CUSTOMER_PORTAL_URL && (
          <p className="mt-2 text-[10px] text-text-muted">
            Stripe ポータル設定後、ボタンから遷移できます。
          </p>
        )}
      </section>
    </div>
  );
}
