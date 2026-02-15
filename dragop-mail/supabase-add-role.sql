-- ═══════════════════════════════════════════════════════════════
-- Zeroprompt Mail 用 Supabase スキーマ
--
-- 【必須】招待URLの保存・ダッシュボード表示には invitations テーブルが必要です。
-- 未実行の場合、招待URLは Supabase に保存されず、ダッシュボードにも表示されません。
--
-- 実行手順: Supabase Dashboard → SQL Editor → このファイルの内容を貼り付けて Run
-- ═══════════════════════════════════════════════════════════════

-- 1. tenants（会社・ワークスペース）
CREATE TABLE IF NOT EXISTS public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 2. profiles（auth.users と 1:1。tenant_id, role, seat_count）
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  role text,
  seat_count integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 既存の profiles がある場合、不足カラムだけ追加
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS seat_count integer;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

COMMENT ON COLUMN public.profiles.role IS 'admin: 会社作成者, member: 招待で参加';
COMMENT ON COLUMN public.profiles.seat_count IS '契約席数（Stripe 用）。1〜9999';

-- 3. invitations（招待URL用。登録時に1件作成し、ダッシュボードで表示）
CREATE TABLE IF NOT EXISTS public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  email text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

-- 既存の invitations に不足カラムがある場合に追加（status がないとエラーになります）
ALTER TABLE public.invitations ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';
ALTER TABLE public.invitations ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.invitations ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

COMMENT ON TABLE public.invitations IS '招待URL用。status=pending & email=null の1件をダッシュボードで表示';

-- RLS（必要なら有効化。admin クライアントは RLS をバイパス）
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- 例: 自分のプロフィールのみ読めるポリシー（anon でログイン済みの場合）
-- CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
-- 招待・テナントはサービスロールで操作するため、ここではポリシーを緩めにしておくか、必要に応じて追加
