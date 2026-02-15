"use client";

import { useState, useCallback, lazy, Suspense } from "react";
import { motion } from "framer-motion";
import { Mail, Loader2 } from "lucide-react";

interface MailLoginScreenProps {
  onLogin: (provider: "outlook" | "gmail") => void;
  onGmailAuth: (accessToken: string) => void;
  onOutlookAuth: (accessToken: string) => void;
  gmailLoading?: boolean;
  outlookLoading?: boolean;
  onRestoreSession?: (provider: "outlook" | "gmail") => void;
  onFullLogout?: (provider: "outlook" | "gmail") => void;
  savedProviders?: ("outlook" | "gmail")[];
}

const HAS_CLIENT_ID = !!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const HAS_MS_CLIENT_ID = !!process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID;

/* ---------- Provider icons ---------- */
function GmailIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"/>
    </svg>
  );
}

function OutlookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M7.88 12.04q0 .45-.11.87-.1.41-.33.74-.22.33-.58.52-.37.2-.87.2t-.85-.2q-.35-.21-.57-.55-.22-.33-.33-.75-.1-.42-.1-.86t.1-.87q.1-.43.34-.76.22-.34.59-.54.36-.2.87-.2t.86.2q.35.21.57.55.22.34.33.77.1.43.1.88zm-.25 0q0-.36-.07-.68-.07-.33-.21-.57-.14-.24-.36-.38-.22-.14-.54-.14-.32 0-.54.14-.22.14-.36.38-.14.24-.21.57-.07.32-.07.68 0 .36.07.68.07.33.21.57.14.24.36.38.22.14.54.14.32 0 .54-.14.22-.14.36-.38.14-.24.21-.57.07-.32.07-.68zM24 12v9.38q0 .46-.33.8-.33.32-.8.32H7.13q-.46 0-.8-.33-.32-.33-.32-.8V18H1q-.41 0-.7-.3-.3-.29-.3-.7V7q0-.41.3-.7Q.58 6 1 6h6.01V2.62q0-.46.33-.8.33-.32.8-.32h14.54q.46 0 .8.33.32.33.32.8zm-6.01 0v-1.45H7.01v1.45zm0 2.22V12.9H7.01v1.32zM7.01 16.56h10.98v-1.33H7.01zM1.02 7.01v9.97h5.98V6.01H1.02zM24 12V2.62q0-.13-.09-.22-.1-.1-.23-.1H7.13q-.13 0-.22.1-.1.09-.1.22v3.39h11.19q.46 0 .8.33.32.33.32.8V12z"/>
    </svg>
  );
}

const PROVIDER_META = {
  outlook: { label: "Outlook", subtitle: "Microsoft 365", iconColor: "text-[#0078D4]", bgLight: "bg-[#0078D4]/10 dark:bg-[#0078D4]/20", hoverBorder: "hover:border-[#0078D4]", Icon: OutlookIcon },
  gmail: { label: "Gmail", subtitle: "Google OAuth", iconColor: "text-red-500", bgLight: "bg-red-500/10 dark:bg-red-500/20", hoverBorder: "hover:border-red-400", Icon: GmailIcon },
};

/* ---------- Real OAuth Gmail button (lazy-loaded only when CLIENT_ID exists) ---------- */
function RealGmailButton({ onGmailAuth, gmailLoading }: { onGmailAuth: (t: string) => void; gmailLoading?: boolean }) {
  const { useGoogleLogin } = require("@react-oauth/google");
  const googleLogin = useGoogleLogin({
    onSuccess: (tokenResponse: { access_token: string }) => {
      onGmailAuth(tokenResponse.access_token);
    },
    onError: () => {
      alert("Googleログインに失敗しました。再試行してください。");
    },
    scope: "https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.compose https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/tasks",
  });

  return (
    <LoginButton provider="gmail" onClick={() => googleLogin()} loading={gmailLoading} />
  );
}

/* ---------- Real OAuth Outlook button ---------- */
function RealOutlookButton({ onOutlookAuth, outlookLoading }: { onOutlookAuth: (t: string) => void; outlookLoading?: boolean }) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const { msalLogin } = await import("@/lib/msal");
      const token = await msalLogin();
      onOutlookAuth(token);
    } catch (err: unknown) {
      console.error("[Dragop] Outlook login error:", err);
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (errorMsg.includes("popup_window_error") || errorMsg.includes("popup")) {
        alert("ポップアップがブロックされました。ブラウザのポップアップブロックを解除してください。");
      } else if (errorMsg.includes("user_cancelled")) {
        // ユーザーがキャンセルした場合は何もしない
      } else {
        alert(`Outlookログインに失敗しました。\n\n${errorMsg}\n\n再試行してください。`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <LoginButton provider="outlook" onClick={handleClick} loading={outlookLoading || loading} />
  );
}

/* ---------- Shared login button ---------- */
function LoginButton({ provider, onClick, loading }: { provider: "outlook" | "gmail"; onClick: () => void; loading?: boolean }) {
  const meta = PROVIDER_META[provider];
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`group flex w-full items-center gap-3 rounded-xl border border-border-default
                 bg-surface-raised/50 dark:bg-surface-raised px-4 py-3
                 ${meta.hoverBorder} hover:shadow-md
                 disabled:opacity-60 disabled:cursor-wait
                 transition-all duration-200`}
    >
      <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${meta.bgLight}`}>
        {loading ? (
          <Loader2 className={`h-4.5 w-4.5 ${meta.iconColor} animate-spin`} />
        ) : (
          <meta.Icon className={`h-4.5 w-4.5 ${meta.iconColor}`} />
        )}
      </div>
      <div className="flex-1 text-left">
        <p className="text-xs font-medium text-text-primary">
          {loading ? "接続中..." : <>{meta.label}で<br /><span className="font-normal">ログイン</span></>}
        </p>
        <p className="text-[10px] text-text-muted">{meta.subtitle}</p>
      </div>
      {!loading && (
        <svg className="h-4 w-4 text-text-muted transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      )}
    </button>
  );
}

/* ---------- Saved session button ---------- */
function SavedSessionButton({ provider, onRestore, onLogout }: { provider: "outlook" | "gmail"; onRestore: () => void; onLogout: () => void }) {
  const meta = PROVIDER_META[provider];
  return (
    <div className="flex w-full min-w-0 items-center gap-2">
      <button
        onClick={onRestore}
        className="group flex min-w-0 flex-1 basis-0 items-center gap-3 rounded-xl border-2 border-brand-blue/30
                   bg-brand-blue/5 dark:bg-brand-blue/10 px-4 py-3 w-full
                   hover:border-brand-blue hover:shadow-md hover:shadow-brand-blue/10
                   transition-all duration-200"
      >
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${meta.bgLight}`}>
          <meta.Icon className={`h-4.5 w-4.5 ${meta.iconColor}`} />
        </div>
        <div className="min-w-0 flex-1 text-left">
          <p className="text-xs font-semibold text-text-primary">{meta.label}</p>
        </div>
        <svg className="h-4 w-4 text-brand-blue transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
      <button
        onClick={onLogout}
        className="ml-auto shrink-0 rounded-lg p-2 text-text-muted hover:text-red-400 hover:bg-red-400/10 transition-colors"
        title="ログアウト"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
      </button>
    </div>
  );
}

export function MailLoginScreen({ onLogin, onGmailAuth, onOutlookAuth, gmailLoading, outlookLoading, onRestoreSession, onFullLogout, savedProviders }: MailLoginScreenProps) {
  const hasSaved = savedProviders && savedProviders.length > 0;
  const gmailSaved = savedProviders?.includes("gmail") ?? false;
  const outlookSaved = savedProviders?.includes("outlook") ?? false;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.25 }}
      className="flex h-full w-full min-w-0 flex-col items-center justify-center gap-6 px-2"
    >
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-blue/10 dark:bg-brand-blue/15">
          <Mail className="h-5 w-5 text-brand-blue" />
        </div>
        <h3 className="text-sm font-semibold text-text-primary">メールアカウント</h3>
        <p className="mt-1 text-[11px] text-text-muted">
          連携してメールを取り込む
        </p>
      </div>

      <div className="flex w-full min-w-0 flex-col self-stretch gap-3">
        {/* Saved sessions */}
        {hasSaved && onRestoreSession && onFullLogout && (
          <>
            <p className="text-[10px] font-semibold text-text-muted px-1">ログイン済み</p>
            {gmailSaved && (
              <SavedSessionButton
                provider="gmail"
                onRestore={() => onRestoreSession("gmail")}
                onLogout={() => onFullLogout("gmail")}
              />
            )}
            {outlookSaved && (
              <SavedSessionButton
                provider="outlook"
                onRestore={() => onRestoreSession("outlook")}
                onLogout={() => onFullLogout("outlook")}
              />
            )}
            {/* Show divider only if there are new login options below */}
            {(!gmailSaved || !outlookSaved) && (
              <div className="flex items-center gap-2 py-1">
                <div className="flex-1 h-px bg-border-default" />
                <span className="text-[9px] text-text-muted">または</span>
                <div className="flex-1 h-px bg-border-default" />
              </div>
            )}
          </>
        )}

        {/* Outlook — hide if already logged in with Outlook */}
        {!outlookSaved && (
          HAS_MS_CLIENT_ID ? (
            <RealOutlookButton onOutlookAuth={onOutlookAuth} outlookLoading={outlookLoading} />
          ) : (
            <LoginButton provider="outlook" onClick={() => onLogin("outlook")} />
          )
        )}

        {/* Gmail — hide if already logged in with Gmail */}
        {!gmailSaved && (
          <>
            {HAS_CLIENT_ID ? (
              <RealGmailButton onGmailAuth={onGmailAuth} gmailLoading={gmailLoading} />
            ) : (
              <LoginButton provider="gmail" onClick={() => onLogin("gmail")} loading={gmailLoading} />
            )}
          </>
        )}

        {(!HAS_CLIENT_ID && !gmailSaved) || (!HAS_MS_CLIENT_ID && !outlookSaved) ? (
          <p className="text-center text-[9px] text-text-muted">
            {!HAS_CLIENT_ID && !gmailSaved && "GOOGLE_CLIENT_ID"}
            {!HAS_CLIENT_ID && !gmailSaved && !HAS_MS_CLIENT_ID && !outlookSaved && " / "}
            {!HAS_MS_CLIENT_ID && !outlookSaved && "MICROSOFT_CLIENT_ID"}
            {" "}未設定のためデモモード
          </p>
        ) : null}
      </div>
    </motion.div>
  );
}
