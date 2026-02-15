"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export type RegisterCompanyResult = { error?: string };

export async function registerCompany(
  companyName: string
): Promise<RegisterCompanyResult> {
  const trimmed = companyName.trim();
  if (!trimmed) {
    return { error: "会社名を入力してください" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "ログインしていません。再度ログインしてください。" };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    console.error("Admin client:", e);
    return {
      error:
        "サーバー設定エラーです。SUPABASE_SERVICE_ROLE_KEY を .env.local に追加してください。",
    };
  }

  // 1. Create tenant (admin = RLS をバイパス)
  const { data: tenant, error: tenantError } = await admin
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

  // 2. Profile がなければ作成し、tenant_id を設定（admin = RLS をバイパス）
  const { error: profileError } = await admin
    .from("profiles")
    .upsert(
      { id: user.id, tenant_id: tenant.id },
      { onConflict: "id" }
    );

  if (profileError) {
    console.error("Profile upsert error:", profileError);
    return { error: "プロフィールの更新に失敗しました。もう一度お試しください。" };
  }

  revalidatePath("/");
  revalidatePath("/onboarding");
  return {};
}
