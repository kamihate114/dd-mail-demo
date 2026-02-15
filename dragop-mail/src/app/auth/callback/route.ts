import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token = searchParams.get("token"); // invitation token
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

  // Ensure profile row exists (admin client so RLS doesn't block)
  try {
    const admin = createAdminClient();
    await admin.from("profiles").upsert(
      { id: user.id, tenant_id: null },
      { onConflict: "id" }
    );
  } catch (e) {
    console.error("Profile upsert in callback:", e);
    // Continue; onboarding will retry with admin
  }

  // ── Invitation token flow ──
  if (token) {
    const { data: invitation, error: invError } = await supabase
      .from("invitations")
      .select("id, tenant_id, email, status")
      .eq("token", token)
      .eq("status", "pending")
      .single();

    if (invError || !invitation) {
      // Invalid or expired invitation — fall through to normal flow
      return NextResponse.redirect(`${origin}/login?error=invalid_invitation`);
    }

    // Accept the invitation: update profile with tenant_id
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ tenant_id: invitation.tenant_id })
      .eq("id", user.id);

    if (profileError) {
      return NextResponse.redirect(`${origin}/login?error=profile_update_failed`);
    }

    // Mark invitation as accepted
    await supabase
      .from("invitations")
      .update({ status: "accepted" })
      .eq("id", invitation.id);

    // Redirect to main app
    return NextResponse.redirect(`${origin}/`);
  }

  // ── Normal flow: check if user has a tenant ──
  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  // If no profile or no tenant_id, redirect to onboarding
  if (!profile || !profile.tenant_id) {
    return NextResponse.redirect(`${origin}/onboarding`);
  }

  // User has a tenant — go to main app
  return NextResponse.redirect(`${origin}${next}`);
}
