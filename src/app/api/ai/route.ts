import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import type { ChatCompletion } from "openai/resources/chat/completions";
import {
  AiApiRequest,
  AiApiResponse,
  AiStep1Result,
  AiStep2Result,
  AiStep3Result,
  AiTag,
} from "@/lib/ai-types";
import {
  SYSTEM_PROMPT,
  buildEmailContextMessage,
  STEP1_INSTRUCTION,
  buildStep2Instruction,
  buildStep3Instruction,
} from "@/lib/ai-prompts";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? "dummy-key-for-build",
});

// GPT-5 mini — 全ステップ共通
const MODEL = "gpt-5-mini";

type Msg = { role: "system" | "user" | "assistant"; content: string };

function stripCodeFence(text: string): string {
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return m ? m[1].trim() : text.trim();
}

/**
 * 会話履歴を組み立てる。
 *
 * プロンプトキャッシュが最大限効くよう、先頭部分を全ステップで一致させる：
 *   [system] SYSTEM_PROMPT           ← 固定（キャッシュ①）
 *   [user]   元メール情報             ← 固定（キャッシュ②）
 *   [user]   Step 1 指示              ← Step 1 ではここまで
 *   [assistant] Step 1 結果 (JSON)    ← Step 2/3 で追加（キャッシュ③）
 *   [user]   Step 2 指示              ← Step 2 ではここまで
 *   [assistant] Step 2 結果 (JSON)    ← Step 3 で追加（キャッシュ④）
 *   [user]   Step 3 指示              ← Step 3 ではここまで
 */
function buildMessages(body: AiApiRequest): Msg[] {
  const { step, emailContext, step1Result, selectedAction, step2Result, editedDraft } = body;
  const msgs: Msg[] = [];

  // ── 共通プレフィックス（全ステップ同一）──
  msgs.push({ role: "system", content: SYSTEM_PROMPT });
  msgs.push({ role: "user", content: buildEmailContextMessage(emailContext) });

  // ── Step 1 ──
  msgs.push({ role: "user", content: STEP1_INSTRUCTION });

  if (step === 1) return msgs;

  // ── Step 1 → 2: Step 1 の結果を assistant として挿入 ──
  if (step1Result) {
    msgs.push({ role: "assistant", content: JSON.stringify(step1Result) });
  }

  if (selectedAction) {
    msgs.push({ role: "user", content: buildStep2Instruction(step1Result!, selectedAction) });
  }

  if (step === 2) return msgs;

  // ── Step 2 → 3: Step 2 の結果を assistant として挿入 ──
  if (step2Result) {
    msgs.push({ role: "assistant", content: JSON.stringify(step2Result) });
  }

  if (editedDraft && step2Result) {
    msgs.push({ role: "user", content: buildStep3Instruction(step2Result, editedDraft) });
  }

  return msgs;
}

async function callGPT(messages: Msg[], _effort: string, maxTokens: number): Promise<string> {
  const completion = await openai.chat.completions.create({
    model: MODEL,
    response_format: { type: "json_object" },
    messages: messages as Array<OpenAI.Chat.Completions.ChatCompletionMessageParam>,
    max_completion_tokens: maxTokens,
  } as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming) as ChatCompletion;

  const choice = completion.choices[0];
  const finishReason = choice?.finish_reason;
  const content = choice?.message?.content || "{}";

  if (finishReason !== "stop") {
    console.warn(`[AI Route] finish_reason=${finishReason}, content length=${content.length}`);
  }

  return content;
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

  const startedAt = Date.now();

  try {
    const messages = buildMessages(body);

    if (step === 1) {
      const raw = await callGPT(messages, "low", 3500);
      console.log(`[AI Route] step=1 raw response length:`, raw.length);
      console.log(`[AI Route] step=1 raw:`, raw.substring(0, 500));
      const parsed = JSON.parse(stripCodeFence(raw)) as AiStep1Result;

      // Ensure new fields exist with defaults
      parsed.headline = parsed.headline || "メール分析";
      parsed.structuredSummary = parsed.structuredSummary || {
        situation: parsed.summary || "",
        expectedAction: "内容をご確認ください。",
      };

      // ── Tags: normalize and ensure constraints ──
      const validCategories = new Set(["action", "sentiment", "topic"]);
      if (Array.isArray(parsed.tags) && parsed.tags.length > 0) {
        // Filter valid tags, deduplicate by category, limit to 3
        const deduped: AiTag[] = [];
        const seenCats = new Set<string>();
        for (const t of parsed.tags) {
          if (t.label && validCategories.has(t.category) && !seenCats.has(t.category)) {
            seenCats.add(t.category);
            deduped.push(t);
          }
          if (deduped.length >= 3) break;
        }
        parsed.tags = deduped;
      } else {
        parsed.tags = [];
      }

      // Ensure at least one action tag exists
      const hasAction = parsed.tags.some((t: AiTag) => t.category === "action");
      if (!hasAction) {
        const fallbackLabel = parsed.status || "確認のみ";
        parsed.tags.unshift({ label: fallbackLabel, category: "action" });
        if (parsed.tags.length > 3) parsed.tags = parsed.tags.slice(0, 3);
      }

      // Derive legacy `status` from first action tag
      const actionTag = parsed.tags.find((t: AiTag) => t.category === "action");
      parsed.status = (actionTag?.label as AiStep1Result["status"]) || "確認のみ";

      console.log(`[AI Route] step=1 tags:`, JSON.stringify(parsed.tags));
      console.log(`[AI Route] step=1 headline:`, parsed.headline, `suggestedActions:`, parsed.suggestedActions?.length);

      // Ensure arrays exist
      parsed.extractedTodos = parsed.extractedTodos || [];

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

      console.log(`[AI Route] step=1 ok in ${Date.now() - startedAt}ms`);
      return NextResponse.json({ step1: parsed });
    }

    if (step === 2) {
      const raw = await callGPT(messages, "medium", 3000);
      const parsed = JSON.parse(stripCodeFence(raw)) as AiStep2Result;
      console.log(`[AI Route] step=2 ok in ${Date.now() - startedAt}ms`);
      return NextResponse.json({ step2: parsed });
    }

    if (step === 3) {
      console.log(`[AI Route] step=3 messages:`, JSON.stringify(messages, null, 2).substring(0, 1000));
      const raw = await callGPT(messages, "low", 4000);
      console.log(`[AI Route] step=3 raw response length:`, raw.length);
      console.log(`[AI Route] step=3 raw response:`, raw);
      const parsed = JSON.parse(stripCodeFence(raw)) as AiStep3Result;
      console.log(`[AI Route] step=3 parsed:`, JSON.stringify(parsed, null, 2));

      // Ensure arrays exist
      parsed.todoCandidates = parsed.todoCandidates || [];
      parsed.calendarCandidates = parsed.calendarCandidates || [];
      parsed.checks = parsed.checks || [];

      console.log(`[AI Route] step=3 ok in ${Date.now() - startedAt}ms`);
      return NextResponse.json({ step3: parsed });
    }

    return NextResponse.json({ error: "無効なステップです。" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[AI Route] step=${step} failed in ${Date.now() - startedAt}ms:`, message);
    return NextResponse.json({ error: `AI処理でエラーが発生しました: ${message}` }, { status: 500 });
  }
}
