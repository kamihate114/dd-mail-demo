import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

const INVITATION_TOKEN_COOKIE = "sb_invitation_token";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  let token = searchParams.get("token"); // invitation token（URL にない場合は Cookie から）
  if (!token) {
    const cookie = request.cookies.get(INVITATION_TOKEN_COOKIE)?.value;
    if (cookie) token = decodeURIComponent(cookie);
  }
  const next = searchParams.get("next") ?? "/";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=no_code`);
  }

  const supabase = await createClient();

  // Exchange the auth code for a session
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/login?error=no_user`);
  }

  // 新規ユーザーだけ profiles を作成（既存の tenant_id を上書きしない）
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .single();
  if (!existingProfile) {
    try {
      const admin = createAdminClient();
      await admin.from("profiles").insert({ id: user.id, tenant_id: null });
    } catch (e) {
      console.error("Profile create in callback:", e);
    }
  }

  // ── Invitation token flow ──（RLS を避けるため admin で招待を取得）
  if (token) {
    let invitation: { id: string; tenant_id: string } | null = null;
    try {
      const admin = createAdminClient();
      const { data, error: invError } = await admin
        .from("invitations")
        .select("id, tenant_id, email, status")
        .eq("token", token)
        .eq("status", "pending")
        .maybeSingle();
      if (!invError && data) invitation = data;
    } catch {
      // admin 未設定時は anon で試行
      const { data } = await supabase
        .from("invitations")
        .select("id, tenant_id, email, status")
        .eq("token", token)
        .eq("status", "pending")
        .maybeSingle();
      invitation = data;
    }

    if (!invitation) {
      const res = NextResponse.redirect(`${origin}/login?error=invalid_invitation`);
      res.cookies.set(INVITATION_TOKEN_COOKIE, "", { path: "/", maxAge: 0 });
      return res;
    }

    // Accept the invitation: update profile with tenant_id and role = member
    try {
      const admin = createAdminClient();
      const { error: profileError } = await admin
        .from("profiles")
        .upsert(
          { id: user.id, tenant_id: invitation.tenant_id, role: "member" },
          { onConflict: "id" }
        );
      if (profileError) {
        const res = NextResponse.redirect(`${origin}/login?error=profile_update_failed`);
        res.cookies.set(INVITATION_TOKEN_COOKIE, "", { path: "/", maxAge: 0 });
        return res;
      }
    } catch {
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ tenant_id: invitation.tenant_id, role: "member" })
        .eq("id", user.id);
      if (profileError) {
        const res = NextResponse.redirect(`${origin}/login?error=profile_update_failed`);
        res.cookies.set(INVITATION_TOKEN_COOKIE, "", { path: "/", maxAge: 0 });
        return res;
      }
    }

    // Mark invitation as accepted（RLS を避けるため admin で更新）
    try {
      const admin = createAdminClient();
      await admin.from("invitations").update({ status: "accepted" }).eq("id", invitation.id);
    } catch {
      await supabase.from("invitations").update({ status: "accepted" }).eq("id", invitation.id);
    }

    const res = NextResponse.redirect(`${origin}/`);
    res.cookies.set(INVITATION_TOKEN_COOKIE, "", { path: "/", maxAge: 0 });
    return res;
  }

  // ── Normal flow: check if user has a tenant（admin で読んで RLS に左右されない）──
  let hasTenant = false;
  try {
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .single();
    hasTenant = !!(profile?.tenant_id);
  } catch {
    // admin 失敗時は anon で再試行
    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .single();
    hasTenant = !!(profile?.tenant_id);
  }

  if (!hasTenant) {
    return NextResponse.redirect(`${origin}/onboarding`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
