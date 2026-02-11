import { AiEmailContext, AiStep1Result } from "./ai-types";

export const SYSTEM_PROMPT = `あなたは日本語ビジネスメールの専門アシスタントです。
以下の役割を担います：

1. メールの要約：受信メールの要点を簡潔にまとめる
2. ToDo抽出：相手が自分に求めているタスクを抽出する
3. アクション提案：文脈に即した3つの返信方針を提案する（うち1つは必ず断りの選択肢にする）
4. 返信文生成：選ばれた方針に基づき、丁寧な日本語ビジネスメールを生成する
5. 品質チェック：誤字脱字、敬語の誤り、情報の不足を厳しく検出する
6. スケジュール抽出：メール内の日付・時間情報を抽出する

必ず指定されたJSON形式で回答してください。`;

export function buildStep1UserMessage(email: AiEmailContext): string {
  return `以下のメールを分析してください。

件名: ${email.subject}
差出人: ${email.sender} <${email.senderEmail}>

本文:
${email.body}

以下のJSON形式で回答してください：
{
  "summary": "メールの要約（2-3文）",
  "extractedTodos": ["相手が自分に求めているタスク1", "タスク2", ...],
  "suggestedActions": [
    { "label": "ボタンに表示するテキスト", "prompt": "この方針の詳細説明" },
    { "label": "...", "prompt": "..." },
    { "label": "...", "prompt": "..." }
  ]
}

suggestedActionsは必ず3つ提案してください。
- 1つ目と2つ目はメールの文脈に即した前向きな行動（例：「見積書を送る」「詳しく条件を聞く」）
- 3つ目は必ず丁寧に断る・辞退する選択肢にしてください（例：「辞退する」「お断りする」）`;
}

export function buildStep2UserMessage(
  email: AiEmailContext,
  step1Result: AiStep1Result,
  selectedAction: string,
): string {
  return `以下のメールに対する返信文を生成してください。

【元メール】
件名: ${email.subject}
差出人: ${email.sender} <${email.senderEmail}>

本文:
${email.body}

【メール分析結果】
要約: ${step1Result.summary}
相手からのToDo: ${step1Result.extractedTodos.join("、")}

【選択された返信方針】
${selectedAction}

上記の方針に沿った丁寧な日本語ビジネスメールの返信文を生成してください。
敬語を正しく使い、ビジネスマナーに則った文面にしてください。

以下のJSON形式で回答してください：
{
  "replySubject": "Re: 元の件名（適切な返信件名）",
  "draftReply": "返信メール本文（件名は含めず本文のみ）"
}`;
}

export function buildStep3UserMessage(
  editedDraft: string,
): string {
  return `以下の返信メール文を分析し、ToDo候補・カレンダー候補・品質チェックを行ってください。

【返信メール文】
${editedDraft}

以下のJSON形式で回答してください：
{
  "todoCandidates": [
    { "text": "自分がやるべきタスク", "notes": "補足情報（任意）" }
  ],
  "calendarCandidates": [
    { "title": "予定のタイトル", "date": "YYYY-MM-DD", "startTime": "HH:MM", "endTime": "HH:MM" }
  ],
  "checks": [
    { "type": "typo|keigo|missing_info", "message": "指摘内容", "suggestion": "修正案（任意）" }
  ]
}

重要な指示：
- todoCandidatesはメール文から自分が今後やるべきアクションを抽出してください。約束した内容、準備すべき資料、確認事項など。具体的なタスクがない場合は空配列。
- calendarCandidatesは日時情報がある場合のみ抽出。日時情報がなければ空配列。
- checksは厳しくチェック：
  * typo: 誤字脱字、変換ミス、句読点の誤り
  * keigo: 敬語の誤り（二重敬語、不適切な表現）
  * missing_info: 情報不足、曖昧な表現
  問題なければ空配列。`;
}
