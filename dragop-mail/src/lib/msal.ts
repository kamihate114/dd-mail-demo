/**
 * Microsoft Authentication Library (MSAL) configuration and login helper.
 * Uses popup flow with redirect fallback via @azure/msal-browser.
 */
import { PublicClientApplication, Configuration } from "@azure/msal-browser";

const MS_CLIENT_ID = process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID || "";

export const HAS_MS_CLIENT_ID = !!MS_CLIENT_ID;

const LOGIN_SCOPES: string[] = [
  "Mail.ReadWrite",
  "Mail.Send",
  "Calendars.ReadWrite",
  "Tasks.ReadWrite",
  "User.Read",
];

function getRedirectUri(): string {
  if (typeof window === "undefined") return "";
  // Must exactly match Azure AD > Authentication > SPA redirect URI
  return window.location.origin;
}

function buildMsalConfig(): Configuration {
  return {
    auth: {
      clientId: MS_CLIENT_ID,
      authority: "https://login.microsoftonline.com/common",
      redirectUri: getRedirectUri(),
    },
    cache: {
      cacheLocation: "localStorage",
    },
  };
}

let msalInstance: PublicClientApplication | null = null;
let msalClientId: string = "";
let msalInitialized = false;

async function getMsalInstance(): Promise<PublicClientApplication> {
  if (!MS_CLIENT_ID) {
    throw new Error(
      "NEXT_PUBLIC_MICROSOFT_CLIENT_ID が設定されていません。.env.local に Microsoft のクライアント ID を設定してください。"
    );
  }
  if (msalInstance && msalClientId !== MS_CLIENT_ID) {
    msalInstance = null;
    msalInitialized = false;
  }
  if (!msalInstance) {
    msalInstance = new PublicClientApplication(buildMsalConfig());
    msalClientId = MS_CLIENT_ID;
  }
  if (!msalInitialized) {
    await msalInstance.initialize();
    // Handle redirect callback (for redirect flow fallback)
    try {
      await msalInstance.handleRedirectPromise();
    } catch (e) {
      console.warn("[Dragop] MSAL handleRedirectPromise error:", e);
    }
    msalInitialized = true;
  }
  return msalInstance;
}

/**
 * Check if user already has an active MSAL session and try to get token silently.
 * Called on app mount to detect redirect flow completion.
 */
export async function msalTryGetToken(): Promise<string | null> {
  if (!HAS_MS_CLIENT_ID) return null;
  try {
    const pca = await getMsalInstance();
    const accounts = pca.getAllAccounts();
    if (accounts.length === 0) return null;

    const result = await pca.acquireTokenSilent({
      scopes: LOGIN_SCOPES,
      account: accounts[0],
    });
    console.log("[Dragop] MSAL silent token acquired for:", accounts[0].username);
    return result.accessToken;
  } catch {
    return null;
  }
}

/**
 * 既存の Microsoft セッション（ブラウザのログイン状態）を使って
 * ユーザー操作なしでトークンを取得する。
 * 最初の Microsoft ログイン直後にメールを表示するために使用。
 */
export async function msalSsoSilent(loginHint: string): Promise<string | null> {
  if (!HAS_MS_CLIENT_ID || !loginHint?.trim()) return null;
  try {
    const pca = await getMsalInstance();
    const result = await pca.ssoSilent({
      scopes: LOGIN_SCOPES,
      loginHint: loginHint.trim(),
    });
    if (result?.account) {
      console.log("[Dragop] MSAL SSO silent token acquired for:", result.account.username);
    }
    return result?.accessToken ?? null;
  } catch {
    return null;
  }
}

/**
 * Clear all MSAL-related data from localStorage.
 * Call this when the user logs out of Outlook so that reload does not restore the session.
 */
export function msalClearCache(): void {
  if (typeof window === "undefined") return;
  const keys = Object.keys(localStorage);
  for (const key of keys) {
    if (
      key.startsWith("msal.") ||
      key.includes("login.microsoftonline") ||
      key.includes("login.windows.net") ||
      key.includes(MS_CLIENT_ID)
    ) {
      localStorage.removeItem(key);
    }
  }
}

/**
 * このタブのまま Microsoft にリダイレクト（新しいタブは開かない）。
 */
export async function msalLogin(): Promise<string> {
  if (!HAS_MS_CLIENT_ID) {
    throw new Error(
      "NEXT_PUBLIC_MICROSOFT_CLIENT_ID が設定されていません。.env.local に Microsoft のクライアント ID を設定してください。"
    );
  }
  const pca = await getMsalInstance();
  sessionStorage.setItem("dragop-msal-redirect-pending", "1");
  await pca.loginRedirect({
    scopes: LOGIN_SCOPES,
    prompt: "select_account",
    extraQueryParameters: { display: "page" },
  });
  return "";
}
