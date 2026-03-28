import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import type { ChatCompletion } from "openai/resources/chat/completions";
import { QuickReplyRequest, QuickReplyResponse, DropZoneId } from "@/lib/ai-types";
import { getQuickReplySystemPrompt, buildQuickReplyUserMessage } from "@/lib/quick-reply-prompts";

// GPT-5 nano を必ず使用
const MODEL = "gpt-5-nano";

function stripCodeFence(text: string): string {
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return m ? m[1].trim() : text.trim();
}

const VALID_DROP_ZONES = new Set<DropZoneId>(["drop-yes", "drop-no", "drop-default"]);

export async function POST(request: NextRequest): Promise<NextResponse<QuickReplyResponse>> {
  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === "your-openai-api-key-here") {
    return NextResponse.json(
      { summary: "", replySubject: "", draftReplies: [], tone: "", error: "OPENAI_API_KEY が設定されていません。.env.local を確認してください。" },
      { status: 500 },
    );
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  let body: QuickReplyRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { summary: "", replySubject: "", draftReplies: [], tone: "", error: "リクエストの解析に失敗しました。" },
      { status: 400 },
    );
  }

  const { dropZone, emailContext } = body;
  if (!dropZone || !VALID_DROP_ZONES.has(dropZone) || !emailContext) {
    return NextResponse.json(
      { summary: "", replySubject: "", draftReplies: [], tone: "", error: "必須パラメータが不足しています。" },
      { status: 400 },
    );
  }

  const startedAt = Date.now();
  const systemPrompt = getQuickReplySystemPrompt();
  const userMessage = buildQuickReplyUserMessage(dropZone, emailContext);

  async function callWithModel(model: string) {
    const completion = await openai.chat.completions.create({
      model,
      reasoning_effort: "low",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      max_completion_tokens: 4000,
    } as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming) as ChatCompletion;

    const choice = completion.choices[0];
    const finishReason = choice?.finish_reason ?? "unknown";
    const content = choice?.message?.content || "{}";

    const raw = JSON.parse(stripCodeFence(content)) as Record<string, unknown>;
    let draftReplies: string[] = Array.isArray(raw.draftReplies) ? raw.draftReplies as string[]
      : Array.isArray(raw.draft_replies) ? raw.draft_replies as string[]
      : Array.isArray(raw.replies) ? raw.replies as string[]
      : (raw.content && typeof raw.content === "string") ? [raw.content]
      : [];
    // 空の場合は summary や content をフォールバック
    if (draftReplies.length === 0 && raw.summary && typeof raw.summary === "string" && raw.summary.trim()) {
      draftReplies = [raw.summary.trim()];
    }
    // まだ空の場合は同モデルで本文のみ再生成（gpt-5-nano固定）
    if (draftReplies.length === 0) {
      console.warn(`[AI Quick Reply] empty draftReplies (finish_reason=${finishReason}). raw=${JSON.stringify(raw).slice(0, 400)}`);
      const fallback = await openai.chat.completions.create({
        model,
        reasoning_effort: "low",
        messages: [
          { role: "system", content: "あなたは日本語ビジネスメールの返信アシスタントです。本文のみを出力してください。" },
          { role: "user", content: `${userMessage}\n\n出力条件:\n- 返信本文のみ\n- 2〜6文\n- 丁寧なです・ます調` },
        ],
        max_completion_tokens: 2000,
      } as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming) as ChatCompletion;
      const fallbackText = fallback.choices[0]?.message?.content?.trim() || "";
      if (fallbackText) {
        draftReplies = [fallbackText];
      }
    }
    const parsed: QuickReplyResponse = {
      summary: (raw.summary as string) || "",
      replySubject: (raw.replySubject as string) || (raw.reply_subject as string) || `Re: ${emailContext.subject}`,
      draftReplies,
      tone: (raw.tone as string) || (dropZone === "drop-yes" ? "快諾・前向き" : dropZone === "drop-no" ? "丁寧なお断り" : "要約・おまかせ"),
    };

    return parsed;
  }

  try {
    const parsed = await callWithModel(MODEL);
    console.log(`[AI Quick Reply] dropZone=${dropZone} ok in ${Date.now() - startedAt}ms, replies=${parsed.draftReplies.length}`);
    return NextResponse.json(parsed);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[AI Quick Reply] dropZone=${dropZone} failed in ${Date.now() - startedAt}ms:`, message);
    return NextResponse.json(
      { summary: "", replySubject: "", draftReplies: [], tone: "", error: `AI処理でエラーが発生しました: ${message}` },
      { status: 500 },
    );
  }
}
