export interface EmailItem {
  id: string;
  sender: string;
  senderEmail: string;
  subject: string;
  preview: string;
  body: string;
  receivedAt: string;
  receivedDate?: string; // ISO date string for grouping (e.g. "2025-02-07")
  unread: boolean;
  threadId?: string;         // Gmail threadId — used for reply threading
  conversationId?: string;   // Outlook conversationId — used for reply threading
}

export const MOCK_EMAILS: EmailItem[] = [
  {
    id: "mail-1",
    sender: "田中太郎",
    senderEmail: "tanaka@example.com",
    subject: "プロジェクト進捗報告",
    preview: "今週のスプリントレビューの件ですが...",
    body: "今週のスプリントレビューの件ですが、以下のタスクが完了しました。\n- UIデザインの更新\n- APIエンドポイントの実装\n- テストケースの追加\n\n来週の予定について確認をお願いします。",
    receivedAt: "10:32",
    unread: true,
  },
  {
    id: "mail-2",
    sender: "佐藤花子",
    senderEmail: "sato@example.com",
    subject: "ミーティング日程の確認",
    preview: "来週のミーティングについて...",
    body: "来週のミーティングについて確認です。\n\n日時: 2月10日（月）14:00-15:00\n場所: 会議室A（オンライン可）\n議題: Q1レビューと次期計画\n\n参加可否をご連絡ください。",
    receivedAt: "09:15",
    unread: true,
  },
  {
    id: "mail-3",
    sender: "鈴木一郎",
    senderEmail: "suzuki@example.com",
    subject: "契約書の確認依頼",
    preview: "添付の契約書をご確認ください...",
    body: "お疲れ様です。鈴木です。\n\n添付の契約書をご確認ください。\n修正点がありましたら、今週金曜日までにご連絡いただけますと幸いです。\n\n1. 納期の変更（3月末→4月中旬）\n2. 支払い条件の修正\n3. 免責事項の追加\n\nよろしくお願いいたします。",
    receivedAt: "昨日",
    unread: false,
  },
  {
    id: "mail-4",
    sender: "山田美咲",
    senderEmail: "yamada@example.com",
    subject: "デザインレビューのフィードバック",
    preview: "先日のデザインレビューについて...",
    body: "先日のデザインレビューについてフィードバックをまとめました。\n\n・ヘッダーのナビゲーションを簡略化する\n・カラーパレットをブランドガイドに合わせる\n・モバイル対応の優先度を上げる\n\n次回のレビューまでに修正版を共有します。",
    receivedAt: "昨日",
    unread: false,
  },
  {
    id: "mail-5",
    sender: "高橋健太",
    senderEmail: "takahashi@example.com",
    subject: "サーバー移行のお知らせ",
    preview: "来月のサーバー移行について...",
    body: "インフラチームの高橋です。\n\n来月のサーバー移行について、以下のスケジュールで進めます。\n\n- 2月15日: ステージング環境テスト\n- 2月22日: 本番切り替え（深夜2:00-5:00）\n- 2月23日: 動作確認\n\n影響範囲と対応手順は別途共有します。",
    receivedAt: "2/5",
    unread: false,
  },
  {
    id: "mail-6",
    sender: "中村さくら",
    senderEmail: "nakamura@example.com",
    subject: "歓迎会の企画について",
    preview: "新メンバーの歓迎会を企画しています...",
    body: "お疲れ様です。中村です。\n\n新メンバーの歓迎会を企画しています。\n\n候補日: 2月14日（金）or 2月21日（金）\n場所: 駅前のイタリアンレストラン\n予算: 5,000円/人\n\nどちらの日程がご都合よろしいですか？",
    receivedAt: "2/4",
    unread: false,
  },
];
