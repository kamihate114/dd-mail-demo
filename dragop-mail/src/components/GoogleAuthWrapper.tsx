"use client";

import { GoogleOAuthProvider } from "@react-oauth/google";

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

export function GoogleAuthWrapper({ children }: { children: React.ReactNode }) {
  if (!CLIENT_ID) {
    // CLIENT_IDが未設定の場合はプロバイダなしで描画（モックモードで動作）
    return <>{children}</>;
  }

  return (
    <GoogleOAuthProvider clientId={CLIENT_ID}>
      {children}
    </GoogleOAuthProvider>
  );
}
