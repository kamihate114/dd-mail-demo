import { createClient } from "@supabase/supabase-js";

/**
 * サーバー専用。RLS をバイパスして profiles / tenants を操作するために使用。
 * 必ずサーバー（API Route / Server Action / Route Handler）からのみ使用すること。
 * 環境変数 SUPABASE_SERVICE_ROLE_KEY を .env.local に設定してください。
 * （Supabase ダッシュボード → Settings → API → service_role secret）
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY が設定されていません。.env.local に追加してください。"
    );
  }
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
