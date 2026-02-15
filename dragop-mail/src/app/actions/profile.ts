"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type UpdateDisplayNameResult = { error?: string };

/** 表示名（ユーザーネーム）を更新 */
export async function updateDisplayName(displayName: string): Promise<UpdateDisplayNameResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "ログインしてください" };

  const trimmed = displayName.trim();
  if (!trimmed) return { error: "ユーザーネームを入力してください" };

  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from("profiles")
      .update({ display_name: trimmed })
      .eq("id", user.id);
    if (error) return { error: "更新に失敗しました" };
    return {};
  } catch {
    return { error: "更新に失敗しました" };
  }
}
