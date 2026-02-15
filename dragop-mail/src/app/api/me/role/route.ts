import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * 現在ログイン中のユーザーの role を返す。
 * Admin のときだけ左サイドバーに「ダッシュボード」を表示するために使用。
 * RLS を避けるため admin で profiles を読む。
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ role: null });
  }

  try {
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    return NextResponse.json({ role: profile?.role ?? null });
  } catch {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    return NextResponse.json({ role: profile?.role ?? null });
  }
}
