"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export type RegisterResult = { error?: string };

const MIN_SEATS = 1;
const MAX_SEATS = 9999;

async function getAdminAndUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "ログインしていません。再度ログインしてください。" as const, admin: null, user: null };
  }
  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    console.error("Admin client:", e);
    return {
      error: "サーバー設定エラーです。SUPABASE_SERVICE_ROLE_KEY を .env.local に追加してください。" as const,
      admin: null,
      user: null,
    };
  }
  return { error: null, admin, user };
}

function clampSeatCount(n: number): number {
  return Math.max(MIN_SEATS, Math.min(MAX_SEATS, Math.floor(n)));
}

/** 個人で使う（組織登録をスキップ）— 契約席数だけ保存 */
export async function registerAsIndividual(
  seatCount: number
): Promise<RegisterResult> {
  const seats = clampSeatCount(seatCount);

  const result = await getAdminAndUser();
  if (result.error || !result.admin || !result.user) return { error: result.error ?? undefined };

  const { data: tenant, error: tenantError } = await result.admin
    .from("tenants")
    .insert({ name: "マイワークスペース" })
    .select("id")
    .single();

  if (tenantError || !tenant) {
    console.error("Tenant insert error (individual):", tenantError);
    return { error: "登録に失敗しました。もう一度お試しください。" };
  }

  const { error: profileError } = await result.admin
    .from("profiles")
    .upsert(
      {
        id: result.user.id,
        tenant_id: tenant.id,
        role: "admin",
        seat_count: seats,
      },
      { onConflict: "id" }
    );

  if (profileError) {
    console.error("Profile upsert error:", profileError);
    return { error: "プロフィールの更新に失敗しました。もう一度お試しください。" };
  }

  // 招待URL用のトークンを登録時に1件作成（ダッシュボードでそのまま表示）
  const inviteToken = crypto.randomUUID();
  const { error: inviteErr } = await result.admin.from("invitations").insert({
    tenant_id: tenant.id,
    token: inviteToken,
    status: "pending",
    email: null,
  });
  if (inviteErr) {
    console.error("Invitation insert error (individual):", inviteErr);
    return {
      error: `招待URLの保存に失敗しました。（${inviteErr.message}）`,
    };
  }

  revalidatePath("/");
  revalidatePath("/onboarding");
  return {};
}

/** 組織（会社名）を登録して始める — 契約席数も保存（Stripe 用） */
export async function registerCompany(
  companyName: string,
  seatCount: number
): Promise<RegisterResult> {
  const trimmed = companyName.trim();
  if (!trimmed) {
    return { error: "会社名を入力してください" };
  }

  const seats = clampSeatCount(seatCount);

  const result = await getAdminAndUser();
  if (result.error || !result.admin || !result.user) return { error: result.error ?? undefined };

  const { data: tenant, error: tenantError } = await result.admin
    .from("tenants")
    .insert({ name: trimmed })
    .select("id")
    .single();

  if (tenantError || !tenant) {
    console.error("Tenant insert error:", tenantError);
    return {
      error: `会社の登録に失敗しました。もう一度お試しください。（${tenantError?.message ?? "不明なエラー"}）`,
    };
  }

  const { error: profileError } = await result.admin
    .from("profiles")
    .upsert(
      {
        id: result.user.id,
        tenant_id: tenant.id,
        role: "admin",
        seat_count: seats,
      },
      { onConflict: "id" }
    );

  if (profileError) {
    console.error("Profile upsert error:", profileError);
    return { error: "プロフィールの更新に失敗しました。もう一度お試しください。" };
  }

  // 招待URL用のトークンを登録時に1件作成（ダッシュボードでそのまま表示）
  const inviteToken = crypto.randomUUID();
  const { error: inviteErr } = await result.admin.from("invitations").insert({
    tenant_id: tenant.id,
    token: inviteToken,
    status: "pending",
    email: null,
  });
  if (inviteErr) {
    console.error("Invitation insert error (company):", inviteErr);
    return {
      error: `招待URLの保存に失敗しました。（${inviteErr.message}）`,
    };
  }

  revalidatePath("/");
  revalidatePath("/onboarding");
  return {};
}
