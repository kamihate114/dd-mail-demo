import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * 現在ログイン中のユーザーの role, display_name, email を返す。
 * RLS を避けるため admin で profiles を読む。
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ role: null, display_name: null, email: null });
  }

  let role: string | null = null;
  let display_name: string | null = null;

  try {
    const admin = createAdminClient();
    const { data: profile, error } = await admin
      .from("profiles")
      .select("role, display_name")
      .eq("id", user.id)
      .single();
    if (!error && profile) {
      role = profile.role ?? null;
      display_name = profile.display_name ?? null;
    }
    if (error) {
      const { data: fallback } = await admin
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      if (fallback) role = fallback.role ?? null;
    }
  } catch {
    try {
      const admin = createAdminClient();
      const { data: profile } = await admin
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      if (profile) role = profile.role ?? null;
    } catch {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      if (profile) role = profile.role ?? null;
    }
  }

  return NextResponse.json({
    role,
    display_name,
    email: user.email ?? null,
  });
}
