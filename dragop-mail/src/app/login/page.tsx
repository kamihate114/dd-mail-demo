"use client";

import { createClient } from "@/lib/supabase/client";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function LoginContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const handleMicrosoftLogin = async () => {
    const supabase = createClient();

    // Build the redirect URL with invitation token if present
    const redirectTo = token
      ? `${window.location.origin}/auth/callback?token=${token}`
      : `${window.location.origin}/auth/callback`;

    await supabase.auth.signInWithOAuth({
      provider: "azure",
      options: {
        redirectTo,
        scopes: "email profile openid",
      },
    });
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-surface-raised rounded-2xl border border-border-default shadow-sm p-10">
          {/* Logo & Title */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand-blue/10 mb-5">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                className="text-brand-blue"
              >
                <path
                  d="M3 8L10.89 13.26C11.2187 13.4793 11.6049 13.5963 12 13.5963C12.3951 13.5963 12.7813 13.4793 13.11 13.26L21 8M5 19H19C19.5304 19 20.0391 18.7893 20.4142 18.4142C20.7893 18.0391 21 17.5304 21 17V7C21 6.46957 20.7893 5.96086 20.4142 5.58579C20.0391 5.21071 19.5304 5 19 5H5C4.46957 5 3.96086 5.21071 3.58579 5.58579C3.21071 5.96086 3 6.46957 3 7V17C3 17.5304 3.21071 18.0391 3.58579 18.4142C3.96086 18.7893 4.46957 19 5 19Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-text-primary mb-2">
              Zeroprompt Mailを始める
            </h1>
            <p className="text-sm text-text-secondary">
              Microsoftアカウントでサインインしてください
            </p>
          </div>

          {/* Microsoft Sign-in Button */}
          <button
            onClick={handleMicrosoftLogin}
            className="w-full flex items-center justify-center gap-3 px-4 py-3.5 rounded-xl border border-border-default bg-surface-raised hover:bg-surface transition-colors duration-150 cursor-pointer group"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 21 21"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect x="1" y="1" width="9" height="9" fill="#F25022" />
              <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
              <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
              <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
            </svg>
            <span className="text-sm font-medium text-text-primary group-hover:text-text-primary/80">
              Microsoftでサインイン
            </span>
          </button>

          {/* Footer Note */}
          <p className="mt-8 text-center text-xs text-text-muted leading-relaxed">
            サインインすることにより、
            <a href="#" className="text-brand-blue hover:underline">
              利用規約
            </a>
            および
            <a href="#" className="text-brand-blue hover:underline">
              プライバシーポリシー
            </a>
            に同意したことになります。
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-surface flex items-center justify-center">
          <div className="text-text-muted text-sm">読み込み中...</div>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
