"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { registerCompany, registerAsIndividual } from "./actions";

const MIN_SEATS = 1;
const MAX_SEATS = 9999;

export default function OnboardingForm() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [seatCount, setSeatCount] = useState<number>(1);
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const seats = Math.max(MIN_SEATS, Math.min(MAX_SEATS, seatCount));

  const handleSeatNext = () => {
    if (seats < MIN_SEATS) return;
    if (seats === 1) {
      setLoading(true);
      setError("");
      registerAsIndividual(1).then((result) => {
        if (result.error) {
          setError(result.error);
          setLoading(false);
        } else {
          router.push("/");
          router.refresh();
        }
      });
    } else {
      setStep(2);
    }
  };

  const handleSubmitOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = companyName.trim();
    if (!trimmed) {
      setError("会社名を入力してください");
      return;
    }
    setLoading(true);
    setError("");
    const result = await registerCompany(trimmed, seats);
    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      router.push("/");
      router.refresh();
    }
  };

  const handleSkipToIndividual = () => {
    setLoading(true);
    setError("");
    registerAsIndividual(1).then((result) => {
      if (result.error) {
        setError(result.error);
        setLoading(false);
      } else {
        router.push("/");
        router.refresh();
      }
    });
  };

  if (step === 1) {
    return (
      <div>
        <p className="text-sm text-text-secondary mb-2 text-center">
          契約する利用人数（席数）を入力してください
        </p>
        <p className="text-xs text-text-muted mb-4 text-center">
          Stripe の人数単位の契約に使用します
        </p>
        <div className="mb-6">
          <label
            htmlFor="seat-count"
            className="block text-sm font-medium text-text-secondary mb-2"
          >
            利用人数（席数）
          </label>
          <input
            id="seat-count"
            type="number"
            min={MIN_SEATS}
            max={MAX_SEATS}
            value={seatCount < MIN_SEATS ? "" : seatCount}
            onChange={(e) => {
              const v = e.target.value === "" ? 0 : parseInt(e.target.value, 10);
              setSeatCount(Number.isNaN(v) ? MIN_SEATS : v);
            }}
            className="w-full px-4 py-3 rounded-xl border border-border-default bg-surface text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue/50 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            disabled={loading}
            autoFocus
          />
          <p className="mt-1 text-xs text-text-muted">
            {MIN_SEATS}〜{MAX_SEATS}人
          </p>
        </div>
        {error && (
          <p className="mb-4 text-sm text-red-500 text-center">{error}</p>
        )}
        <button
          type="button"
          onClick={handleSeatNext}
          disabled={loading || seats < MIN_SEATS}
          className="w-full py-3.5 rounded-xl bg-brand-blue text-white text-sm font-medium hover:bg-brand-blue/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          {loading ? "登録中..." : seats === 1 ? "個人で始める" : "次へ"}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmitOrg}>
      <p className="text-sm text-text-secondary mb-2 text-center">
        チームで使う場合は組織名を入力してください
      </p>
      <p className="text-xs text-text-muted mb-4 text-center">
        契約席数: {seats}人
      </p>
      <div className="mb-4">
        <label
          htmlFor="company-name"
          className="block text-sm font-medium text-text-secondary mb-2"
        >
          会社名・組織名
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
        className="w-full py-3.5 rounded-xl bg-brand-blue text-white text-sm font-medium hover:bg-brand-blue/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer mb-3"
      >
        {loading ? "登録中..." : "登録して始める"}
      </button>
      <button
        type="button"
        onClick={handleSkipToIndividual}
        disabled={loading}
        className="w-full py-2.5 rounded-xl border border-border-default text-text-muted text-sm hover:bg-border-default/30 hover:text-text-secondary transition-colors cursor-pointer"
      >
        個人の場合はスキップ
      </button>
      <button
        type="button"
        onClick={() => { setStep(1); setError(""); }}
        disabled={loading}
        className="w-full mt-2 py-2 text-text-muted text-xs hover:text-text-secondary transition-colors cursor-pointer"
      >
        ← 人数入力に戻る
      </button>
    </form>
  );
}
