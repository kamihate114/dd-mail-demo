"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export type MemberRow = {
  id: string;
  email: string;
  role: string;
  created_at: string;
};

export type DashboardData = {
  members: MemberRow[];
  inviteUrl: string;
  inviteUrlError?: string;
  tenantName: string;
  seatCount: number | null;
  error?: string;
};

/** 現在のユーザーの admin / user 情報を取得 */
async function getAdminContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "未ログイン" as const, admin: null, user: null, profile: null };

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { error: "サーバー設定エラー" as const, admin: null, user: null, profile: null };
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("tenant_id, role, seat_count")
    .eq("id", user.id)
    .single();

  if (!profile?.tenant_id) {
    return { error: "テナント未設定" as const, admin: null, user: null, profile: null };
  }

  return { error: null, admin, user, profile };
}

/** ダッシュボード初期データ取得 */
export async function fetchDashboardData(): Promise<DashboardData> {
  const ctx = await getAdminContext();
  if (ctx.error || !ctx.admin || !ctx.user || !ctx.profile) {
    return { members: [], inviteUrl: "", tenantName: "", seatCount: null, error: ctx.error ?? "不明なエラー" };
  }

  if (ctx.profile.role !== "admin") {
    return { members: [], inviteUrl: "", tenantName: "", seatCount: null, error: "管理者権限が必要です" };
  }

  const inviteTableMissingMessage =
    "招待URLを表示するには、Supabase の SQL Editor で supabase-add-role.sql を実行し、invitations テーブルを作成してください。";

  const tenantId = ctx.profile.tenant_id;

  // テナント名取得
  const { data: tenant } = await ctx.admin
    .from("tenants")
    .select("name")
    .eq("id", tenantId)
    .single();

  // メンバー一覧（profiles + auth.users のメール）
  const { data: profiles } = await ctx.admin
    .from("profiles")
    .select("id, role, created_at")
    .eq("tenant_id", tenantId);

  const members: MemberRow[] = [];
  if (profiles) {
    for (const p of profiles) {
      // auth.users からメールを取得
      const { data: authUser } = await ctx.admin.auth.admin.getUserById(p.id);
      members.push({
        id: p.id,
        email: authUser?.user?.email ?? "不明",
        role: p.role ?? "member",
        created_at: p.created_at ?? new Date().toISOString(),
      });
    }
  }

  // 招待URL用トークン（通常はオンボーディング登録時に1件作成済み）。なければここで作成
  const { data: existingInvite, error: selectInviteErr } = await ctx.admin
    .from("invitations")
    .select("token")
    .eq("tenant_id", tenantId)
    .eq("status", "pending")
    .is("email", null)
    .limit(1)
    .maybeSingle();

  let inviteToken = existingInvite?.token;
  let inviteUrlError: string | undefined;

  if (selectInviteErr) {
    inviteUrlError = inviteTableMissingMessage;
  } else if (!inviteToken) {
    const token = crypto.randomUUID();
    const { error: invErr } = await ctx.admin.from("invitations").insert({
      tenant_id: tenantId,
      token,
      status: "pending",
      email: null,
    });
    if (invErr) {
      inviteUrlError = inviteTableMissingMessage;
    } else {
      inviteToken = token;
    }
  }

  const origin =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    (typeof process.env.VERCEL_URL === "string"
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");
  const inviteUrl = inviteToken ? `${origin}/login?token=${inviteToken}` : "";

  return {
    members,
    inviteUrl,
    inviteUrlError,
    tenantName: tenant?.name ?? "ワークスペース",
    seatCount: ctx.profile.seat_count ?? null,
  };
}

/** メンバーの権限を admin に変更 */
export async function promoteToAdmin(memberId: string): Promise<{ error?: string }> {
  const ctx = await getAdminContext();
  if (ctx.error || !ctx.admin || !ctx.profile) return { error: ctx.error ?? "エラー" };
  if (ctx.profile.role !== "admin") return { error: "管理者権限が必要です" };

  // 対象が同じテナントか確認
  const { data: target } = await ctx.admin
    .from("profiles")
    .select("tenant_id")
    .eq("id", memberId)
    .single();

  if (target?.tenant_id !== ctx.profile.tenant_id) {
    return { error: "このメンバーは同じ組織に所属していません" };
  }

  const { error } = await ctx.admin
    .from("profiles")
    .update({ role: "admin" })
    .eq("id", memberId);

  if (error) return { error: "権限変更に失敗しました" };
  revalidatePath("/dashboard");
  return {};
}

/** 管理者をメンバーに降格 */
export async function demoteToMember(memberId: string): Promise<{ error?: string }> {
  const ctx = await getAdminContext();
  if (ctx.error || !ctx.admin || !ctx.profile) return { error: ctx.error ?? "エラー" };
  if (ctx.profile.role !== "admin") return { error: "管理者権限が必要です" };

  // 自分自身は降格不可
  if (memberId === ctx.user!.id) {
    return { error: "自分自身を降格することはできません" };
  }

  const { data: target } = await ctx.admin
    .from("profiles")
    .select("tenant_id, role")
    .eq("id", memberId)
    .single();

  if (target?.tenant_id !== ctx.profile.tenant_id) {
    return { error: "このメンバーは同じ組織に所属していません" };
  }
  if (target?.role !== "admin") {
    return { error: "対象は既にメンバーです" };
  }

  // 同じテナントの管理者が自分含め2人以上いることを確認（最後の1人は降格不可）
  const { data: admins } = await ctx.admin
    .from("profiles")
    .select("id")
    .eq("tenant_id", ctx.profile.tenant_id)
    .eq("role", "admin");
  if ((admins?.length ?? 0) < 2) {
    return { error: "管理者が1人だけのため降格できません" };
  }

  const { error } = await ctx.admin
    .from("profiles")
    .update({ role: "member" })
    .eq("id", memberId);

  if (error) return { error: "権限変更に失敗しました" };
  revalidatePath("/dashboard");
  return {};
}

/** メンバーを組織から削除 */
export async function removeMember(memberId: string): Promise<{ error?: string }> {
  const ctx = await getAdminContext();
  if (ctx.error || !ctx.admin || !ctx.user || !ctx.profile) return { error: ctx.error ?? "エラー" };
  if (ctx.profile.role !== "admin") return { error: "管理者権限が必要です" };

  // 自分自身は削除不可
  if (memberId === ctx.user.id) {
    return { error: "自分自身を削除することはできません" };
  }

  // 対象が同じテナントか確認
  const { data: target } = await ctx.admin
    .from("profiles")
    .select("tenant_id")
    .eq("id", memberId)
    .single();

  if (target?.tenant_id !== ctx.profile.tenant_id) {
    return { error: "このメンバーは同じ組織に所属していません" };
  }

  // テナントから外す（tenant_id を null に、role をリセット）
  const { error } = await ctx.admin
    .from("profiles")
    .update({ tenant_id: null, role: null })
    .eq("id", memberId);

  if (error) return { error: "メンバーの削除に失敗しました" };
  revalidatePath("/dashboard");
  return {};
}

/** 新しい招待URLを再生成 */
export async function regenerateInviteUrl(): Promise<{ inviteUrl?: string; error?: string }> {
  const ctx = await getAdminContext();
  if (ctx.error || !ctx.admin || !ctx.profile) return { error: ctx.error ?? "エラー" };
  if (ctx.profile.role !== "admin") return { error: "管理者権限が必要です" };

  const token = crypto.randomUUID();
  const { error } = await ctx.admin.from("invitations").insert({
    tenant_id: ctx.profile.tenant_id,
    token,
    status: "pending",
    email: null,
  });

  if (error) return { error: "招待URLの生成に失敗しました" };

  const origin =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    (typeof process.env.VERCEL_URL === "string"
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");

  revalidatePath("/dashboard");
  return { inviteUrl: `${origin}/login?token=${token}` };
}
