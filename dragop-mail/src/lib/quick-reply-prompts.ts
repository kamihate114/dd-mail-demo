import { AiEmailContext, DropZoneId } from "./ai-types";

/**
 * Quick Reply 用のシステムプロンプト（GPT-5 nano 向け）
 *
 * PAS法（Problem → Agitation → Solution）を意識し、
 * 中小企業の事務担当者が使いやすいシンプルで誠実な文章を生成する。
 * 二重敬語を避け、「です・ます」調で統一する。
 */

const BASE_SYSTEM = `あなたは日本語ビジネスメールの返信アシスタントです。
中小企業の事務担当者向けに、以下のルールで返信案を作成してください：

【文体ルール】
- 「です・ます」調で統一する
- 二重敬語を使わない（×「お伺いいたします」→ ○「伺います」）
- 一文は短く、読みやすいリズムにする
- PAS法（Problem認識 → 共感 → Solution提示）を意識する
- 署名（「--」以降の氏名・会社名・連絡先）は含めない

必ず指定されたJSON形式で回答してください。`;

const SUMMARY_INSTRUCTION = `まずメールの本文を3行で簡潔に要約してください（各行30文字以内）。`;

function buildDropYesPrompt(email: AiEmailContext): string {
  return `${SUMMARY_INSTRUCTION}

次に「快諾・進める」トーンで返信案を1つ作成してください。
- 相手の要望を肯定し、前向きな姿勢を示す
- 次のステップを具体的に提示する
- 感謝の一言を添える

以下のJSON形式で回答してください：
{
  "summary": "要約行1\\n要約行2\\n要約行3",
  "replySubject": "Re: ${email.subject}",
  "draftReplies": ["快諾トーンの返信本文"],
  "tone": "快諾・前向き"
}`;
}

function buildDropNoPrompt(email: AiEmailContext): string {
  return `${SUMMARY_INSTRUCTION}

次に「丁寧にお断り」トーンで返信案を1つ作成してください。
- 角を立てず、今回は見送る旨を簡潔に伝える
- 相手の提案への理解・感謝を示した上で断る
- 将来の可能性は否定しない（「今回は」「現時点では」等）
- 代替案があれば一言添える

以下のJSON形式で回答してください：
{
  "summary": "要約行1\\n要約行2\\n要約行3",
  "replySubject": "Re: ${email.subject}",
  "draftReplies": ["お断りトーンの返信本文"],
  "tone": "丁寧なお断り"
}`;
}

function buildDropDefaultPrompt(email: AiEmailContext): string {
  return `${SUMMARY_INSTRUCTION}

次に、状況に合わせた汎用的な返信案を3つ提示してください。
- 1つ目：前向きに対応する返信
- 2つ目：詳細確認・検討する返信
- 3つ目：丁寧にお断りする返信

以下のJSON形式で回答してください：
{
  "summary": "要約行1\\n要約行2\\n要約行3",
  "replySubject": "Re: ${email.subject}",
  "draftReplies": ["前向きな返信本文", "確認・検討の返信本文", "お断りの返信本文"],
  "tone": "要約・おまかせ"
}`;
}

export function getQuickReplySystemPrompt(): string {
  return BASE_SYSTEM;
}

export function buildQuickReplyUserMessage(dropZone: DropZoneId, email: AiEmailContext): string {
  const emailBlock = `以下のメールに対して返信してください。

件名: ${email.subject}
差出人: ${email.sender} <${email.senderEmail}>

本文:
${email.body}

`;

  switch (dropZone) {
    case "drop-yes":
      return emailBlock + buildDropYesPrompt(email);
    case "drop-no":
      return emailBlock + buildDropNoPrompt(email);
    case "drop-default":
      return emailBlock + buildDropDefaultPrompt(email);
  }
}
