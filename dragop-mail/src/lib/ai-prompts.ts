import { AiEmailContext, AiStep1Result, AiStep2Result } from "./ai-types";

/**
 * System prompt — 全ステップ共通の先頭メッセージ。
 * プロンプトキャッシュを最大限活用するため、ここは絶対に変えない。
 */
export const SYSTEM_PROMPT = `あなたは日本語ビジネスメールの専門アシスタントです。
以下の役割を担います：

1. メールの要約：受信メールの要点を簡潔にまとめる
2. ToDo抽出：相手が自分に求めているタスクを抽出する
3. アクション提案：文脈に即した3つの返信方針を提案する（うち1つは必ず断りの選択肢にする）
4. 返信文生成：選ばれた方針に基づき、丁寧な日本語ビジネスメールを生成する
5. 品質チェック：誤字脱字、敬語の誤り、情報の不足を厳しく検出する
6. スケジュール抽出：メール内の日付・時間情報を抽出する

必ず指定されたJSON形式で回答してください。`;

/**
 * 元メール情報 — 全ステップ共通の2番目のメッセージ（user）。
 * system + この部分がキャッシュのプレフィックスになる。
 */
export function buildEmailContextMessage(email: AiEmailContext): string {
  return `以下のメールについて、指示に従い分析・対応してください。

件名: ${email.subject}
差出人: ${email.sender} <${email.senderEmail}>

本文:
${email.body}`;
}

/* ---------- Step 1 ---------- */

export const STEP1_INSTRUCTION = `上記メールを分析してください。

以下のJSON形式で**すべてのフィールドを必ず埋めて**回答してください：
{
  "headline": "このメールの結論を40文字以内で表す見出し",
  "tags": [
    { "label": "メール内容から判定したアクション種別", "category": "action" },
    { "label": "メールから読み取れる感情トーン", "category": "sentiment" },
    { "label": "メールの主題キーワード", "category": "topic" }
  ],
  "summary": "メールの要約（1文、内部参照用）",
  "structuredSummary": {
    "situation": [
      "要点1（80文字以内）",
      "要点2（80文字以内）",
      "要点3（80文字以内）"
    ],
    "aiInsight": [
      { "label": "分析観点のラベル（6文字以内）", "text": "分析内容（40文字以内）" },
      { "label": "ラベル2", "text": "内容2" },
      { "label": "ラベル3", "text": "内容3" }
    ],
    "expectedAction": "あなたに期待されている具体的なアクション（例：『見積書を作成し、来週中に返送する必要があります。』）",
    "estimatedTime": "対応に必要な推定時間（例：『約30分』『1-2時間』）。不明な場合は省略可"
  },
  "extractedTodos": ["相手が自分に求めているタスク1", "タスク2"],
  "suggestedActions": [
    { "label": "ボタンに表示するテキスト", "prompt": "この方針の詳細説明" },
    { "label": "ボタン2", "prompt": "方針2の説明" },
    { "label": "ボタン3", "prompt": "方針3の説明" }
  ]
}

## ルール

### situation（状況 — 箇条書き）
- メールの要点を**2〜4個の箇条書き**（配列）で返してください
- 各項目は80文字以内で、1つの要点に絞る
- 背景・経緯・相手の意図・重要な条件など、メールを読まなくても状況が把握できるように

### headline
- メールの**結論**を40文字以内で表す見出し。読んだ人が「要するに何？」にすぐ答えられる一文にしてください
- **会社名・組織名・人名**がメール内にあれば、見出しに優先的に含めてください（例：「Aufhebenから選考フローの案内と準備の助言」「田中様から納期前倒しの相談」）

### aiInsight（AIの分析 — 必須、ちょうど3項目）
メールの表面的な内容を超えた**深層分析**を、メール内容に最も適した3つの観点で記述してください。
- 観点はメールごとに自由に選んでください（例：相手の本音、攻略ヒント、リスク評価、温度感、交渉力学、隠れた意図、チャンス度 等）
- **label**: 観点名を6文字以内の短いラベルにする
- **text**: 分析内容を**40文字以内**で簡潔に。忖度せず本音で書く

### tags（スロット制タグ — 最大3個）
以下の3カテゴリから**最も関連度の高いもの**を1つずつ選び、最大3個のタグを生成してください。
各カテゴリから0〜1個、合計で最大3個です。

1. **action**（必須・最優先）— メールに対して取るべきアクション種別。以下から1つ選択：
   - "緊急"：期限が迫っている、または即対応が必要
   - "要返信"：返信や何らかのアクションが求められている
   - "確認のみ"：確認だけで返信不要
   - "対応不要"：情報共有のみ、アクション不要

2. **sentiment**（任意）— メール全体から読み取れる感情的トーン。メールの文脈に合った自然な日本語で生成（3〜5文字程度）

3. **topic**（任意）— メールの主題を表す短いキーワード。メールの内容に基づいて具体的に生成（3〜6文字程度）

**重要：** actionタグは必ず1つ含めてください。sentimentとtopicは文脈から明確に判断できる場合のみ含めてください。

### suggestedActions
- 必ず3つ提案してください。
  - 1つ目と2つ目はメールの文脈に即した前向きな行動（例：「見積書を送る」「詳しく条件を聞く」）
  - 3つ目は必ず丁寧に断る・辞退する選択肢にしてください（例：「辞退する」「お断りする」）`;

/* ---------- Step 2 ---------- */

export function buildStep2Instruction(
  step1Result: AiStep1Result,
  selectedAction: string,
): string {
  return `上記メールに対する返信文を生成してください。

【メール分析結果】
要約: ${step1Result.summary}
相手からのToDo: ${step1Result.extractedTodos.join("、")}

【選択された返信方針】
${selectedAction}

上記の方針に沿った丁寧な日本語ビジネスメールの返信文を生成してください。
敬語を正しく使い、ビジネスマナーに則った文面にしてください。

**重要：署名（「--」以降の氏名・会社名・連絡先ブロック）は含めないでください。署名はユーザーが別途設定します。**

以下のJSON形式で回答してください：
{
  "replySubject": "Re: 元の件名（適切な返信件名）",
  "draftReply": "返信メール本文（件名は含めず本文のみ。末尾に署名は含めない）"
}`;
}

/* ---------- Step 3 ---------- */

export function buildStep3Instruction(
  step2Result: AiStep2Result,
  editedDraft: string,
): string {
  // 編集前後が同じなら「生成された返信文」、異なれば「ユーザーが編集した返信文」を示す
  const wasEdited = editedDraft !== step2Result.draftReply;
  const draftLabel = wasEdited ? "ユーザーが編集した最終返信文" : "生成された返信文";

  return `上記メールへの返信として以下の文面を最終チェックしてください。

【${draftLabel}】
件名: ${step2Result.replySubject}

${editedDraft}

以下のJSON形式で必ず回答してください：
{
  "todoCandidates": [
    { "text": "具体的なタスク内容", "notes": "期限や補足情報" }
  ],
  "calendarCandidates": [
    { "title": "予定タイトル", "date": "YYYY-MM-DD", "startTime": "HH:MM", "endTime": "HH:MM" }
  ],
  "checks": [
    { "type": "typo", "message": "具体的な指摘", "suggestion": "改善案" }
  ]
}

## 抽出ルール

### ToDo候補（todoCandidates）
以下の観点から**必ず1つ以上**のタスクを抽出してください：
- メール内で約束した内容（「送ります」「確認します」「調整します」など）
- 準備が必要な資料や情報
- 相手への返信待ちや確認事項
- 次のアクションとして必要な作業
- スケジュール調整やミーティング設定

**重要：**
- textフィールド（タスクタイトル）は**必ず25文字以内**にしてください
- 詳細情報はnotesフィールドに記載してください
例：{ "text": "見積書を作成して送付", "notes": "田中様宛、2月20日までに送付" }

### カレンダー候補（calendarCandidates）
元メールおよび返信文内に具体的な日時情報がある場合のみ抽出：
- 「〇月〇日」「〇時から」などの明示的な日時表現
- ミーティングや打ち合わせの予定
日時が不明確な場合は空配列。

### 品質チェック（checks）
以下の観点で**厳しく**チェックし、改善の余地があれば必ず指摘してください：

**typo（誤字脱字）：**
- 変換ミス、誤字、脱字
- 句読点の誤り（「、」「。」の位置）
- スペースの不自然な配置

**keigo（敬語の誤り）：**
- 二重敬語（「お伺いいたします」→「伺います」）
- 尊敬語と謙譲語の混同
- カジュアルすぎる表現
- 「です・ます」調の不統一

**missing_info（情報不足）：**
- 曖昧な表現（「後で」「近日中」など）
- 具体性に欠ける内容
- 相手が理解できない専門用語
- 返答が必要な質問への未回答

**完璧なメールでも、より良くできる改善案を1つ以上提案してください。**
問題が全くない場合のみ空配列にしてください。`;
}

/* ---------- Legacy exports (for backward compatibility) ---------- */

export function buildStep1UserMessage(email: AiEmailContext): string {
  return `${buildEmailContextMessage(email)}\n\n${STEP1_INSTRUCTION}`;
}

export function buildStep2UserMessage(
  email: AiEmailContext,
  step1Result: AiStep1Result,
  selectedAction: string,
): string {
  return `${buildEmailContextMessage(email)}\n\n${buildStep2Instruction(step1Result, selectedAction)}`;
}

export function buildStep3UserMessage(editedDraft: string): string {
  return `以下のビジネスメール文を詳細に分析してください。\n\n${editedDraft}`;
}
