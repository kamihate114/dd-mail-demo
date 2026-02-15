"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { registerCompany } from "./actions";

export default function OnboardingForm() {
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmed = companyName.trim();
    if (!trimmed) {
      setError("会社名を入力してください");
      return;
    }

    setLoading(true);
    setError("");

    const result = await registerCompany(trimmed);

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-6">
        <label
          htmlFor="company-name"
          className="block text-sm font-medium text-text-secondary mb-2"
        >
          会社名
        </label>
        <input
          id="company-name"
          type="text"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          placeholder="例: 株式会社サンプル"
          className="w-full px-4 py-3 rounded-xl border border-border-default bg-surface text-text-primary placeholder:text-text-muted text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue/50 transition-colors"
          disabled={loading}
          autoFocus
        />
      </div>

      {error && (
        <p className="mb-4 text-sm text-red-500 text-center">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading || !companyName.trim()}
        className="w-full py-3.5 rounded-xl bg-brand-blue text-white text-sm font-medium hover:bg-brand-blue/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
      >
        {loading ? "登録中..." : "登録して始める"}
      </button>
    </form>
  );
}
