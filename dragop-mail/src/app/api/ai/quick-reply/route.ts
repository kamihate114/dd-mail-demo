import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import type { ChatCompletion } from "openai/resources/chat/completions";
import { QuickReplyRequest, QuickReplyResponse, DropZoneId } from "@/lib/ai-types";
import { getQuickReplySystemPrompt, buildQuickReplyUserMessage } from "@/lib/quick-reply-prompts";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// GPT-5 nano — 高速・低コストのクイック返信向け
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

  try {
    const systemPrompt = getQuickReplySystemPrompt();
    const userMessage = buildQuickReplyUserMessage(dropZone, emailContext);

    const completion = await openai.chat.completions.create({
      model: MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      max_completion_tokens: 2000,
    } as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming) as ChatCompletion;

    const choice = completion.choices[0];
    const content = choice?.message?.content || "{}";

    const parsed = JSON.parse(stripCodeFence(content)) as QuickReplyResponse;

    // Ensure required fields
    parsed.summary = parsed.summary || "";
    parsed.replySubject = parsed.replySubject || `Re: ${emailContext.subject}`;
    parsed.draftReplies = parsed.draftReplies || [];
    parsed.tone = parsed.tone || "";

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
