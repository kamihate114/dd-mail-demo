import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import type { ChatCompletion } from "openai/resources/chat/completions";
import {
  AiApiRequest,
  AiApiResponse,
  AiStep1Result,
  AiStep2Result,
  AiStep3Result,
} from "@/lib/ai-types";
import {
  SYSTEM_PROMPT,
  buildStep1UserMessage,
  buildStep2UserMessage,
  buildStep3UserMessage,
} from "@/lib/ai-prompts";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// GPT-5 reasoning models — use max_completion_tokens & reasoning_effort
// temperature は非対応。max_tokens ではなく max_completion_tokens を使用。
const MODEL_MINI = "gpt-5-mini";
const MODEL_NANO = "gpt-5-nano"; // GPT-5 nano - fastest and most cost-efficient

function stripCodeFence(text: string): string {
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return m ? m[1].trim() : text.trim();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function callGPT5(messages: Array<{ role: string; content: string }>, effort: string, maxTokens: number, model?: string): Promise<string> {
  const completion = await openai.chat.completions.create({
    model: model || MODEL_MINI,
    response_format: { type: "json_object" },
    messages: messages as Array<OpenAI.Chat.Completions.ChatCompletionMessageParam>,
    reasoning_effort: effort,
    max_completion_tokens: maxTokens,
  } as unknown as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming) as ChatCompletion;

  return completion.choices[0]?.message?.content || "{}";
}

export async function POST(request: NextRequest): Promise<NextResponse<AiApiResponse>> {
  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === "your-openai-api-key-here") {
    return NextResponse.json(
      { error: "OPENAI_API_KEY が設定されていません。.env.local を確認してください。" },
      { status: 500 },
    );
  }

  let body: AiApiRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "リクエストの解析に失敗しました。" }, { status: 400 });
  }

  const { step, emailContext } = body;
  if (!emailContext || !step) {
    return NextResponse.json({ error: "必須パラメータが不足しています。" }, { status: 400 });
  }

  try {
    if (step === 1) {
      const raw = await callGPT5(
        [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildStep1UserMessage(emailContext) },
        ],
        "low",
        2000,
      );
      const parsed = JSON.parse(stripCodeFence(raw)) as AiStep1Result;

      // Ensure exactly 3 actions
      if (!parsed.suggestedActions || parsed.suggestedActions.length < 3) {
        parsed.suggestedActions = [
          ...(parsed.suggestedActions || []),
          ...Array.from({ length: 3 - (parsed.suggestedActions?.length || 0) }, () => ({
            label: "返信する",
            prompt: "一般的な返信",
          })),
        ].slice(0, 3);
      }

      return NextResponse.json({ step1: parsed });
    }

    if (step === 2) {
      const { selectedAction, step1Result } = body;
      if (!selectedAction || !step1Result) {
        return NextResponse.json({ error: "Step 2に必要なパラメータが不足しています。" }, { status: 400 });
      }

      const raw = await callGPT5(
        [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildStep2UserMessage(emailContext, step1Result, selectedAction) },
        ],
        "medium",
        3000,
      );
      const parsed = JSON.parse(stripCodeFence(raw)) as AiStep2Result;

      return NextResponse.json({ step2: parsed });
    }

    if (step === 3) {
      const { editedDraft } = body;
      if (!editedDraft) {
        return NextResponse.json({ error: "Step 3に必要なパラメータが不足しています。" }, { status: 400 });
      }

      // Step 3は独立して完成メールのみから分析 (GPT-5 nano使用)
      const raw = await callGPT5(
        [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildStep3UserMessage(editedDraft) },
        ],
        "medium",
        2000,
        MODEL_NANO,
      );
      const parsed = JSON.parse(stripCodeFence(raw)) as AiStep3Result;

      // Ensure arrays exist
      parsed.todoCandidates = parsed.todoCandidates || [];
      parsed.calendarCandidates = parsed.calendarCandidates || [];
      parsed.checks = parsed.checks || [];

      return NextResponse.json({ step3: parsed });
    }

    return NextResponse.json({ error: "無効なステップです。" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[AI Route] Error:", message);
    return NextResponse.json({ error: `AI処理でエラーが発生しました: ${message}` }, { status: 500 });
  }
}
