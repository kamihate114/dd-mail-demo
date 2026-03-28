# Zero Prompt Mail

**ドラッグ&ドロップ一操作でビジネスメールをAIが分析・返信下書きまで行うメールアシスタント**

🔗 **[デモを試す → https://dd-mail-demo.vercel.app](https://dd-mail-demo.vercel.app)**

> APIキー不要・ログイン不要でそのまま動作します。

---

## デモの動かし方

APIキー不要のモックモードで動作します。

```bash
npm install
npm run dev   # http://localhost:3010
```

> `.env.local` は不要です。Supabase・OpenAI なしで全機能が動作します。

---

## 機能概要

### 1. メール一覧（左サイドバー）
受信トレイのメールを一覧表示。未読・送信者・件名を確認できます。

### 2. ドラッグ&ドロップで AI 分析を起動

メールカードをメインエリアにドロップすると、3ステップの AI ワークフローが自動起動します。

```
Step 1：メール分析
  ├─ ステータス判定（緊急 / 要返信 / 確認のみ）
  ├─ 状況の構造化サマリー
  ├─ AI インサイト（リスク・優先順位・戦略的観点）
  ├─ Todo 抽出
  └─ 返信アクション候補 3 案

Step 2：返信下書き生成
  └─ 選んだアクションに対応した本文を生成（敬語・構造・トーン調整済み）

Step 3：送信前チェック
  ├─ Todo / カレンダー登録候補の提示
  └─ 誤字・敬語・情報欠落の指摘
```

### 3. Quick Reply（Yes / No ゾーン）

メールを **Yes ゾーン** または **No ゾーン** にドロップすると、状況に応じた即時返信下書きを生成します。

---

## デモ収録シナリオ（6件）

| # | シナリオ | 難度 |
|---|---|---|
| 1 | 役員会2時間前・決算資料の緊急修正依頼 | 高 |
| 2 | 取引先からのシステム移行スケジュール変更交渉 | 高 |
| 3 | 組織改編に伴う人員配置の承認依頼（本日中） | 中 |
| 4 | 法務部からの契約書レビュー結果・3点の必須修正 | 高 |
| 5 | 大口顧客からの正式クレーム・SLA見直し要求 | 高 |
| 6 | 期末経費精算の締め切り通知（部内周知が必要） | 低 |

---

## 技術スタック

| カテゴリ | 技術 |
|---|---|
| フレームワーク | Next.js 15 (App Router, Turbopack) |
| 言語 | TypeScript |
| スタイリング | Tailwind CSS |
| 認証（本番） | Supabase Auth / Microsoft MSAL (Outlook OAuth) / Google OAuth |
| AI（本番） | OpenAI API (GPT-4o) |
| インタラクション | HTML5 Drag and Drop API（カスタムイベント設計） |
| デプロイ | Vercel |

---

## アーキテクチャ上の工夫

### ドラッグ&ドロップの設計
`application/x-dragop-email` というカスタム MIME タイプでメールデータを転送し、`dragop-drop` カスタムイベントで `MainEditor` コンポーネントへ受け渡す設計にしています。標準の DOM イベントのみで実装しており、外部ライブラリ不使用です。

### モックとプロダクションの切り替え
`page.tsx` で `callAiApi` 関数を差し替えるだけで API 呼び出しとモックデータを切り替えられる設計にしています。`MainEditor` も `onQuickReplyApi` prop で同様に差し替え可能です。

---

## ディレクトリ構成

```
src/
├── app/
│   ├── page.tsx          # メインページ・状態管理
│   └── api/ai/           # OpenAI APIルート（本番用）
├── components/
│   ├── MailInbox.tsx     # 左サイドバー・メール一覧
│   └── MainEditor.tsx    # メインエリア・AIワークフロー
└── lib/
    ├── mockEmails.ts     # デモ用メールデータ（6件）
    └── mockAiResponses.ts # デモ用AIレスポンス（全ステップ）
```

---

## 作者

**亀山 雄介** — [GitHub](https://github.com/kamihate114)
